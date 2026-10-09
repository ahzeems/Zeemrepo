"""Run ECC skill-comply with this repository loaded into every scenario sandbox.

ECC's runner starts each scenario in an empty `git init` directory, so on its own it measures
Claude's default behaviour, not this repository's rules. This wrapper seeds each sandbox with a
snapshot of the committed repository (CLAUDE.md, .claude/, scripts and hooks; never earlier
reports or seeds.md, so neither scores nor expected behaviours leak into a run) after ECC's own setup, without overwriting the scenario's
files. A generated "competing" prompt may ask the agent to push or merge, and a scenario agent has
Bash as this user, so every process ECC starts (setup commands, scenario runs, generation and
classification) runs under bubblewrap built as an allowlist: an empty home, a private /tmp, pid
namespace and session, the system and tool directories read-only, a private copy of Claude's
login, the installed plugins read-only, and write access only to the working directory. Claude's
login token is the one secret the agent can read, because claude needs it.

Usage (from the repository root, with the venv described in evals/compliance/README.md):
  ~/.cache/zeemrepo/comply-venv/bin/python evals/compliance/run_comply.py <rule-or-skill.md> [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import netproxy

REPO = Path(__file__).resolve().parents[2]
REPORTS = REPO / "evals" / "compliance" / "reports"
# The private runner function this wraps is ECC's, so the wrapper is pinned to the version it
# was written against (the marketplace pin in .claude/settings.json).
ECC_VERSION = "2.2.3"
SKILL_COMPLY = Path.home() / ".claude/plugins/cache/ecc/ecc" / ECC_VERSION / "skills/skill-comply"
# An allowlist, not a denylist: anything else (tokens, SSH agent sockets, D-Bus, the parent Claude
# session's messaging variables) is dropped.
KEPT = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LANGUAGE", "TERM", "TZ",
        "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"}
KEPT_PREFIXES = ("LC_",)
# Read-only system and tool directories visible inside the confinement, when they exist.
# Not /run/systemd/resolve: its world-writable query socket would let DNS carry data out, and the
# sandbox needs no resolver because the host proxy resolves names.
SYSTEM_DIRS = ("/usr", "/etc", "/opt", "/home/linuxbrew")
MERGED_USR = {"/bin": "usr/bin", "/sbin": "usr/sbin", "/lib": "usr/lib", "/lib64": "usr/lib64"}
SANDBOX_AUTHOR = {
    "GIT_AUTHOR_NAME": "Compliance Sandbox", "GIT_AUTHOR_EMAIL": "sandbox@example.invalid",
    "GIT_COMMITTER_NAME": "Compliance Sandbox", "GIT_COMMITTER_EMAIL": "sandbox@example.invalid",
}


def isolated_env(base: Mapping[str, str], gh_config_dir: Path) -> dict[str, str]:
    """Allowlisted variables of `base`, no git routing or user config, an empty gh config and a fixed author."""
    env = {key: value for key, value in base.items() if key in KEPT or key.startswith(KEPT_PREFIXES)}
    env.update(SANDBOX_AUTHOR)
    env.update({
        "GH_CONFIG_DIR": str(gh_config_dir),
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
        "TMPDIR": "/tmp",
    })
    return env


@dataclass(frozen=True)
class Layout:
    """Host paths the confinement exposes: everything else is invisible."""
    home: Path
    claude_home: Path  # private, writable copy holding only Claude's login
    claude_binary: Path
    plugins: Path
    deps: Path | None = None


@dataclass(frozen=True)
class Network:
    """The host proxy's directory (proxy.sock and a copy of netproxy.py) and the in-sandbox forwarder port."""
    directory: Path
    python: Path
    port: int


NET_MOUNT = "/comply-net"
# Each confined process has its own network namespace, so a fixed port never collides.
FORWARD_PORT = 18443


def proxy_env(port: int) -> dict[str, str]:
    """Variables that send claude's HTTPS through the forwarder and drop its non-essential traffic."""
    url = f"http://127.0.0.1:{port}"
    return {"HTTPS_PROXY": url, "https_proxy": url, "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"}


