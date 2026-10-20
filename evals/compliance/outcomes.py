"""Outcome checks and run records for compliance runs.

skill-comply grades whether an agent followed the steps of a rule or skill; it does not say whether the
task came out right. This module adds that second measure. Each target can pin outcome checks beside its
spec (`specs/<target>.outcomes.json`, which never reaches a sandbox), and after every scenario the
wrapper runs them in the scenario's sandbox and writes one record per attempt: the outcome, the wall
time, and what the session's own result event reports (turns, tokens, and a list-price cost estimate,
which is not a charge). Failed attempts are recorded too, so a retry never hides one.

Usage: python3 evals/compliance/outcomes.py table <records.jsonl>
"""

from __future__ import annotations

import dataclasses
import json
import platform
import subprocess
import sys
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path

KINDS = ("correctness", "safety")
CHECK_TIMEOUT = 600


@dataclasses.dataclass(frozen=True)
class Check:
    name: str
    kind: str
    argv: tuple[str, ...]
    exit: int


def _check(raw: object) -> Check:
    if not isinstance(raw, dict):
        raise ValueError(f"an outcome check is an object, not {raw!r}")
    name, kind, argv, code = raw.get("name"), raw.get("kind"), raw.get("argv"), raw.get("exit")
    if not isinstance(name, str) or not name:
        raise ValueError(f"an outcome check needs a name: {raw!r}")
    if kind not in KINDS:
        raise ValueError(f"{name}: kind must be one of {KINDS}")
    if not isinstance(argv, list) or not argv or not all(isinstance(part, str) for part in argv):
        raise ValueError(f"{name}: argv must be a non-empty list of strings")
    if not isinstance(code, int) or isinstance(code, bool):
        raise ValueError(f"{name}: exit must be an integer")
    return Check(name, kind, tuple(argv), code)


def load_checks(path: Path) -> tuple[Check, ...]:
    """The pinned checks at `path`; none when the target has no file, so its outcome stays unknown."""
    if not path.exists():
        return ()
    document = json.loads(path.read_text())
    if not isinstance(document, list):
        raise ValueError(f"{path}: outcome checks are a JSON list")
    return tuple(_check(raw) for raw in document)


def run_checks(checks: Sequence[Check], sandbox: Path, run: Callable[..., subprocess.CompletedProcess[str]]) -> list[dict[str, object]]:
    """Each check run in `sandbox`: passed only on its expected exit; a check that cannot run is an error."""
    results: list[dict[str, object]] = []
    for check in checks:
        try:
            done = run(list(check.argv), cwd=sandbox, capture_output=True, text=True, timeout=CHECK_TIMEOUT)
        except (OSError, subprocess.SubprocessError) as error:
            results.append({"name": check.name, "kind": check.kind, "status": "error", "detail": str(error)})
            continue
        status = "passed" if done.returncode == check.exit else "failed"
        results.append({"name": check.name, "kind": check.kind, "status": status, "exit": done.returncode})
    return results


def _events(stream: str) -> Iterable[dict[str, object]]:
    for line in stream.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict):
            yield event


