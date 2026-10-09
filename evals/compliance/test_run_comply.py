"""Tests for run_comply.py: the sandbox seeding and isolation, without calling ECC or claude."""

import io
import json
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
    def test_repository_tooling_replaces_a_scenarios_copy_and_other_scenario_files_are_kept(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            (sandbox / "package.json").write_text('{"scripts": {"pr": "echo stub"}}\n')
            (sandbox / ".claude").mkdir()
            (sandbox / ".claude/settings.json").write_text("{}\n")
            (sandbox / "src").mkdir()
            (sandbox / "src/app.js").write_text("scenario code\n")
            run_comply.seed_sandbox(sandbox, tar_of({"package.json": "real\n", ".claude/settings.json": "real\n",
                                                    "src/app.js": "repo code\n", "CLAUDE.md": "repo\n"}))
            self.assertEqual((sandbox / "package.json").read_text(), "real\n")
            self.assertEqual((sandbox / ".claude/settings.json").read_text(), "real\n")
            self.assertEqual((sandbox / "src/app.js").read_text(), "scenario code\n")
            self.assertEqual((sandbox / "CLAUDE.md").read_text(), "repo\n")

    def test_a_symlink_planted_at_a_tooling_path_is_replaced_by_the_real_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox, outside = Path(directory) / "box", Path(directory) / "outside.txt"
            sandbox.mkdir()
            outside.write_text("keep me\n")
            (sandbox / "app.js").write_text("scenario code\n")
            (sandbox / "package.json").symlink_to(outside)
            (sandbox / "CLAUDE.md").symlink_to(sandbox / "app.js")
            run_comply.seed_sandbox(sandbox, tar_of({"package.json": "real\n", "CLAUDE.md": "rules\n"}))
            self.assertFalse((sandbox / "package.json").is_symlink())
            self.assertEqual((sandbox / "package.json").read_text(), "real\n")
            self.assertEqual((sandbox / "CLAUDE.md").read_text(), "rules\n")
            self.assertEqual((sandbox / "app.js").read_text(), "scenario code\n")
            self.assertEqual(outside.read_text(), "keep me\n")

    def test_a_tooling_dir_symlinked_inside_the_sandbox_does_not_write_through(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory) / "box"
            (sandbox / "other").mkdir(parents=True)
            (sandbox / "other/x.ts").write_text("scenario code\n")
            (sandbox / "scripts").symlink_to(sandbox / "other")
            run_comply.seed_sandbox(sandbox, tar_of({"scripts/x.ts": "real\n"}))
            self.assertEqual((sandbox / "other/x.ts").read_text(), "scenario code\n")

    def test_a_tooling_dir_linked_outside_is_replaced_and_the_outside_is_left_alone(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox, outside = Path(directory) / "box", Path(directory) / "elsewhere"
            sandbox.mkdir()
            outside.mkdir()
            (outside / "x.ts").write_text("keep me\n")
            (sandbox / "scripts").symlink_to(outside)
            run_comply.seed_sandbox(sandbox, tar_of({"scripts/x.ts": "real\n"}))
            self.assertEqual((outside / "x.ts").read_text(), "keep me\n")
            self.assertEqual((sandbox / "scripts/x.ts").read_text(), "real\n")

    def test_a_hardlinked_tooling_file_is_replaced_not_written_through(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox, outside = Path(directory) / "box", Path(directory) / "outside.txt"
            sandbox.mkdir()
            outside.write_text("keep me\n")
            os.link(outside, sandbox / "package.json")
            run_comply.seed_sandbox(sandbox, tar_of({"package.json": "real\n"}))
            self.assertEqual((sandbox / "package.json").read_text(), "real\n")
            self.assertEqual(outside.read_text(), "keep me\n")

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


class Grading(unittest.TestCase):
    def test_plain_chains_split_and_anything_conditional_or_nested_stays_whole(self) -> None:
        self.assertEqual(run_comply.split_command("git add a b && git commit -m 'x && y' && npm run pr"),
                         ["git add a b", "git commit -m 'x && y'", "npm run pr"])
        self.assertEqual(run_comply.split_command("git status; git log -1\nls"), ["git status", "git log -1", "ls"])
        self.assertEqual(run_comply.split_command("cd x && npm test 2>&1 | tail &>/dev/null"), ["cd x", "npm test 2>&1 | tail &>/dev/null"])
        self.assertEqual(run_comply.split_command('echo "a; b" && ls'), ['echo "a; b"', "ls"])
        self.assertEqual(run_comply.split_command("cd x\nnpm test"), ["cd x", "npm test"])
        self.assertEqual(run_comply.split_command("ls | grep x && pwd"), ["ls | grep x", "pwd"], "a pipe is one command")
        for whole in ("cat > f <<'EOF'\na && b\nEOF\ngit add f", "npm test || echo failed", "a && $(b; c)", "a && `b; c`",
                      'echo "a \\" ; b" && ls', "find . -exec rm {} \\; && ls", "npm test # x; y", "a \\\nb && c",
                      "if true; then git commit -m x; fi", "for f in a; do echo $f; done", "(cd x; ls) && pwd", "ls -la",
                      "npm run check && git commit -m x; git status", "npm run check && git commit -m x\ngit status",
                      "a && b &", "exec a && b"):
            self.assertEqual(run_comply.split_command(whole), [whole], whole)

    def test_each_part_of_a_chained_bash_call_becomes_its_own_observation(self) -> None:
        Event = run_comply.Observation
        events = [Event(timestamp="T0001", event="tool_complete", tool="Read", session="s", input='{"file_path": "a"}', output="x"),
                  Event(timestamp="T0002", event="tool_complete", tool="Bash", session="s",
                        input=json.dumps({"command": "git add a && npm run pr"}), output="done")]
        split = run_comply.split_observations(events, succeeded={"T0002"})
        self.assertEqual([e.timestamp for e in split], ["T0001", "T0002.001", "T0002.002"])
        self.assertEqual([json.loads(e.input)["command"] for e in split[1:]], ["git add a", "npm run pr"])
        self.assertEqual({e.output for e in split[1:]}, {"done"})
        self.assertEqual(sorted(split, key=lambda e: e.timestamp), split, "the grader's sort keeps the order")

    def test_eleven_parts_keep_their_order_under_a_text_sort(self) -> None:
        Event = run_comply.Observation
        command = " && ".join(f"step{n}" for n in range(1, 12))
        split = run_comply.split_observations([Event("T0003", "tool_complete", "Bash", "s", json.dumps({"command": command, "description": "d"}), "ok")], succeeded={"T0003"})
        ordered = sorted(split, key=lambda e: e.timestamp)
        self.assertEqual([json.loads(e.input)["command"] for e in ordered], [f"step{n}" for n in range(1, 12)])
        self.assertEqual(json.loads(ordered[0].input)["description"], "d", "other input keys are kept")

    def test_successful_calls_are_read_from_the_stream_s_error_flags_in_ecc_s_order(self) -> None:
        def use(n: int) -> str:
            return json.dumps({"type": "assistant", "message": {"content": [{"type": "tool_use", "id": f"u{n}", "name": "Bash", "input": {"command": "a && b"}}]}})

        def result(n: int, error: bool | None) -> str:
            block: dict[str, object] = {"type": "tool_result", "tool_use_id": f"u{n}", "content": "out"}
            if error is not None:
                block["is_error"] = error
            return json.dumps({"type": "user", "message": {"content": [block]}})

        stream = "\n".join([use(0), result(0, None), use(1), result(1, True), use(2), result(2, False), use(3), "not json"])
        self.assertEqual(run_comply.successful_calls(stream), {"T0002"}, "no flag, an error, or no result is not a success")

    def test_a_refused_or_unfinished_call_is_not_split(self) -> None:
        Event = run_comply.Observation
        refused = Event("T0007", "tool_complete", "Bash", "s", json.dumps({"command": "git add -A && git commit -m x && git push origin main"}),
                        "Permission to use Bash has been denied.")
        self.assertEqual(run_comply.split_observations([refused], succeeded={"T0001"}), [refused])
        self.assertEqual(len(run_comply.split_observations([refused], succeeded={"T0007"})), 3)
        for whole in ("exit 0; git commit -m x", "npm test && exit 0 && git push", "eval 'a' && b", "source x && b", ". x && b", "kill $$ && b"):
            self.assertEqual(run_comply.split_command(whole), [whole], whole)

    def test_a_failed_call_is_not_split_so_steps_that_never_ran_get_no_credit(self) -> None:
        Event = run_comply.Observation
        failed = Event("T0004", "tool_complete", "Bash", "s", json.dumps({"command": "npm run check && git commit -m x"}), "Exit code 1\nlint failed")
        self.assertEqual(run_comply.split_observations([failed], succeeded={"T0004"}), [failed])
        odd = Event("T0005", "tool_complete", "Bash", "s", None, "x")  # type: ignore[arg-type]
        self.assertEqual(run_comply.split_observations([odd], succeeded={"T0005"}), [odd])


class Retry(unittest.TestCase):
    def test_a_malformed_generation_is_retried_and_the_last_error_is_raised(self) -> None:
        calls: list[int] = []

        def flaky() -> str:
            calls.append(1)
            if len(calls) < 3:
                raise ValueError("mapping values are not allowed here")
            return "ok"

        self.assertEqual(run_comply.retry(flaky, attempts=3, errors=(ValueError,)), "ok")
        calls.clear()
        with self.assertRaises(ValueError):
            run_comply.retry(lambda: (calls.append(1), int("x"))[1], attempts=2, errors=(ValueError,))
        self.assertEqual(len(calls), 2)


class Context(unittest.TestCase):
    def test_the_scenario_generator_is_told_what_this_repository_is(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "SKILL.md"
            target.write_text("# A skill\n")
            with_context = run_comply.with_repo_context(target, Path(directory))
            text = with_context.read_text()
            self.assertTrue(text.startswith("# A skill\n"))
            for fact in ("TypeScript", "node:test", "npm test", "no pip", "not Python", "no network"):
                self.assertIn(fact, text)
            self.assertEqual(target.read_text(), "# A skill\n", "the real file is untouched")


class ScenarioSetup(unittest.TestCase):
    def test_setup_commands_run_through_a_shell_so_redirection_creates_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory) / "box"
            (sandbox / "stale").mkdir(parents=True)
            messages: list[str] = []
            commands = ("mkdir -p src", "printf 'def f():\\n    return 1\\n' > src/f.py",
                        "cat > notes.md <<'EOF'\nhello\nEOF", "cd src && touch inside.txt", "false",
                        "printf '---\\nname: x\\n---\\n' > front.md", "printf -- '---\\nok\\n' > dashed.md",
                        "printf '%s-%s\\n' a b > plain.txt")
            run_comply.setup_sandbox(sandbox, commands, lambda args, **kw: subprocess.run(args, **kw), messages.append)
            self.assertFalse((sandbox / "stale").exists(), "a reused sandbox starts empty")
            self.assertTrue((sandbox / ".git").is_dir())
            self.assertEqual((sandbox / "src/f.py").read_text(), "def f():\n    return 1\n")
            self.assertEqual((sandbox / "notes.md").read_text(), "hello\n")
            self.assertTrue((sandbox / "src/inside.txt").exists())
            self.assertEqual((sandbox / "front.md").read_text(), "---\nname: x\n---\n", "a format starting with --- is text, not an option")
            self.assertEqual((sandbox / "dashed.md").read_text(), "---\nok\n", "a command that already passes -- is unchanged")
            self.assertEqual((sandbox / "plain.txt").read_text(), "a-b\n")
            self.assertEqual(len(messages), 1)
            self.assertIn("false", messages[0], "a failed setup command is reported, not skipped silently")


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
        self.assertEqual(args[0], ".claude/rules/zeem/branch-and-merge.md", "the report names the target without a home path")
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