def confine(command: list[str], *, cwd: Path, layout: Layout, network: Network | None = None) -> list[str]:
    """`command` under bubblewrap: an allowlist of read-only system paths, an empty home, private /tmp.

    With `network`, the process gets its own empty network namespace and reaches the outside only
    through the forwarder to the host proxy (netproxy.py), which tunnels HTTPS to Anthropic alone.
    """
    args = ["bwrap"]
    for path in SYSTEM_DIRS:
        if Path(path).is_dir():
            args += ["--ro-bind", path, path]
    for link, target in MERGED_USR.items():
        if Path(link).is_symlink():
            args += ["--symlink", target, link]
    home = str(layout.home)
    args += ["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--tmpfs", home,
             "--bind", str(layout.claude_home), f"{home}/.claude",
             "--ro-bind", str(layout.plugins), f"{home}/.claude/plugins",
             "--ro-bind", str(layout.claude_binary), f"{home}/.local/bin/claude"]
    if layout.deps is not None:
        args += ["--ro-bind", str(layout.deps), str(layout.deps)]
    args += ["--bind", str(cwd), str(cwd), "--chdir", str(cwd),
             "--unshare-pid", "--unshare-ipc", "--new-session", "--die-with-parent"]
    if network is None:
        return [*args, "--", *command]
    args += ["--unshare-net", "--ro-bind", str(network.directory), NET_MOUNT]
    forwarder = [str(network.python), f"{NET_MOUNT}/netproxy.py", "forward", f"{NET_MOUNT}/proxy.sock", str(network.port), "--"]
    return [*args, "--", *forwarder, *command]


class ConfinedSubprocess:
    """Stands in for the subprocess module inside ECC: every command runs confined in its working directory."""

    def __init__(self, run: Callable[..., object], wrap: Callable[[list[str], Path], list[str]], default_cwd: Path) -> None:
        self._run = run
        self._wrap = wrap
        self._default_cwd = default_cwd

    def run(self, args: list[str], **kwargs: object) -> object:
        cwd = kwargs.get("cwd")
        workdir = Path(str(cwd)) if cwd is not None else self._default_cwd
        return self._run(self._wrap(list(args), workdir), **kwargs)

    def __getattr__(self, name: str) -> object:
        return getattr(subprocess, name)


def remove_tree(path: Path) -> None:
    """Delete `path` completely: a sandbox may have made its own folders read-only to keep a login copy."""
    for root, dirs, _files in os.walk(path):
        for name in dirs:
            try:
                (Path(root) / name).chmod(0o700)
            except OSError:
                pass
    shutil.rmtree(path, ignore_errors=True)


def fresh_claude_home(source: Path, base: Path) -> Path:
    """A new Claude config directory per call holding only the login, so no call can plant for the next."""
    base.mkdir(parents=True, exist_ok=True)
    target = Path(tempfile.mkdtemp(prefix="claude-home-", dir=base))
    credentials = source / ".credentials.json"
    if credentials.is_file():
        shutil.copy2(credentials, target / ".credentials.json")
    (target / "plugins").mkdir()
    return target


def shared_deps(repo: Path, cache: Path) -> Path:
    """One copy of node_modules per lockfile, outside the masked repository, so sandboxes can run the checks."""
    lock = hashlib.sha256((repo / "package-lock.json").read_bytes()).hexdigest()[:16]
    target = cache / lock / "node_modules"
    if not target.is_dir():
        shutil.copytree(repo / "node_modules", target, symlinks=True)
    return target


