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
    def test_only_https_to_anthropic_hosts_is_allowed(self) -> None:
        for host in ("api.anthropic.com", "console.anthropic.com", "anthropic.com", "claude.ai"):
            self.assertTrue(netproxy.allowed(host, 443, netproxy.ANTHROPIC), host)
        for host, port in (("api.anthropic.com", 80), ("evil.com", 443), ("anthropic.com.evil.com", 443),
                           ("notanthropic.com", 443), ("127.0.0.1", 443), ("github.com", 443)):
            self.assertFalse(netproxy.allowed(host, port, netproxy.ANTHROPIC), f"{host}:{port}")

    def test_parses_a_connect_line_and_refuses_anything_else(self) -> None:
        self.assertEqual(netproxy.parse_connect(b"CONNECT api.anthropic.com:443 HTTP/1.1\r\n"), ("api.anthropic.com", 443))
        for line in (b"GET http://x/ HTTP/1.1\r\n", b"CONNECT nohost HTTP/1.1\r\n", b"CONNECT a:b HTTP/1.1\r\n", b""):
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
