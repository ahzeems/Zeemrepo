"""Tests for netproxy.py: the host CONNECT proxy and the in-sandbox forwarder, on loopback only."""

import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

import netproxy


class Allowlist(unittest.TestCase):
    def test_only_https_to_the_exact_anthropic_api_host_is_allowed(self) -> None:
        for host in ("api.anthropic.com", "API.Anthropic.com."):
            self.assertTrue(netproxy.allowed(host, 443, netproxy.ANTHROPIC), host)
        for host, port in (("api.anthropic.com", 80), ("evil.com", 443), ("anthropic.com.evil.com", 443),
                           ("mcp-proxy.anthropic.com", 443), ("claude.ai", 443), ("anthropic.com", 443),
                           ("console.anthropic.com", 443), ("platform.claude.com", 443),
                           ("x.api.anthropic.com", 443), ("127.0.0.1", 443), ("github.com", 443)):
            self.assertFalse(netproxy.allowed(host, port, netproxy.ANTHROPIC), f"{host}:{port}")

    def test_parses_a_connect_line_and_refuses_anything_else(self) -> None:
        self.assertEqual(netproxy.parse_connect(b"CONNECT api.anthropic.com:443 HTTP/1.1\r\n"), ("api.anthropic.com", 443))
        for line in (b"GET http://x/ HTTP/1.1\r\n", b"CONNECT nohost HTTP/1.1\r\n", b"CONNECT a:b HTTP/1.1\r\n", b"",
                     "CONNECT api.anthropic.com:\u00b2 HTTP/1.1\r\n".encode(), b"CONNECT api.anthropic.com:99999 HTTP/1.1\r\n",
                     b"CONNECT example.com#.anthropic.com:443 HTTP/1.1\r\n", b"CONNECT a\x40evil.com#.anthropic.com:443 HTTP/1.1\r\n"):
            self.assertIsNone(netproxy.parse_connect(line), line)


def echo_server() -> int:
    server = socket.create_server(("127.0.0.1", 0))

    def serve() -> None:
        while True:
            connection, _ = server.accept()
            data = connection.recv(1024)
            connection.sendall(b"echo:" + data)
            connection.close()

    threading.Thread(target=serve, daemon=True).start()
    return server.getsockname()[1]


def connect_through(port: int, target: str) -> bytes:
    with socket.create_connection(("127.0.0.1", port), timeout=5) as client:
        client.sendall(f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n\r\n".encode())
        reply = client.recv(1024)
        if b" 200 " not in reply:
            return reply
        client.sendall(b"ping")
        return client.recv(1024)


class Limits(unittest.TestCase):
    def test_a_silent_client_is_dropped_and_excess_connections_are_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sock = Path(directory) / "p.sock"
            proxy = netproxy.start_proxy(sock, allow=lambda host, port: True, header_timeout=0.3, max_connections=2)
            try:
                silent = socket.socket(socket.AF_UNIX)
                silent.connect(str(sock))
                silent.settimeout(3)
                self.assertEqual(silent.recv(1024), b"", "a client that never sends a header is closed")
                held = [socket.socket(socket.AF_UNIX) for _ in range(2)]
                for client in held:
                    client.connect(str(sock))
                time.sleep(0.1)
                extra = socket.socket(socket.AF_UNIX)
                extra.connect(str(sock))
                extra.settimeout(3)
                self.assertIn(b" 503 ", extra.recv(1024), "beyond the cap, connections are refused at once")
                for client in (*held, extra, silent):
                    client.close()
            finally:
                proxy.close()

    def test_a_client_that_trickles_its_header_is_dropped_at_the_deadline(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sock = Path(directory) / "p.sock"
            proxy = netproxy.start_proxy(sock, allow=lambda host, port: True, header_timeout=0.6)
            try:
                client = socket.socket(socket.AF_UNIX)
                client.connect(str(sock))
                started = time.time()
                closed = False
                while time.time() - started < 4:
                    try:
                        client.sendall(b"X")
                    except OSError:
                        closed = True
                        break
                    time.sleep(0.1)
                self.assertTrue(closed, "a trickling client is cut off after the header deadline")
                self.assertLess(time.time() - started, 2.5)
                client.close()
            finally:
                proxy.close()

    def test_the_proxy_records_which_hosts_were_asked_for(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sock = Path(directory) / "p.sock"
            proxy = netproxy.start_proxy(sock, allow=lambda host, port: False)
            try:
                client = socket.socket(socket.AF_UNIX)
                client.connect(str(sock))
                client.sendall(b"CONNECT example.com:443 HTTP/1.1\r\n\r\n")
                client.recv(1024)
                client.close()
                time.sleep(0.1)
                self.assertEqual(proxy.seen, {("example.com", 443, False)})
            finally:
                proxy.close()


class Tunnel(unittest.TestCase):
    def test_the_forwarder_reaches_an_allowed_host_through_the_proxy_and_refused_hosts_get_403(self) -> None:
        upstream = echo_server()
        with tempfile.TemporaryDirectory() as directory:
            sock = Path(directory) / "proxy.sock"
            proxy = netproxy.start_proxy(sock, allow=lambda host, port: host == "127.0.0.1" and port == upstream)
            try:
                listen = socket.socket()
                listen.bind(("127.0.0.1", 0))
                port = listen.getsockname()[1]
                listen.close()
                forwarder = subprocess.Popen([sys.executable, netproxy.__file__, "forward", str(sock), str(port), "--", "sleep", "30"])
                try:
                    deadline = time.time() + 5
                    while time.time() < deadline:
                        try:
                            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
                            break
                        except OSError:
                            time.sleep(0.05)
                    self.assertEqual(connect_through(port, f"127.0.0.1:{upstream}"), b"echo:ping")
                    self.assertIn(b" 403 ", connect_through(port, "evil.example:443"))
                finally:
                    forwarder.terminate()
                    forwarder.wait(5)
            finally:
                proxy.close()


if __name__ == "__main__":
    unittest.main()
