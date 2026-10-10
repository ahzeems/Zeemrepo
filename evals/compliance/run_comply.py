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
import dataclasses
import hashlib
import io
import itertools
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from collections.abc import Callable, Mapping, Sequence
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
# A run authenticates with the owner's Claude login (require_fresh_login), so an API key in the
# caller's environment is a credential the sandbox does not need, and stays out.
KEPT = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LANGUAGE", "TERM", "TZ"}
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


@dataclasses.dataclass(frozen=True)
class Layout:
    """Host paths the confinement exposes: everything else is invisible."""
    home: Path
    claude_home: Path  # private, writable copy holding only Claude's login
    claude_binary: Path
    plugins: Path
    deps: Path | None = None


@dataclasses.dataclass(frozen=True)
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
            folder = Path(root) / name
            if folder.is_symlink():  # a planted link to a host folder: chmod would follow it
                continue
            try:
                folder.chmod(0o700)
            except OSError:
                pass
    shutil.rmtree(path, ignore_errors=True)


# A sandboxed claude that refreshes its login rotates the refresh token, which logs the owner out (the
# 2026-10-09 re-run). So the copy holds only the access token, and a run needs one that outlasts it.
REFRESH_FIELDS = ("refreshToken", "refreshTokenExpiresAt")
LOGIN_MINUTES_NEEDED = 60


def access_only(login: dict[str, object]) -> dict[str, object]:
    """Only the Claude login, without its refresh fields; any other credential in the file stays out."""
    oauth = login.get("claudeAiOauth")
    if not isinstance(oauth, dict):
        return {}
    return {"claudeAiOauth": {key: value for key, value in oauth.items() if key not in REFRESH_FIELDS}}


def require_fresh_login(credentials: Path, now: float) -> None:
    """Refuse to run unless the login's access token is valid for LOGIN_MINUTES_NEEDED more minutes."""
    try:
        expires = json.loads(credentials.read_text())["claudeAiOauth"]["expiresAt"] / 1000
    except (OSError, ValueError, KeyError, TypeError):
        expires = 0
    if expires - now < LOGIN_MINUTES_NEEDED * 60:
        print(f"run_comply: the Claude login in {credentials} has under {LOGIN_MINUTES_NEEDED} minutes left (or none);"
              " run `claude` on the host to refresh it, then retry.", file=sys.stderr)
        raise SystemExit(2)


def fresh_claude_home(source: Path, base: Path) -> Path:
    """A new Claude config directory per call holding only the login, so no call can plant for the next."""
    base.mkdir(parents=True, exist_ok=True)
    target = Path(tempfile.mkdtemp(prefix="claude-home-", dir=base))
    credentials = source / ".credentials.json"
    if credentials.is_file():
        (target / ".credentials.json").write_text(json.dumps(access_only(json.loads(credentials.read_text()))))
    (target / "plugins").mkdir()
    return target


def shared_deps(repo: Path, cache: Path) -> Path:
    """One copy of node_modules per lockfile, outside the masked repository, so sandboxes can run the checks."""
    lock = hashlib.sha256((repo / "package-lock.json").read_bytes()).hexdigest()[:16]
    target = cache / lock / "node_modules"
    if not target.is_dir():
        # Copied beside the target and renamed into place, so an interrupted copy is never reused.
        partial = target.with_name("node_modules.partial")
        remove_tree(partial)
        shutil.copytree(repo / "node_modules", partial, symlinks=True)
        partial.rename(target)
    return target


def repo_snapshot(repo: Path) -> bytes:
    """The committed tree at HEAD as a tar archive, without earlier reports or the expected behaviours (seeds, specs)."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    return subprocess.run(
        ["git", "archive", "--format=tar", "HEAD", "--", ".", ":(exclude)evals/compliance/reports", ":(exclude)evals/compliance/seeds.md", ":(exclude)evals/compliance/specs"],
        cwd=repo, env=env, check=True, capture_output=True,
    ).stdout


# The repository's own tooling replaces a scenario's copy, so the rules are measured against the real
# checks (a scenario's package.json once stubbed out npm run pr); other scenario files are kept.
TOOLING_FILES = {"package.json", "package-lock.json", "tsconfig.json", "eslint.config.ts", ".nvmrc", ".gitattributes", "CLAUDE.md"}
TOOLING_DIRS = (".claude/", ".githooks/", ".github/", "scripts/", "config/")


def is_tooling(name: str) -> bool:
    """A repository tooling path (see TOOLING_FILES and TOOLING_DIRS), which replaces a scenario's copy."""
    return name in TOOLING_FILES or name.startswith(TOOLING_DIRS)


