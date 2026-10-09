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

    def test_skips_links_instead_of_aborting_the_run(self) -> None:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            link = tarfile.TarInfo("escape")
            link.type = tarfile.SYMTYPE
            link.linkname = "/etc"
            archive.addfile(link)
            data = b"x\n"
            info = tarfile.TarInfo("ok.md")
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        with tempfile.TemporaryDirectory() as directory:
            run_comply.seed_sandbox(Path(directory), buffer.getvalue())
            self.assertFalse((Path(directory) / "escape").exists())
            self.assertTrue((Path(directory) / "ok.md").exists())

    def test_refuses_members_that_would_land_outside_the_sandbox(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory) / "box"
            sandbox.mkdir()
            run_comply.seed_sandbox(sandbox, tar_of({"../escaped.md": "x\n", "/abs.md": "x\n", "ok.md": "x\n"}))
            self.assertFalse((Path(directory) / "escaped.md").exists())
            self.assertTrue((sandbox / "ok.md").exists())


class IsolatedEnvironment(unittest.TestCase):
    def test_keeps_only_allowlisted_variables_and_cuts_off_credentials(self) -> None:
        base = {
            "PATH": "/bin", "HOME": "/nonexistent-home", "LANG": "C.UTF-8", "LC_ALL": "C", "ANTHROPIC_API_KEY": "k",
            "GH_TOKEN": "t", "GITHUB_TOKEN": "t", "GIT_DIR": "/real/.git", "SSH_AUTH_SOCK": "/s", "NPM_TOKEN": "n",
            "AWS_SECRET_ACCESS_KEY": "a", "CLAUDECODE": "1", "CLAUDE_CODE_MESSAGING_TOKEN": "m", "DBUS_SESSION_BUS_ADDRESS": "d",
        }
        env = run_comply.isolated_env(base, Path("/tmp/empty-gh"))
        for key in ("GH_TOKEN", "GITHUB_TOKEN", "GIT_DIR", "SSH_AUTH_SOCK", "NPM_TOKEN", "AWS_SECRET_ACCESS_KEY",
                    "CLAUDECODE", "CLAUDE_CODE_MESSAGING_TOKEN", "DBUS_SESSION_BUS_ADDRESS"):
            self.assertNotIn(key, env, key)
        for key in ("PATH", "HOME", "LANG", "LC_ALL", "ANTHROPIC_API_KEY"):
            self.assertEqual(env[key], base[key], key)
        self.assertEqual(env["GH_CONFIG_DIR"], "/tmp/empty-gh")
        self.assertEqual(env["GIT_CONFIG_GLOBAL"], os.devnull)
        self.assertEqual(env["GIT_CONFIG_NOSYSTEM"], "1")
        self.assertEqual(env["GIT_TERMINAL_PROMPT"], "0")
        self.assertEqual(env["GIT_AUTHOR_EMAIL"], "sandbox@example.invalid")
        self.assertEqual(base["GH_TOKEN"], "t", "the caller's environment is not changed")


class Confinement(unittest.TestCase):
    def test_masks_every_credential_and_repository_path_that_exists(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            for folder in (".config/gh", ".ssh", "Github", ".claude/projects"):
                (home / folder).mkdir(parents=True)
            (home / ".git-credentials").write_text("x\n")
            repo = home / "repo"
            repo.mkdir()
            command = run_comply.confine(["claude", "-p", "hi"], home=home, repo=repo, uid=4242)
            self.assertEqual(command[0], "bwrap")
            self.assertEqual(command[-3:], ["claude", "-p", "hi"])
            masked = [command[i + 1] for i, arg in enumerate(command) if arg == "--tmpfs"]
            for folder in (".config/gh", ".ssh", "Github", ".claude/projects"):
                self.assertIn(str(home / folder), masked)
            self.assertIn(str(repo), masked)
            self.assertNotIn(str(home / ".aws"), masked, "a path that does not exist is not mounted over")
            nulled = [command[i + 2] for i, arg in enumerate(command) if arg == "--ro-bind" and command[i + 1] == "/dev/null"]
            self.assertEqual(nulled, [str(home / ".git-credentials")])

    def test_only_claude_calls_are_confined(self) -> None:
        calls: list[list[str]] = []
        shim = run_comply.ConfinedSubprocess(lambda args, **_kw: calls.append(list(args)), lambda cmd: ["bwrap", "--", *cmd])
        shim.run(["claude", "-p", "x"], capture_output=True)
        shim.run(["git", "init"], cwd="/tmp")
        self.assertEqual(calls, [["bwrap", "--", "claude", "-p", "x"], ["git", "init"]])
        self.assertIs(shim.PIPE, subprocess.PIPE, "everything else is the real subprocess module")


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
        args = run_comply.ecc_arguments(run_comply.REPO / ".claude/rules/zeem/branch-and-merge.md", model="sonnet", gen_model="haiku", dry_run=False)
        self.assertIn("--output", args)
        self.assertTrue(args[args.index("--output") + 1].endswith("evals/compliance/reports/rules-zeem-branch-and-merge.md"))

    def test_report_names_come_from_the_path_so_they_never_collide_and_a_dry_run_writes_none(self) -> None:
        args = run_comply.ecc_arguments(run_comply.REPO / ".claude/skills/write-guard/SKILL.md", model="sonnet", gen_model="haiku", dry_run=False)
        self.assertTrue(args[args.index("--output") + 1].endswith("reports/skills-write-guard.md"))
        ecc_testing = run_comply.ecc_arguments(run_comply.REPO / ".claude/rules/ecc/python/testing.md", model="sonnet", gen_model="haiku", dry_run=False)
        self.assertTrue(ecc_testing[ecc_testing.index("--output") + 1].endswith("reports/rules-ecc-python-testing.md"), "same-named rules do not collide")
        self.assertNotIn("--output", run_comply.ecc_arguments(run_comply.REPO / "x.md", model="sonnet", gen_model="haiku", dry_run=True))

    def test_the_pinned_ecc_version_is_required(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(SystemExit) as raised:
                run_comply.require_skill_comply(Path(directory) / "missing")
            self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
