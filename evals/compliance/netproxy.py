"""Network allowlist for the compliance sandboxes.

Each confined process gets its own network namespace, so it has no network at all. The one way out
is a CONNECT proxy on the host, listening on a unix socket bound into the sandbox, that tunnels only
HTTPS to the Anthropic API only (see ANTHROPIC). Inside, `python3 netproxy.py forward SOCK PORT -- command...` serves that
socket as 127.0.0.1:PORT for HTTPS_PROXY, runs the command, and exits with its status.

Standard library only: the forwarder runs under the read-only system Python inside the sandbox.
"""

from __future__ import annotations

import re
import socket
import socketserver
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from pathlib import Path

# Exact hosts, not domains: only the API. platform.claude.com (login refresh) is refused, because a
# refresh in a sandbox rotates the owner's login (run_comply.py strips the refresh token anyway).
# Everything else is refused too, including mcp-proxy.anthropic.com, which
# would hand a scenario the owner's claude.ai connectors (mail, drive, docs), and telemetry.
ANTHROPIC = ("api.anthropic.com",)
HEADER_LIMIT = 8192
CONNECT_TIMEOUT = 30
# Only plain hostnames reach the host resolver; anything else (#, @, NUL, brackets) is refused first.
HOSTNAME = re.compile(r"^[A-Za-z0-9.-]{1,253}$")


def allowed(host: str, port: int, hosts: tuple[str, ...]) -> bool:
    """HTTPS to exactly one of `hosts`, and nothing else."""
    return port == 443 and host.lower().rstrip(".") in hosts


def parse_connect(line: bytes) -> tuple[str, int] | None:
    """(host, port) from `CONNECT host:port HTTP/1.1`, or None for anything else."""
    parts = line.decode("latin-1").split()
    if len(parts) != 3 or parts[0] != "CONNECT" or ":" not in parts[1]:
        return None
    host, _, port = parts[1].rpartition(":")
    if not HOSTNAME.match(host) or not (port.isascii() and port.isdigit()) or not 0 < int(port) < 65536:
        return None
    return host, int(port)


def pipe(source: socket.socket, sink: socket.socket) -> None:
    """Copy bytes until either side closes."""
    try:
        while data := source.recv(65536):
            sink.sendall(data)
    except OSError:
        pass
    finally:
        for end in (sink, source):
            try:
                end.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def splice(a: socket.socket, b: socket.socket) -> None:
    other = threading.Thread(target=pipe, args=(b, a), daemon=True)
    other.start()
    pipe(a, b)
    other.join()


def read_head(client: socket.socket, deadline: float) -> bytes:
    """The request header, read within `deadline` seconds in total; a client that trickles bytes times out."""
    head = b""
    end = time.monotonic() + deadline
    while b"\r\n\r\n" not in head and len(head) < HEADER_LIMIT:
        remaining = end - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("request header deadline passed")
        client.settimeout(remaining)
        chunk = client.recv(1024)
        if not chunk:
            break
        head += chunk
    return head


def reply(client: socket.socket, status: bytes) -> None:
    """Send a status line; a client that already left is not an error."""
    try:
        client.sendall(status)
    except OSError:
        pass


class Proxy(socketserver.ThreadingUnixStreamServer):
    """At most `max_connections` at once; beyond that a client gets 503 at once instead of a thread."""

    daemon_threads = True

    def __init__(self, path: str, handler: type[socketserver.BaseRequestHandler], max_connections: int) -> None:
        self.slots = threading.BoundedSemaphore(max_connections)
        self.seen: set[tuple[str, int, bool]] = set()
        super().__init__(path, handler)

    def process_request(self, request: socket.socket, client_address: object) -> None:  # type: ignore[override]
        if not self.slots.acquire(blocking=False):
            try:
                request.sendall(b"HTTP/1.1 503 Service Unavailable\r\n\r\n")
            except OSError:
                pass
            self.shutdown_request(request)
            return
        super().process_request(request, client_address)

    def process_request_thread(self, request: socket.socket, client_address: object) -> None:  # type: ignore[override]
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def close(self) -> None:
        self.shutdown()
        self.server_close()


def start_proxy(path: Path, allow: Callable[[str, int], bool], header_timeout: float = 10.0, max_connections: int = 64) -> Proxy:
    """A CONNECT proxy on unix socket `path` that tunnels only what `allow` accepts; close() stops it.

    A client must send its request header within `header_timeout` seconds; `seen` records every
    (host, port, allowed) asked for, so a run can report which hosts claude needed.
    """

    class Handler(socketserver.BaseRequestHandler):
        def handle(self) -> None:
            client: socket.socket = self.request
            try:
                target = parse_connect(read_head(client, header_timeout).split(b"\r\n", 1)[0])
            except OSError:
                return
            permitted = target is not None and allow(*target)
            if target is not None:
                server.seen.add((target[0].lower().rstrip("."), target[1], permitted))
            if target is None or not permitted:
                reply(client, b"HTTP/1.1 403 Forbidden\r\n\r\n")
                return
            try:
                upstream = socket.create_connection(target, timeout=CONNECT_TIMEOUT)
            except OSError:
                reply(client, b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                return
            upstream.settimeout(None)
            client.settimeout(None)
            client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
            with upstream:
                splice(client, upstream)

    server = Proxy(str(path), Handler, max_connections)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def forward(sock: str, port: int, command: list[str]) -> int:
    """Serve unix socket `sock` as 127.0.0.1:`port`, run `command`, and return its exit status."""
    listener = socket.create_server(("127.0.0.1", port))

    def accept() -> None:
        while True:
            client, _ = listener.accept()
            upstream = socket.socket(socket.AF_UNIX)
            try:
                upstream.connect(sock)
            except OSError:  # the proxy is gone: fail this connection at once instead of hanging
                client.close()
                upstream.close()
                continue
            threading.Thread(target=splice, args=(client, upstream), daemon=True).start()

    threading.Thread(target=accept, daemon=True).start()
    return subprocess.run(command).returncode


if __name__ == "__main__":
    if len(sys.argv) < 6 or sys.argv[1] != "forward" or sys.argv[4] != "--":
        print("usage: netproxy.py forward SOCK PORT -- command...", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(forward(sys.argv[2], int(sys.argv[3]), sys.argv[5:]))