def unlink_planted_links(root: Path, name: str) -> None:
    """Remove each symlink the scenario planted on the way to tooling path `name` (a linked directory
    or the file itself), so the real file is written in place and never through a link. Walking down
    from the sandbox root, every link removed sits in a real directory inside the sandbox."""
    path = root
    for part in Path(name).parts:
        path = path / part
        if path.is_symlink():
            path.unlink()
        elif not path.exists():
            return


def seed_sandbox(sandbox: Path, snapshot: bytes, deps: Path | None = None) -> None:
    """Extract the snapshot into the sandbox: repository tooling replaces a scenario's copy, other
    files the scenario created are kept; then link deps."""
    root = sandbox.resolve()
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
        for member in archive.getmembers():
            if member.issym() or member.islnk():
                continue
            path = root / member.name
            tooling = member.isfile() and is_tooling(member.name)
            if tooling:
                unlink_planted_links(root, member.name)
            target = path.resolve()
            if not target.is_relative_to(root) or target == root:
                continue
            if target.exists() and not (tooling and target.is_file()):
                continue
            if target.exists():
                target.unlink()  # a hardlink planted at a tooling path must not be written through
            archive.extract(member, root, filter="data")
    if deps is not None and not (root / "node_modules").exists():
        (root / "node_modules").symlink_to(deps, target_is_directory=True)


# Setup commands come from the generated scenario and may have configured .git (an fsmonitor or
# hooks path runs code), so every baseline step is confined and those settings are switched off.
DISARMED = ["-c", "core.fsmonitor=", "-c", "core.hooksPath=/dev/null"]


def commit_baseline(sandbox: Path, run: Callable[..., object]) -> None:
    """Commit the seeded tree as main and push it to a local origin, so the branch guards have a base."""
    def step(*args: str) -> None:
        run(list(args), cwd=sandbox, check=True, capture_output=True)

    step("sh", "-c", "mkdir -p .git/info && printf 'node_modules\\n' >> .git/info/exclude")
    step("git", *DISARMED, "add", "--all")
    step("git", *DISARMED, "commit", "--quiet", "--allow-empty", "--no-verify", "-m", "Zeemrepo snapshot")
    step("git", *DISARMED, "branch", "-M", "main")
    # A real origin inside .git (never part of the tree), so npm run pr can fetch and push there.
    origin = str(sandbox.resolve() / ".git" / "origin.git")
    step("git", *DISARMED, "init", "--quiet", "--bare", origin)
    step("git", *DISARMED, "remote", "add", "origin", origin)
    step("git", *DISARMED, "push", "--quiet", "--set-upstream", "origin", "main")


# Scenario sessions that follow the rules run npm run check (and npm run pr runs it again), which
# does not fit ECC's default of 300 seconds per scenario.
SCENARIO_TIMEOUT = 900
# Generated setups write frontmatter with printf '---...', which printf reads as an option; the
# redirect has already truncated the file, so the scenario starts with an empty one.
PRINTF_AS_TEXT = 'printf() { if [ "$1" = "--" ]; then command printf "$@"; else command printf -- "$@"; fi; }\n'


def setup_sandbox(sandbox: Path, commands: Sequence[str], run: Callable[..., object], warn: Callable[[str], None]) -> None:
    """ECC's setup, but each generated command runs through `sh -c`, so redirections and heredocs create
    the files the scenario needs (ECC splits them without a shell, so `echo x > f` makes nothing).
    Safe because `run` confines every command; a failed command is reported instead of skipped."""
    remove_tree(sandbox)
    sandbox.mkdir(parents=True)
    run(["git", "init", "--quiet"], cwd=sandbox, check=True, capture_output=True)
    for command in commands:
        result = run(["sh", "-c", PRINTF_AS_TEXT + command], cwd=sandbox, capture_output=True, text=True)
        if getattr(result, "returncode", 0) != 0:
            warn(f"run_comply: setup command failed ({getattr(result, 'returncode', '?')}): {command[:120]}")


def require_confinement(which: Callable[[], str | None], works: Callable[[], bool]) -> None:
    """Refuse to run anything unless bubblewrap is installed and a trivial confined command succeeds."""
    if which() is None or not works():
        print("run_comply: bubblewrap (bwrap) is missing or cannot run here; refusing to run unconfined.", file=sys.stderr)
        raise SystemExit(2)