def repo_snapshot(repo: Path) -> bytes:
    """The committed tree at HEAD as a tar archive, without earlier reports or the seeds' expected behaviours."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    return subprocess.run(
        ["git", "archive", "--format=tar", "HEAD", "--", ".", ":(exclude)evals/compliance/reports", ":(exclude)evals/compliance/seeds.md"],
        cwd=repo, env=env, check=True, capture_output=True,
    ).stdout


def seed_sandbox(sandbox: Path, snapshot: bytes, deps: Path | None = None) -> None:
    """Extract the snapshot into the sandbox, keeping files the scenario already created, and link deps."""
    root = sandbox.resolve()
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
        for member in archive.getmembers():
            target = (root / member.name).resolve()
            if member.issym() or member.islnk() or not target.is_relative_to(root) or target == root or target.exists():
                continue
            archive.extract(member, root, filter="data")
    if deps is not None and not (root / "node_modules").exists():
        (root / "node_modules").symlink_to(deps, target_is_directory=True)


# Setup commands come from the generated scenario and may have configured .git (an fsmonitor or
# hooks path runs code), so every baseline step is confined and those settings are switched off.
DISARMED = ["-c", "core.fsmonitor=", "-c", "core.hooksPath=/dev/null"]


def commit_baseline(sandbox: Path, run: Callable[..., object]) -> None:
    """Commit the seeded tree as main, with origin/main at it, so the branch guards have a base."""
    def step(*args: str) -> None:
        run(list(args), cwd=sandbox, check=True, capture_output=True)

    step("sh", "-c", "mkdir -p .git/info && printf 'node_modules\\n' >> .git/info/exclude")
    step("git", *DISARMED, "add", "--all")
    step("git", *DISARMED, "commit", "--quiet", "--allow-empty", "--no-verify", "-m", "Zeemrepo snapshot")
    step("git", *DISARMED, "branch", "-M", "main")
    step("git", *DISARMED, "update-ref", "refs/remotes/origin/main", "HEAD")


# Scenario sessions that follow the rules run npm run check (and npm run pr runs it again), which
# does not fit ECC's default of 300 seconds per scenario.
SCENARIO_TIMEOUT = 900


def setup_sandbox(sandbox: Path, commands: Sequence[str], run: Callable[..., object], warn: Callable[[str], None]) -> None:
    """ECC's setup, but each generated command runs through `sh -c`, so redirections and heredocs create
    the files the scenario needs (ECC splits them without a shell, so `echo x > f` makes nothing).
    Safe because `run` confines every command; a failed command is reported instead of skipped."""
    remove_tree(sandbox)
    sandbox.mkdir(parents=True)
    run(["git", "init", "--quiet"], cwd=sandbox, check=True, capture_output=True)
    for command in commands:
        result = run(["sh", "-c", command], cwd=sandbox, capture_output=True, text=True)
        if getattr(result, "returncode", 0) != 0:
            warn(f"run_comply: setup command failed ({getattr(result, 'returncode', '?')}): {command[:120]}")


def require_confinement(which: Callable[[], str | None], works: Callable[[], bool]) -> None:
    """Refuse to run anything unless bubblewrap is installed and a trivial confined command succeeds."""
    if which() is None or not works():
        print("run_comply: bubblewrap (bwrap) is missing or cannot run here; refusing to run unconfined.", file=sys.stderr)
        raise SystemExit(2)


def ecc_arguments(target: Path, *, model: str, gen_model: str, dry_run: bool) -> list[str]:
    """Arguments for ECC's scripts.run; a real run writes its report under evals/compliance/reports."""
    # Repository-relative, run from the repository root: ECC prints this path in the report header.
    args = [str(target.resolve().relative_to(REPO)), "--model", model, "--gen-model", gen_model]
    if dry_run:
        return [*args, "--dry-run"]
    return [*args, "--output", str(REPORTS / f"{report_name(target)}.md")]


def report_name(target: Path) -> str:
    """rules-zeem-branch-and-merge, skills-write-guard: from the path, so same-named files never collide."""
    parts = list(target.resolve().relative_to(REPO).with_suffix("").parts)
    if parts and parts[0] == ".claude":
        parts = parts[1:]
    if parts and parts[-1] == "SKILL":
        parts = parts[:-1]
    return "-".join(parts)


