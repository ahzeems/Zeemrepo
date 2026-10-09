"""Network allowlist for the compliance sandboxes.

Each confined process gets its own network namespace, so it has no network at all. The one way out
is a CONNECT proxy on the host, listening on a unix socket bound into the sandbox, that tunnels only
HTTPS to Anthropic's hosts. Inside, `python3 netproxy.py forward SOCK PORT -- command...` serves that
socket as 127.0.0.1:PORT for HTTPS_PROXY, runs the command, and exits with its status.

Standard library only: the forwarder runs under the read-only system Python inside the sandbox.
"""

from __future__ import annotations

import socket
import socketserver
import subprocess
import sys
import threading
from collections.abc import Callable
from pathlib import Path

# Claude's API, login refresh and console. Telemetry and every other host are refused.
ANTHROPIC = ("anthropic.com", "claude.ai")
HEADER_LIMIT = 8192
CONNECT_TIMEOUT = 30


def allowed(host: str, port: int, domains: tuple[str, ...]) -> bool:
    """HTTPS to one of `domains` or a subdomain of it, and nothing else."""
    host = host.lower().rstrip(".")
    return port == 443 and any(host == domain or host.endswith("." + domain) for domain in domains)


def parse_connect(line: bytes) -> tuple[str, int] | None:
    """(host, port) from `CONNECT host:port HTTP/1.1`, or None for anything else."""
    parts = line.decode("latin-1").split()
    if len(parts) != 3 or parts[0] != "CONNECT" or ":" not in parts[1]:
        return None
    host, _, port = parts[1].rpartition(":")
    return (host, int(port)) if host and port.isdigit() else None


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


def read_head(client: socket.socket) -> bytes:
    head = b""
    while b"\r\n\r\n" not in head and len(head) < HEADER_LIMIT:
        chunk = client.recv(1024)
        if not chunk:
            break
        head += chunk
    return head


class Proxy(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True

    def close(self) -> None:
        self.shutdown()
        self.server_close()


def start_proxy(path: Path, allow: Callable[[str, int], bool]) -> Proxy:
    """A CONNECT proxy on unix socket `path` that tunnels only what `allow` accepts; close() stops it."""

    class Handler(socketserver.BaseRequestHandler):
        def handle(self) -> None:
            client: socket.socket = self.request
            target = parse_connect(read_head(client).split(b"\r\n", 1)[0])
            if target is None or not allow(*target):
                client.sendall(b"HTTP/1.1 403 Forbidden\r\n\r\n")
                return
            try:
                upstream = socket.create_connection(target, timeout=CONNECT_TIMEOUT)
            except OSError:
                client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                return
            upstream.settimeout(None)
            client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
            with upstream:
                splice(client, upstream)

    server = Proxy(str(path), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def forward(sock: str, port: int, command: list[str]) -> int:
    """Serve unix socket `sock` as 127.0.0.1:`port`, run `command`, and return its exit status."""
    listener = socket.create_server(("127.0.0.1", port))

    def accept() -> None:
        while True:
            client, _ = listener.accept()
            upstream = socket.socket(socket.AF_UNIX)
            upstream.connect(sock)
            threading.Thread(target=splice, args=(client, upstream), daemon=True).start()

    threading.Thread(target=accept, daemon=True).start()
    return subprocess.run(command).returncode


if __name__ == "__main__":
    if len(sys.argv) < 6 or sys.argv[1] != "forward" or sys.argv[4] != "--":
        print("usage: netproxy.py forward SOCK PORT -- command...", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(forward(sys.argv[2], int(sys.argv[3]), sys.argv[5:]))