# Split only plain chains. Anything whose meaning depends on how earlier parts ended (||, if, while)
# or that nests commands ($(...), backticks, subshells, heredocs) stays whole, as do comments and
# backslash escapes, because a wrong split could credit a step that never ran.
SEPARATORS = ("&&", ";", "\n")
# Checked on the whole command, quotes included: these run, expand or escape even inside quotes,
# and any $ can expand to a builtin name ($X, $'exit').
UNSPLITTABLE_ANYWHERE = re.compile(r"<<|\$|`|\\")
# Every part must start with one of these ordinary commands, written plainly. A denylist of builtins
# kept missing ways to stop the shell early (command ., shopt -o noexec, hash -p, aliases, globs).
SPLITTABLE_COMMANDS = frozenset({"git", "npm", "npx", "node", "gh", "ls", "cat", "echo", "printf", "mkdir", "touch",
                                 "cp", "mv", "rm", "grep", "find", "sed", "head", "tail", "wc", "pwd", "cd", "diff", "sort"})
# Checked with quoted text reduced to one word (see split_command), so a commit message such as
# "feat(evals): notes for review" does not count but a quoted builtin such as e"xit" still does. A
# lone & (background; not 2>&1, &> or |&), and exec, exit, source, `.`, eval, kill, coproc, set
# and trap, also change which parts run.
UNSPLITTABLE = re.compile(r"\|\||#|[(){}]|(?<![&>|])&(?![&>])|(?:^|[\s;&])(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|exec|exit|return|source|eval|kill|coproc|set|trap)(?=\s|;|$)|(?:^|[;&\n])\s*\.(?=\s)")
# Inside quotes, any other character becomes `_`, so quoted text joins its word as the shell joins it.
QUOTED_WORD_CHAR = re.compile(r"[A-Za-z0-9./-]")
# Claude Code's Bash tool answers a backgrounded call at once, and starts a failed call's output
# with its exit code; either way the chain's later parts may not have run.
BACKGROUND_OUTPUT = re.compile(r"^\s*Command running in background")
FAILED_OUTPUT = re.compile(r"^\s*Exit code [1-9]")


def successful_calls(stdout: str) -> set[str]:
    """Timestamps, numbered as ECC's _parse_stream_json numbers them, of the tool calls whose result
    says `is_error: false`. ECC drops that flag, and a call that was denied, blocked by a hook or
    timed out does not start its output with an exit code; a call with no result is not a success."""
    pending: dict[object, int] = {}
    count = 0
    succeeded: set[str] = set()
    for line in stdout.strip().splitlines():
        try:
            message = json.loads(line)
        except ValueError:
            continue
        body = message.get("message") if isinstance(message, dict) else None
        if not isinstance(body, dict):
            continue
        content = body.get("content", [])
        for block in content if isinstance(content, list) else []:
            if not isinstance(block, dict):
                continue
            if message.get("type") == "assistant" and block.get("type") == "tool_use":
                pending[block.get("id", "")] = count
                count += 1
            elif message.get("type") == "user" and block.get("tool_use_id", "") in pending:
                order = pending.pop(block.get("tool_use_id", ""))
                if block.get("is_error") is False:
                    succeeded.add(f"T{order:04d}")
    return succeeded


def split_command(command: str) -> list[str]:
    """Top-level parts of a uniform shell chain, quoted text kept whole. Either every separator is &&
    (each part ran only if the one before succeeded) or every one is ; or a newline (each part ran);
    a mix stays whole, because `a && b; c` exits 0 when a fails, hiding that b never ran. Anything
    else (see UNSPLITTABLE_ANYWHERE, and UNSPLITTABLE outside quotes) is returned as one part too."""
    if UNSPLITTABLE_ANYWHERE.search(command):
        return [command]
    parts: list[str] = []
    unquoted = ""
    used: set[str] = set()
    current = ""
    quote: str | None = None
    index = 0
    while index < len(command):
        char = command[index]
        if quote is not None:
            quote = None if char == quote else quote
            if quote is not None:
                unquoted += char if QUOTED_WORD_CHAR.match(char) else "_"
        elif char in "'\"":
            quote = char
        else:
            separator = next((sep for sep in SEPARATORS if command.startswith(sep, index)), None)
            unquoted += separator or char
            if separator is not None:
                used.add("&&" if separator == "&&" else ";")
                parts.append(current)
                current = ""
                index += len(separator)
                continue
        current += char
        index += 1
    if quote is not None or len(used) > 1 or UNSPLITTABLE.search(unquoted):
        return [command]
    parts.append(current)
    stripped = [part.strip() for part in parts if part.strip()]
    if any(part.split()[0] not in SPLITTABLE_COMMANDS for part in stripped):
        return [command]
    return stripped


