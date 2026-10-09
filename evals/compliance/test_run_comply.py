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

    def test_links_the_shared_dependencies_so_the_checks_can_run(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox, deps = Path(directory) / "box", Path(directory) / "deps" / "node_modules"
            sandbox.mkdir()
            deps.mkdir(parents=True)
            run_comply.seed_sandbox(sandbox, tar_of({"package.json": "{}\n"}), deps=deps)
            self.assertEqual((sandbox / "node_modules").resolve(), deps.resolve())

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


class Baseline(unittest.TestCase):
    def test_commits_the_snapshot_as_main_with_origin_main_and_ignores_the_dependency_link(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox, deps = Path(directory) / "box", Path(directory) / "deps"
            sandbox.mkdir()
            deps.mkdir()
            env = run_comply.isolated_env(dict(os.environ), Path(directory) / "gh")
            run = lambda args, **kw: subprocess.run(args, env=env, **kw)
            run(["git", "init", "--quiet"], cwd=sandbox, check=True)
            run_comply.seed_sandbox(sandbox, tar_of({"CLAUDE.md": "c\n"}), deps=deps)
            run_comply.commit_baseline(sandbox, run)
            git = lambda *args: subprocess.run(["git", *args], cwd=sandbox, env=env, check=True, capture_output=True, text=True).stdout.strip()
            self.assertEqual(git("symbolic-ref", "--short", "HEAD"), "main")
            self.assertEqual(git("rev-parse", "HEAD"), git("rev-parse", "refs/remotes/origin/main"))
            self.assertEqual(git("ls-files"), "CLAUDE.md")
            self.assertEqual(git("status", "--porcelain"), "")

    def test_runs_through_the_given_runner_and_disarms_config_a_setup_command_planted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            calls: list[list[str]] = []
            run_comply.commit_baseline(sandbox, lambda args, **kw: calls.append(list(args)))
            self.assertTrue(calls, "every step goes through the runner, which confines it")
            for call in calls:
                if call[0] == "git":
                    self.assertIn("core.fsmonitor=", call)
                    self.assertIn("core.hooksPath=/dev/null", call)


class Cleanup(unittest.TestCase):
    def test_removes_the_work_dir_even_where_a_sandbox_made_a_folder_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory) / "work"
            locked = work / "claude-home-x"
            locked.mkdir(parents=True)
            (locked / ".credentials.json").write_text("{}\n")
            locked.chmod(0o500)
            run_comply.remove_tree(work)
            self.assertFalse(work.exists(), "the login copy is gone")


class Preflight(unittest.TestCase):
    def test_refuses_to_run_without_a_working_bwrap(self) -> None:
        with self.assertRaises(SystemExit) as raised:
            run_comply.require_confinement(lambda: None, lambda: False)
        self.assertEqual(raised.exception.code, 2)
        with self.assertRaises(SystemExit):
            run_comply.require_confinement(lambda: "/usr/bin/bwrap", lambda: False)
        run_comply.require_confinement(lambda: "/usr/bin/bwrap", lambda: True)


class IsolatedEnvironment(unittest.TestCase):
    def test_keeps_only_allowlisted_variables_and_cuts_off_credentials(self) -> None:
        base = {
            "PATH": "/bin", "HOME": "/nonexistent-home", "LANG": "C.UTF-8", "LC_ALL": "C", "ANTHROPIC_API_KEY": "k", "TMPDIR": "/tmp/claude-1000",
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
        self.assertEqual(env["TMPDIR"], "/tmp", "the private /tmp, not a path outside the confinement")
        self.assertEqual(env["GIT_CONFIG_GLOBAL"], os.devnull)
        self.assertEqual(env["GIT_CONFIG_NOSYSTEM"], "1")
        self.assertEqual(env["GIT_TERMINAL_PROMPT"], "0")
        self.assertEqual(env["GIT_AUTHOR_EMAIL"], "sandbox@example.invalid")
        self.assertEqual(base["GH_TOKEN"], "t", "the caller's environment is not changed")


class FreshClaudeHome(unittest.TestCase):
    def test_each_call_gets_its_own_copy_holding_only_the_login(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source, base = Path(directory) / "real", Path(directory) / "work"
            source.mkdir()
            (source / ".credentials.json").write_text("{}\n")
            (source / "settings.json").write_text("{}\n")
            first, second = run_comply.fresh_claude_home(source, base), run_comply.fresh_claude_home(source, base)
            self.assertNotEqual(first, second)
            self.assertEqual(sorted(path.name for path in first.iterdir()), [".credentials.json", "plugins"])
            (first / "CLAUDE.md").write_text("planted\n")
            self.assertFalse((second / "CLAUDE.md").exists(), "one call cannot plant instructions for the next")


class Confinement(unittest.TestCase):
    def layout(self, root: Path) -> run_comply.Layout:
        for folder in ("home", "claude-home", "plugins", "deps", "work"):
            (root / folder).mkdir()
        (root / "claude").write_text("binary\n")
        return run_comply.Layout(home=root / "home", claude_home=root / "claude-home", claude_binary=root / "claude",
                                 plugins=root / "plugins", deps=root / "deps")

    def test_starts_from_an_empty_home_and_private_tmp_and_binds_only_what_claude_needs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            layout = self.layout(root)
            command = run_comply.confine(["claude", "-p", "hi"], cwd=root / "work", layout=layout)
            pairs = [command[i:i + 3] for i in range(len(command))]
            self.assertEqual(command[0], "bwrap")
            self.assertEqual(command[-4:], ["--", "claude", "-p", "hi"])
            self.assertNotIn("--dev-bind", command, "nothing is shared by default")
            self.assertIn(["--tmpfs", str(layout.home), "--bind"], pairs, "home starts empty")
            self.assertIn(["--tmpfs", "/tmp", "--tmpfs"], pairs, "a private /tmp hides session sockets")
            self.assertIn(["--bind", str(layout.claude_home), str(layout.home / ".claude")], pairs)
            self.assertIn(["--ro-bind", str(layout.plugins), str(layout.home / ".claude/plugins")], pairs)
            self.assertIn(["--ro-bind", str(layout.deps), str(layout.deps)], pairs)
            self.assertIn(["--bind", str(root / "work"), str(root / "work")], pairs, "only the working directory is writable")
            self.assertIn(["--chdir", str(root / "work"), "--unshare-pid"], pairs)
            for flag in ("--unshare-pid", "--unshare-ipc", "--new-session", "--die-with-parent"):
                self.assertIn(flag, command)
            self.assertIn(["--ro-bind", "/usr", "/usr"], pairs)
            self.assertNotIn("/run/systemd/resolve", command, "the host resolver's socket would let DNS carry data out")

    def test_with_a_network_proxy_the_namespace_has_no_network_but_the_forwarder(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            layout = self.layout(root)
            (root / "net").mkdir()
            net = run_comply.Network(directory=root / "net", python=Path("/usr/bin/python3"), port=18443)
            command = run_comply.confine(["claude", "-p", "hi"], cwd=root / "work", layout=layout, network=net)
            pairs = [command[i:i + 3] for i in range(len(command))]
            self.assertIn("--unshare-net", command)
            self.assertIn(["--ro-bind", str(root / "net"), "/comply-net"], pairs)
            tail = command[command.index("--") + 1:]
            self.assertEqual(tail, ["/usr/bin/python3", "/comply-net/netproxy.py", "forward", "/comply-net/proxy.sock", "18443", "--", "claude", "-p", "hi"])
            self.assertNotIn("--unshare-net", run_comply.confine(["true"], cwd=root / "work", layout=layout), "only when asked")

    def test_proxy_environment_points_claude_at_the_forwarder(self) -> None:
        env = run_comply.proxy_env(18443)
        self.assertEqual(env["HTTPS_PROXY"], "http://127.0.0.1:18443")
        self.assertEqual(env["https_proxy"], "http://127.0.0.1:18443")
        self.assertEqual(env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"], "1")

    def test_every_call_is_confined_in_its_own_working_directory(self) -> None:
        calls: list[tuple[list[str], dict[str, object]]] = []
        shim = run_comply.ConfinedSubprocess(lambda args, **kw: calls.append((list(args), kw)), lambda cmd, cwd: ["bwrap", str(cwd), "--", *cmd], Path("/tmp/default-work"))
        shim.run(["claude", "-p", "x"], capture_output=True)
        shim.run(["git", "init"], cwd=Path("/tmp/box"))
        self.assertEqual(calls[0][0], ["bwrap", "/tmp/default-work", "--", "claude", "-p", "x"])
        self.assertEqual(calls[1][0], ["bwrap", "/tmp/box", "--", "git", "init"])
        self.assertEqual(calls[1][1]["cwd"], Path("/tmp/box"))
        self.assertIs(shim.PIPE, subprocess.PIPE, "everything else is the real subprocess module")


class RepositorySnapshot(unittest.TestCase):
    def test_holds_committed_files_but_not_the_reports_or_the_seeds(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            git = lambda *args: subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, env=run_comply.isolated_env(dict(os.environ), repo / "gh"))
            git("init", "--quiet")
            (repo / "CLAUDE.md").write_text("constitution\n")
            (repo / "evals/compliance/reports").mkdir(parents=True)
            (repo / "evals/compliance/reports/old.md").write_text("an old score\n")
            (repo / "evals/compliance/seeds.md").write_text("expected behaviour\n")
            (repo / "evals/compliance/run_comply.py").write_text("# wrapper\n")
            git("add", "--all")
            git("commit", "--quiet", "-m", "base")
            with tarfile.open(fileobj=io.BytesIO(run_comply.repo_snapshot(repo))) as archive:
                names = archive.getnames()
            self.assertIn("CLAUDE.md", names)
            self.assertIn("evals/compliance/run_comply.py", names, "npm run check needs the wrapper's tests")
            self.assertFalse(any(name.startswith("evals/compliance/reports") for name in names))
            self.assertNotIn("evals/compliance/seeds.md", names, "the expected behaviours are not handed to the agent")


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
