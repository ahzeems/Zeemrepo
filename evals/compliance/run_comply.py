"""Run ECC skill-comply with this repository loaded into every scenario sandbox.

ECC's runner starts each scenario in an empty `git init` directory, so on its own it measures
Claude's default behaviour, not this repository's rules. This wrapper seeds each sandbox with a
snapshot of the committed repository (CLAUDE.md, .claude/, scripts and hooks; never evals/, so
earlier scores cannot leak into a run) after ECC's own setup, without overwriting the scenario's
files. Scenarios run with GitHub and git credentials cut off: a generated "competing" prompt may
ask the agent to push or merge, and the run must not be able to.

Usage (from the repository root, with the venv described in evals/compliance/README.md):
  ~/.cache/zeemrepo/comply-venv/bin/python evals/compliance/run_comply.py <rule-or-skill.md> [--dry-run]
"""

from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import tarfile
import tempfile
from collections.abc import Mapping
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REPORTS = REPO / "evals" / "compliance" / "reports"
# The private runner function this wraps is ECC's, so the wrapper is pinned to the version it
# was written against (the marketplace pin in .claude/settings.json).
ECC_VERSION = "2.2.3"
SKILL_COMPLY = Path.home() / ".claude/plugins/cache/ecc/ecc" / ECC_VERSION / "skills/skill-comply"
DROPPED = ("GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN")
SANDBOX_AUTHOR = {
    "GIT_AUTHOR_NAME": "Compliance Sandbox", "GIT_AUTHOR_EMAIL": "sandbox@example.invalid",
    "GIT_COMMITTER_NAME": "Compliance Sandbox", "GIT_COMMITTER_EMAIL": "sandbox@example.invalid",
}


def isolated_env(base: Mapping[str, str], gh_config_dir: Path) -> dict[str, str]:
    """A copy of `base` with no GitHub token, no git routing or user config, and a fixed author."""
    env = {key: value for key, value in base.items() if key not in DROPPED and not key.startswith("GIT_")}
    env.update(SANDBOX_AUTHOR)
    env.update({
        "GH_CONFIG_DIR": str(gh_config_dir),
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
    })
    return env


def repo_snapshot(repo: Path) -> bytes:
    """The committed tree at HEAD as a tar archive, without evals/."""
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    return subprocess.run(
        ["git", "archive", "--format=tar", "HEAD", "--", ".", ":(exclude)evals"],
        cwd=repo, env=env, check=True, capture_output=True,
    ).stdout


def seed_sandbox(sandbox: Path, snapshot: bytes) -> None:
    """Extract the snapshot into the sandbox, keeping files the scenario already created."""
    root = sandbox.resolve()
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
        for member in archive.getmembers():
            target = (root / member.name).resolve()
            if not target.is_relative_to(root) or target == root or target.exists():
                continue
            archive.extract(member, root, filter="data")


def ecc_arguments(target: Path, *, model: str, gen_model: str, dry_run: bool) -> list[str]:
    """Arguments for ECC's scripts.run; a real run writes its report under evals/compliance/reports."""
    args = [str(target.resolve()), "--model", model, "--gen-model", gen_model]
    if dry_run:
        return [*args, "--dry-run"]
    name = target.parent.name if target.stem == "SKILL" else target.stem
    return [*args, "--output", str(REPORTS / f"{name}.md")]


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
    caller_env = dict(os.environ)
    os.environ.clear()
    os.environ.update(isolated_env(caller_env, Path(tempfile.mkdtemp(prefix="run-comply-gh-"))))
    sys.dont_write_bytecode = True  # no __pycache__ in the plugin cache
    sys.path.insert(0, str(SKILL_COMPLY))
    import scripts.run as ecc_run  # ECC is importable only from here
    import scripts.runner as runner

    original = runner._setup_sandbox

    def setup_with_repository(sandbox_dir: Path, scenario: object) -> None:
        original(sandbox_dir, scenario)
        seed_sandbox(sandbox_dir, snapshot)

    runner._setup_sandbox = setup_with_repository
    sys.argv = ["skill-comply", *ecc_arguments(args.target, model=args.model, gen_model=args.gen_model, dry_run=args.dry_run)]
    ecc_run.main()


if __name__ == "__main__":
    main(sys.argv[1:])
