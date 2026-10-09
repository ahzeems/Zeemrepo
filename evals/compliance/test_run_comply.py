"""Tests for run_comply.py: the sandbox seeding and isolation, without calling ECC or claude."""

import io
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

import run_comply


def tar_of(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for name, text in files.items():
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


class SeedSandbox(unittest.TestCase):
    def test_copies_the_repository_without_overwriting_the_scenario_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            (sandbox / "CLAUDE.md").write_text("scenario's own file\n")
            run_comply.seed_sandbox(sandbox, tar_of({"CLAUDE.md": "repo\n", ".claude/rules/zeem/a.md": "rule\n"}))
            self.assertEqual((sandbox / "CLAUDE.md").read_text(), "scenario's own file\n")
            self.assertEqual((sandbox / ".claude/rules/zeem/a.md").read_text(), "rule\n")

    def test_refuses_members_that_would_land_outside_the_sandbox(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory) / "box"
            sandbox.mkdir()
            run_comply.seed_sandbox(sandbox, tar_of({"../escaped.md": "x\n", "/abs.md": "x\n", "ok.md": "x\n"}))
            self.assertFalse((Path(directory) / "escaped.md").exists())
            self.assertTrue((sandbox / "ok.md").exists())


class IsolatedEnvironment(unittest.TestCase):
    def test_cuts_off_github_and_git_credentials_and_hook_routing(self) -> None:
        base = {"PATH": "/bin", "GH_TOKEN": "t", "GITHUB_TOKEN": "t", "GH_ENTERPRISE_TOKEN": "t", "GIT_DIR": "/real/.git", "HOME": "/nonexistent-home"}
        env = run_comply.isolated_env(base, Path("/tmp/empty-gh"))
        for key in ("GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GIT_DIR"):
            self.assertNotIn(key, env)
        self.assertEqual(env["GH_CONFIG_DIR"], "/tmp/empty-gh")
        self.assertEqual(env["GIT_CONFIG_GLOBAL"], os.devnull)
        self.assertEqual(env["GIT_CONFIG_NOSYSTEM"], "1")
        self.assertEqual(env["GIT_TERMINAL_PROMPT"], "0")
        self.assertEqual(env["GIT_AUTHOR_EMAIL"], "sandbox@example.invalid")
        self.assertEqual(env["PATH"], "/bin")
        self.assertEqual(base["GH_TOKEN"], "t", "the caller's environment is not changed")


class RepositorySnapshot(unittest.TestCase):
    def test_holds_committed_files_but_not_the_evals_folder(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            git = lambda *args: subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, env=run_comply.isolated_env(dict(os.environ), repo / "gh"))
            git("init", "--quiet")
            (repo / "CLAUDE.md").write_text("constitution\n")
            (repo / "evals/compliance/reports").mkdir(parents=True)
            (repo / "evals/compliance/reports/old.md").write_text("an old score\n")
            git("add", "--all")
            git("commit", "--quiet", "-m", "base")
            with tarfile.open(fileobj=io.BytesIO(run_comply.repo_snapshot(repo))) as archive:
                names = archive.getnames()
            self.assertIn("CLAUDE.md", names)
            self.assertFalse(any(name.startswith("evals") for name in names))


class Arguments(unittest.TestCase):
    def test_a_real_run_writes_its_report_under_evals_compliance_reports(self) -> None:
        args = run_comply.ecc_arguments(Path(".claude/rules/zeem/branch-and-merge.md"), model="sonnet", gen_model="haiku", dry_run=False)
        self.assertIn("--output", args)
        self.assertTrue(args[args.index("--output") + 1].endswith("evals/compliance/reports/branch-and-merge.md"))

    def test_a_skill_report_is_named_after_its_folder_and_a_dry_run_writes_none(self) -> None:
        args = run_comply.ecc_arguments(Path(".claude/skills/write-guard/SKILL.md"), model="sonnet", gen_model="haiku", dry_run=False)
        self.assertTrue(args[args.index("--output") + 1].endswith("reports/write-guard.md"))
        self.assertNotIn("--output", run_comply.ecc_arguments(Path("x.md"), model="sonnet", gen_model="haiku", dry_run=True))

    def test_the_pinned_ecc_version_is_required(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(SystemExit) as raised:
                run_comply.require_skill_comply(Path(directory) / "missing")
            self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