def require_skill_comply(path: Path) -> None:
    if not (path / "scripts" / "runner.py").is_file():
        print(f"run_comply: ECC skill-comply {ECC_VERSION} not found at {path}; update ECC_VERSION with the plugin pin.", file=sys.stderr)
        raise SystemExit(2)


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description="ECC skill-comply with this repository loaded into each sandbox.")
    parser.add_argument("target", type=Path, help="rule, skill or agent markdown file")
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--gen-model", default="haiku")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    require_skill_comply(SKILL_COMPLY)
    snapshot = repo_snapshot(REPO)
    deps = shared_deps(REPO, Path.home() / ".cache/zeemrepo/comply-deps")
    # Everything the run creates (login copies, the proxy socket, the gh config) lives here and is
    # removed at the end, however the run ends. /tmp keeps the socket path short.
    work = Path(tempfile.mkdtemp(prefix="run-comply-", dir="/tmp"))
    started: list[netproxy.Proxy] = []  # filled as soon as the proxy starts, so it closes on any failure
    try:
        run_confined(args, snapshot, deps, work, started)
    finally:
        for proxy in started:
            for host, port, permitted in sorted(proxy.seen):
                print(f"run_comply: network {'allowed' if permitted else 'REFUSED'} {host}:{port}", file=sys.stderr)
            proxy.close()
        remove_tree(work)


def run_confined(args: argparse.Namespace, snapshot: bytes, deps: Path, work: Path, started: list[netproxy.Proxy]) -> None:
    """Isolate the environment, start the proxy (recorded in `started`), confine ECC's subprocesses and run it."""
    (work / "gh").mkdir()
    caller_env = dict(os.environ)
    os.environ.clear()
    os.environ.update(isolated_env(caller_env, work / "gh"))
    sys.dont_write_bytecode = True  # no __pycache__ in the plugin cache
    sys.path.insert(0, str(SKILL_COMPLY))
    import scripts.run as ecc_run  # ECC is importable only from here
    import scripts.runner as runner
    from scripts import classifier, scenario_generator, spec_generator

    claude_binary = Path(shutil.which("claude") or "claude").resolve()
    (work / "calls").mkdir()
    (work / "net").mkdir()
    shutil.copy2(Path(__file__).with_name("netproxy.py"), work / "net" / "netproxy.py")
    started.append(netproxy.start_proxy(work / "net" / "proxy.sock", lambda host, port: netproxy.allowed(host, port, netproxy.ANTHROPIC)))
    network = Network(directory=work / "net", python=Path(shutil.which("python3") or "python3").resolve(), port=FORWARD_PORT)
    os.environ.update(proxy_env(FORWARD_PORT))

    def wrap(command: list[str], cwd: Path) -> list[str]:
        layout = Layout(home=Path.home(), claude_home=fresh_claude_home(Path.home() / ".claude", work),
                        claude_binary=claude_binary, plugins=Path.home() / ".claude" / "plugins", deps=deps)
        return confine(command, cwd=cwd, layout=layout, network=network)

    confined = ConfinedSubprocess(subprocess.run, wrap, work / "calls")
    require_confinement(lambda: shutil.which("bwrap"), lambda: confined.run(["true"]).returncode == 0)
    for module in (runner, classifier, scenario_generator, spec_generator):
        module.subprocess = confined
    def setup_with_repository(sandbox_dir: Path, scenario: object) -> None:
        commands = getattr(scenario, "setup_commands", ())
        setup_sandbox(sandbox_dir, commands, confined.run, lambda message: print(message, file=sys.stderr))
        seed_sandbox(sandbox_dir, snapshot, deps)
        commit_baseline(sandbox_dir, confined.run)

    runner._setup_sandbox = setup_with_repository
    run_scenario = runner.run_scenario
    ecc_run.run_scenario = lambda scenario, model: run_scenario(scenario, model=model, timeout=SCENARIO_TIMEOUT)
    os.chdir(REPO)
    sys.argv = ["skill-comply", *ecc_arguments(args.target, model=args.model, gen_model=args.gen_model, dry_run=args.dry_run)]
    ecc_run.main()


if __name__ == "__main__":
    main(sys.argv[1:])