def _mapping(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def session_result(stream: str) -> dict[str, object]:
    """What the session's last result event reports. The stream format is internal to Claude Code, so a
    missing event or field is UNKNOWN, never zero."""
    events = list(_events(stream))
    result = next((event for event in reversed(events) if event.get("type") == "result"), None)
    if result is None:
        return {"result": "UNKNOWN"}
    usage = _mapping(result.get("usage"))
    init = next((event for event in events if event.get("type") == "system" and event.get("subtype") == "init"), {})
    return {
        "subtype": result.get("subtype"), "is_error": result.get("is_error"), "num_turns": result.get("num_turns"),
        "duration_ms": result.get("duration_ms"), "model": init.get("model"),
        "tokens": {"input": usage.get("input_tokens"), "output": usage.get("output_tokens"),
                   "cache_read": usage.get("cache_read_input_tokens"), "cache_creation": usage.get("cache_creation_input_tokens")},
        "cost_estimate_usd": result.get("total_cost_usd"),
    }


def run_context(*, model: str, gen_model: str, repo: Path, ecc: str, git: Sequence[str],
                run: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run) -> dict[str, object]:
    """What a result depends on, recorded with every attempt: the revision (and whether the tree was
    dirty), the harness, the models, the ECC pin and the host. `git` is the command prefix, so the host's
    git runs with the same disarmed config as the sandbox's. A value that cannot be read is UNKNOWN."""
    def read(argv: list[str], cwd: Path | None = None) -> str:
        try:
            done = run(argv, cwd=cwd, capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.SubprocessError):
            return "UNKNOWN"
        return done.stdout.strip() if done.returncode == 0 else "UNKNOWN"

    status = read([*git, "status", "--porcelain"], repo)
    return {
        "revision": read([*git, "rev-parse", "HEAD"], repo), "dirty": "UNKNOWN" if status == "UNKNOWN" else status != "",
        "claude_version": read(["claude", "--version"]), "model": model, "gen_model": gen_model,
        "ecc": ecc, "host": f"{platform.system()} {platform.release()} {platform.machine()}",
    }


Observe = Callable[[object, "Path | None", str, float, "BaseException | None"], None]


def recorder(checks: Sequence[Check], run: Callable[..., subprocess.CompletedProcess[str]],
             write: Callable[[dict[str, object]], None], *, context: dict[str, object]) -> Observe:
    """An observer for run_comply.wire_grading: one record per attempt, numbered per scenario."""
    attempts: Counter[str] = Counter()

    def observe(scenario: object, sandbox: Path | None, stream: str, elapsed: float, error: BaseException | None) -> None:
        scenario_id = str(getattr(scenario, "id", scenario))
        attempts[scenario_id] += 1
        write({
            "scenario": scenario_id, "attempt": attempts[scenario_id], "error": None if error is None else str(error),
            "elapsed_s": round(elapsed, 1), "outcome": [] if sandbox is None else run_checks(checks, sandbox, run),
            "session": session_result(stream), "context": context,
        })

    return observe


def jsonl_writer(path: Path) -> Callable[[dict[str, object]], None]:
    """Append records to `path`, one JSON object per line, readable only by the owner."""
    def write(record: dict[str, object]) -> None:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        path.touch(mode=0o600)
        path.chmod(0o600)  # touch sets the mode only when it creates the file
        with path.open("a") as handle:
            handle.write(json.dumps(record) + "\n")

    return write


def _score(outcome: Sequence[object], kind: str) -> str:
    of_kind = [_mapping(item) for item in outcome if _mapping(item).get("kind") == kind]
    if not of_kind:
        return "none"
    return f"{sum(item.get('status') == 'passed' for item in of_kind)}/{len(of_kind)}"


def _tokens(session: dict[str, object]) -> str:
    tokens = _mapping(session.get("tokens"))
    if tokens.get("input") is None:
        return "UNKNOWN"
    cache = sum(value for value in (tokens.get("cache_read"), tokens.get("cache_creation")) if isinstance(value, int))
    return f"{tokens['input']}/{tokens.get('output')}/{cache}"


def _cell(value: object) -> str:
    return " ".join(str(value).split()).replace("|", "\\|")


def _row(record: dict[str, object]) -> str:
    session = _mapping(record.get("session"))
    raw_outcome = record.get("outcome")
    outcome: list[object] = raw_outcome if isinstance(raw_outcome, list) else []
    failed = record.get("error") is not None
    run = f"error: {record['error']}" if failed else "ok"
    # A failed attempt was never checked, which is not the same as a target with no checks.
    scores = ["UNKNOWN", "UNKNOWN"] if failed else [_score(outcome, "correctness"), _score(outcome, "safety")]
    cost = session.get("cost_estimate_usd")
    cells = [record.get("scenario"), record.get("attempt"), run, *scores,
             session.get("num_turns", "UNKNOWN"), record.get("elapsed_s"), _tokens(session), "UNKNOWN" if cost is None else cost]
    return "| " + " | ".join(_cell(cell) for cell in cells) + " |"


def table(records: Sequence[dict[str, object]]) -> str:
    """Markdown: one row per attempt. Compliance stays in skill-comply's report; this table is the outcome."""
    head = ["Scenario", "Attempt", "Run", "Correctness", "Safety", "Turns", "Wall s", "Tokens in/out/cache", "List-price estimate (USD)"]
    lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head), *(_row(record) for record in records)]
    note = ("\nThe estimate is what Claude Code reports at list price; it is not a charge, and subscription use "
            "and actual charges are not recorded here.")
    return "\n".join(lines) + "\n" + note + "\n"


def main(argv: Sequence[str]) -> int:
    if len(argv) != 2 or argv[0] != "table":
        print((__doc__ or "").strip().splitlines()[-1], file=sys.stderr)
        return 2
    try:
        records = [json.loads(line) for line in Path(argv[1]).read_text().splitlines() if line.strip()]
    except (OSError, ValueError) as error:
        print(f"outcomes: cannot read {argv[1]}: {error}", file=sys.stderr)
        return 2
    print(table(records), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