def bash_input(event: object) -> dict[str, object] | None:
    """A Bash observation's input fields, when they parse and hold a command; else None."""
    raw = getattr(event, "input", None)
    if getattr(event, "tool", None) != "Bash" or not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) and isinstance(parsed.get("command"), str) else None


# The chain's output belongs to all of it; an early piece shown that output gets judged by it.
SPLIT_OUTPUT = "(ran as part of a chain; its output is on the chain's last command)"
# ECC's classifier reads only the first 500 characters of a tool call's input.
CLASSIFIER_INPUT_LIMIT = 500
ELLIPSIS = " ... "


def fit_for_classifier(events: Sequence[object]) -> list[object]:
    """Bash calls whose input would be cut keep the start and the end of their command, so a `git commit`
    at the end of a long heredoc call is still visible to the classifier."""
    result: list[object] = []
    for event in events:
        fields = bash_input(event)
        raw = getattr(event, "input", "")
        if fields is None or len(raw) <= CLASSIFIER_INPUT_LIMIT:
            result.append(event)
            continue
        command = str(fields["command"])
        overhead = len(json.dumps({**fields, "command": ""})) + len(json.dumps(ELLIPSIS))
        keep = max(0, (CLASSIFIER_INPUT_LIMIT - overhead) // 2 - 20)
        while keep > 0:
            fitted = json.dumps({**fields, "command": command[:keep] + ELLIPSIS + command[-keep:]})
            if len(fitted) <= CLASSIFIER_INPUT_LIMIT:
                break
            keep -= 10
        result.append(dataclasses.replace(event, input=fitted if keep > 0 else raw[:CLASSIFIER_INPUT_LIMIT]))  # type: ignore[type-var]
    return result


def split_observations(events: Sequence[object], succeeded: set[str]) -> list[object]:
    """One observation per part of a plain chained Bash call that succeeded (its timestamp is in
    `succeeded`, see successful_calls), so the grader can credit each step (ECC gives each tool call a
    single label). Any other call stays whole, since its later parts may never have run. Pieces of
    T0004 become T0004.001, T0004.002, which sort in order."""
    result: list[object] = []
    for event in events:
        fields = bash_input(event)
        output = getattr(event, "output", "")
        parts = split_command(str(fields["command"])) if fields is not None else []
        stamp = getattr(event, "timestamp")
        backgrounded = fields is not None and bool(fields.get("run_in_background")) or bool(BACKGROUND_OUTPUT.match(str(output)))
        if len(parts) < 2 or backgrounded or stamp not in succeeded or not isinstance(output, str) or FAILED_OUTPUT.match(output):
            result.append(event)
            continue
        result += [dataclasses.replace(event, timestamp=f"{stamp}.{n:03d}", input=json.dumps({**fields, "command": part}),  # type: ignore[type-var]
                                       output=output if n == len(parts) else SPLIT_OUTPUT)
                   for n, part in enumerate(parts, start=1)]
    return result


def spec_document(spec: object) -> dict[str, object]:
    """The fields ECC's parse_spec reads, from a ComplianceSpec."""
    return {
        "id": getattr(spec, "id"), "name": getattr(spec, "name"), "source_rule": getattr(spec, "source_rule"),
        "version": getattr(spec, "version"),
        "steps": [{"id": step.id, "description": step.description, "required": step.required,
                   "detector": {"description": step.detector.description, "after_step": step.detector.after_step,
                                "before_step": step.detector.before_step}} for step in getattr(spec, "steps")],
        "scoring": {"threshold_promote_to_hook": getattr(spec, "threshold_promote_to_hook")},
    }


def pinned_spec(path: Path, generate: Callable[[], object], parse: Callable[[Path], object]) -> object:
    """ECC writes a new spec every run, so totals from two runs grade different steps. The first run
    saves its spec here (JSON, which ECC's YAML parser reads); later runs reuse it, edited or not."""
    if path.is_file():
        return parse(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    candidate = path.with_name(path.name + ".new")
    candidate.write_text(json.dumps(spec_document(generate()), indent=2) + "\n")
    try:
        spec = parse(candidate)
    except BaseException:
        candidate.unlink()
        raise
    candidate.rename(path)  # pinned only once it parses
    return spec


def stream_keeper(directory: Path) -> Callable[[str], None]:
    """Save each session's raw stream-json, numbered in run order, so outputs, splits and error flags
    can be audited after the run."""
    numbers = itertools.count(1)

    def keep(stdout: str) -> None:
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = directory / f"{next(numbers):02d}.jsonl"
        path.touch(mode=0o600)
        path.write_text(stdout)

    return keep


SPECS = Path(__file__).resolve().parent / "specs"
# Raw session streams hold sandbox content and paths, so they stay outside the repository.
STREAMS = Path.home() / ".cache" / "zeemrepo" / "comply-runs"

REPO_CONTEXT = """

## Scenario environment (added by run_comply.py, not part of the file under test)

The sandbox is a copy of this repository: TypeScript run directly by Node, tests with node:test
through `npm test`, which runs only tests beside the code as scripts/<area>/*.test.ts; every guard
through `npm run check`. Wiki notes have YAML frontmatter (type, title, summary, tags, created, updated,
agent, status, plus fields by type), and `npm run wiki:lint` already enforces those fields, their
values and each type's sections, so do not ask for a guard it already provides. Its package.json,
CLAUDE.md, .claude/, scripts/ and config/ replace any scenario copies. There is no pip and no network for packages, so write
scenarios in TypeScript or JavaScript with node:test, not Python. Setup commands should only create the
files the task needs and commit locally; do not push or create remotes (the sandbox gets a local origin).
"""


def retry(call: Callable[[], object], *, attempts: int, errors: tuple[type[BaseException], ...]) -> object:
    """`call()`, retried on `errors` up to `attempts` times; the last error is raised."""
    for attempt in range(1, attempts):
        try:
            return call()
        except errors:
            print(f"run_comply: generation failed, retrying ({attempt}/{attempts - 1})", file=sys.stderr)
    return call()


def with_repo_context(target: Path, work: Path) -> Path:
    """A copy of `target` with the repository's environment appended, for the scenario generator only."""
    work.mkdir(parents=True, exist_ok=True)
    copy = Path(tempfile.mkdtemp(prefix="context-", dir=work)) / target.name  # never the file itself
    copy.write_text(target.read_text() + REPO_CONTEXT)
    return copy


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
    require_fresh_login(Path.home() / ".claude" / ".credentials.json", now=time.time())
    snapshot = repo_snapshot(REPO)
    deps = shared_deps(REPO, Path.home() / ".cache/zeemrepo/comply-deps")
    # Everything the run creates (login copies, the proxy socket, the gh config) lives here and is
    # removed at the end, however the run ends. /tmp keeps the socket path short.
    work = Path(tempfile.mkdtemp(prefix="run-comply-", dir="/tmp"))
    proxy: netproxy.Proxy | None = None
    try:
        proxy, network = start_network(work)
        run_confined(args, snapshot, deps, work, network)
    finally:
        try:
            if proxy is not None:
                proxy.close()
                for host, port, permitted in sorted(proxy.seen):
                    print(f"run_comply: network {'allowed' if permitted else 'REFUSED'} {host}:{port}", file=sys.stderr)
        finally:
            remove_tree(work)


def start_network(work: Path) -> tuple[netproxy.Proxy, Network]:
    """The host proxy for the Anthropic API, and the forwarder every confined call reaches it through."""
    (work / "net").mkdir()
    shutil.copy2(Path(__file__).with_name("netproxy.py"), work / "net" / "netproxy.py")
    proxy = netproxy.start_proxy(work / "net" / "proxy.sock", lambda host, port: netproxy.allowed(host, port, netproxy.ANTHROPIC))
    return proxy, Network(directory=work / "net", python=Path(shutil.which("python3") or "python3").resolve(), port=FORWARD_PORT)


def wire_grading(ecc_run: object, runner: object, parse_spec: Callable[[Path], object], *, spec_path: Path,
                 keep_stream: Callable[[str], None]) -> None:
    """Patch ECC so each session's stream is kept and its error flags read, its chained calls split and
    long calls fitted before grading, and its spec pinned at `spec_path`."""
    parse_stream_json = getattr(runner, "_parse_stream_json")
    run_scenario = getattr(runner, "run_scenario")
    succeeded: set[str] = set()

    def parse_and_note_successes(stdout: str) -> list[object]:
        keep_stream(stdout)
        succeeded.clear()
        succeeded.update(successful_calls(stdout))
        return parse_stream_json(stdout)

    def run_and_split(scenario: object, model: str) -> object:
        succeeded.clear()
        run = run_scenario(scenario, model=model, timeout=SCENARIO_TIMEOUT)
        split = split_observations(run.observations, succeeded)
        return dataclasses.replace(run, observations=tuple(fit_for_classifier(split)))

    generate_spec = getattr(ecc_run, "generate_spec")
    setattr(runner, "_parse_stream_json", parse_and_note_successes)
    setattr(ecc_run, "run_scenario", run_and_split)
    setattr(ecc_run, "generate_spec", lambda skill, model: pinned_spec(spec_path, lambda: generate_spec(skill, model=model), parse_spec))


def confine_ecc_modules(modules: Mapping[str, object], confined: object) -> None:
    """Every imported ECC module that runs processes runs them confined, including one ECC adds later."""
    for name, module in modules.items():
        if name.startswith("scripts.") and hasattr(module, "subprocess"):
            setattr(module, "subprocess", confined)


def install_setup(runner: object, run: Callable[..., object], snapshot: bytes, deps: Path | None) -> None:
    """ECC's sandbox setup, replaced: the scenario's commands run confined, then the repository is
    seeded and committed as main."""
    def setup_with_repository(sandbox_dir: Path, scenario: object) -> None:
        setup_sandbox(sandbox_dir, getattr(scenario, "setup_commands", ()), run, lambda message: print(message, file=sys.stderr))
        seed_sandbox(sandbox_dir, snapshot, deps)
        commit_baseline(sandbox_dir, run)

    setattr(runner, "_setup_sandbox", setup_with_repository)


def install_generation_retry(ecc_run: object, context_dir: Path, errors: tuple[type[BaseException], ...]) -> None:
    """Scenario generation sees the repository context, and is retried when the generator model
    returns YAML that does not parse (an unquoted colon)."""
    generate_scenarios = getattr(ecc_run, "generate_scenarios")
    setattr(ecc_run, "generate_scenarios", lambda skill, spec_yaml, model: retry(
        lambda: generate_scenarios(with_repo_context(Path(skill), context_dir), spec_yaml, model=model),
        attempts=3, errors=errors))


def confined_runner(work: Path, deps: Path, network: Network) -> ConfinedSubprocess:
    """subprocess.run, but every command runs under bubblewrap with a fresh login copy."""
    claude_binary = Path(shutil.which("claude") or "claude").resolve()
    (work / "calls").mkdir()

    def wrap(command: list[str], cwd: Path) -> list[str]:
        layout = Layout(home=Path.home(), claude_home=fresh_claude_home(Path.home() / ".claude", work),
                        claude_binary=claude_binary, plugins=Path.home() / ".claude" / "plugins", deps=deps)
        return confine(command, cwd=cwd, layout=layout, network=network)

    return ConfinedSubprocess(subprocess.run, wrap, work / "calls")


def run_confined(args: argparse.Namespace, snapshot: bytes, deps: Path, work: Path, network: Network) -> None:
    """Isolate the environment, confine ECC's subprocesses, patch its setup, grading and generation, and run it."""
    (work / "gh").mkdir()
    caller_env = dict(os.environ)
    os.environ.clear()
    os.environ.update(isolated_env(caller_env, work / "gh"))
    os.environ.update(proxy_env(FORWARD_PORT))
    sys.dont_write_bytecode = True  # no __pycache__ in the plugin cache
    sys.path.insert(0, str(SKILL_COMPLY))
    import yaml  # ECC's own dependency, in the venv
    import scripts.run as ecc_run  # ECC is importable only from here
    import scripts.runner as runner
    from scripts.parser import parse_spec

    confined = confined_runner(work, deps, network)
    require_confinement(lambda: shutil.which("bwrap"), lambda: confined.run(["true"]).returncode == 0)
    confine_ecc_modules(sys.modules, confined)
    install_setup(runner, confined.run, snapshot, deps)
    name = report_name(args.target)
    wire_grading(ecc_run, runner, parse_spec, spec_path=SPECS / f"{name}.json",
                 keep_stream=stream_keeper(STREAMS / f"{time.strftime('%Y%m%d-%H%M%S')}-{name}"))
    install_generation_retry(ecc_run, work / "context", errors=(yaml.YAMLError, KeyError, TypeError))
    os.chdir(REPO)
    sys.argv = ["skill-comply", *ecc_arguments(args.target, model=args.model, gen_model=args.gen_model, dry_run=args.dry_run)]
    ecc_run.main()


if __name__ == "__main__":
    main(sys.argv[1:])
