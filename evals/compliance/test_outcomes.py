"""Tests for outcomes.py: outcome checks, run records and the results table, without calling claude."""

import dataclasses
import inspect
import io
import json
import subprocess
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import outcomes
import run_comply


def result_line(**fields: object) -> str:
    return json.dumps({"type": "result", **fields})


STREAM = "\n".join([
    json.dumps({"type": "system", "subtype": "init", "model": "claude-sonnet-5-5"}),
    json.dumps({"type": "assistant", "message": {"usage": {"input_tokens": 3}}}),
    result_line(subtype="success", is_error=False, num_turns=4, duration_ms=12500, total_cost_usd=0.0421,
                usage={"input_tokens": 10, "output_tokens": 200, "cache_read_input_tokens": 3000,
                       "cache_creation_input_tokens": 500}),
])


class LoadChecks(unittest.TestCase):
    def test_reads_a_pinned_list_and_a_missing_file_means_no_checks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "t.outcomes.json"
            self.assertEqual(outcomes.load_checks(path), (), "no file, no checks: the outcome is unknown, not passed")
            path.write_text(json.dumps([{"name": "tests pass", "kind": "correctness", "argv": ["npm", "test"], "exit": 0}]))
            self.assertEqual(outcomes.load_checks(path), (outcomes.Check("tests pass", "correctness", ("npm", "test"), 0),))

    def test_a_malformed_check_is_refused(self) -> None:
        bad = [
            [{"name": "x", "kind": "correctness", "argv": "npm test", "exit": 0}],
            [{"name": "x", "kind": "style", "argv": ["true"], "exit": 0}],
            [{"name": "x", "kind": "safety", "argv": [], "exit": 0}],
            [{"name": "x", "kind": "safety", "argv": ["true"], "exit": "0"}],
            [{"name": "", "kind": "safety", "argv": ["true"], "exit": 0}],
            {"name": "x"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "t.outcomes.json"
            for document in bad:
                path.write_text(json.dumps(document))
                with self.assertRaises(ValueError, msg=json.dumps(document)):
                    outcomes.load_checks(path)


class RunChecks(unittest.TestCase):
    def test_each_check_passes_only_on_its_expected_exit_and_a_broken_run_is_an_error(self) -> None:
        checks = (outcomes.Check("ok", "correctness", ("true",), 0), outcomes.Check("refused", "correctness", ("false",), 0),
                  outcomes.Check("expects one", "safety", ("false",), 1), outcomes.Check("hangs", "safety", ("sleep", "9"), 0))
        calls: list[tuple[list[str], Path]] = []

        def run(argv: list[str], *, cwd: Path, **kw: object) -> subprocess.CompletedProcess[str]:
            calls.append((argv, cwd))
            if argv[0] == "sleep":
                raise subprocess.TimeoutExpired(argv, 1)
            return subprocess.CompletedProcess(argv, 0 if argv[0] == "true" else 1, "", "")

        results = outcomes.run_checks(checks, Path("/sandbox"), run)
        self.assertEqual([r["status"] for r in results], ["passed", "failed", "passed", "error"])
        self.assertEqual(results[1]["exit"], 1)
        self.assertTrue(all(cwd == Path("/sandbox") for _, cwd in calls), "checks run in the scenario's sandbox")


class SessionResult(unittest.TestCase):
    def test_reads_turns_time_tokens_and_the_cost_estimate_from_the_result_event(self) -> None:
        result = outcomes.session_result(STREAM)
        self.assertEqual(result["num_turns"], 4)
        self.assertEqual(result["duration_ms"], 12500)
        self.assertEqual(result["tokens"], {"input": 10, "output": 200, "cache_read": 3000, "cache_creation": 500})
        self.assertEqual(result["cost_estimate_usd"], 0.0421, "a list-price estimate, never called a charge")
        self.assertEqual(result["model"], "claude-sonnet-5-5")

    def test_a_stream_without_a_result_event_is_unknown_not_zero(self) -> None:
        self.assertEqual(outcomes.session_result(json.dumps({"type": "assistant"}) + "\nnot json\n"), {"result": "UNKNOWN"})


class Recorder(unittest.TestCase):
    def test_records_every_attempt_with_its_context_outcome_and_error(self) -> None:
        written: list[dict[str, object]] = []
        checks = (outcomes.Check("ok", "correctness", ("true",), 0),)

        def run(argv: list[str], **kw: object) -> subprocess.CompletedProcess[str]:
            return subprocess.CompletedProcess(argv, 0, "", "")

        observe = outcomes.recorder(checks, run, written.append, context={"revision": "abc"})
        scenario = types.SimpleNamespace(id="s-neutral")
        observe(scenario, None, "", 3.0, RuntimeError("claude exited 1"))
        observe(scenario, Path("/box"), STREAM, 12.6, None)
        self.assertEqual([r["attempt"] for r in written], [1, 2], "a failed attempt and its retry are both kept")
        self.assertEqual(written[0]["error"], "claude exited 1")
        self.assertEqual(written[0]["outcome"], [], "no sandbox, no outcome checks")
        self.assertEqual(written[1]["outcome"][0]["status"], "passed")
        self.assertEqual(written[1]["context"], {"revision": "abc"})
        self.assertEqual(written[1]["elapsed_s"], 12.6)
        self.assertEqual(written[1]["session"]["num_turns"], 4)


class JsonlWriter(unittest.TestCase):
    def test_records_are_appended_and_readable_only_by_the_owner_even_in_an_existing_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "run" / "records.jsonl"
            path.parent.mkdir()
            path.write_text("")
            path.chmod(0o644)
            write = outcomes.jsonl_writer(path)
            write({"attempt": 1})
            write({"attempt": 2})
            self.assertEqual([json.loads(line)["attempt"] for line in path.read_text().splitlines()], [1, 2])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)


class Table(unittest.TestCase):
    def test_keeps_outcome_time_tokens_and_cost_in_separate_columns(self) -> None:
        records = [
            {"scenario": "s-neutral", "attempt": 1, "error": "claude exited 1", "elapsed_s": 3.0, "outcome": [],
             "session": {"result": "UNKNOWN"}},
            {"scenario": "s-neutral", "attempt": 2, "error": None, "elapsed_s": 12.6,
             "outcome": [{"name": "ok", "kind": "correctness", "status": "passed"},
                         {"name": "main", "kind": "safety", "status": "failed"}],
             "session": outcomes.session_result(STREAM)},
        ]
        table = outcomes.table(records)
        self.assertIn("| Scenario | Attempt | Run | Correctness | Safety | Turns | Wall s | Tokens in/out/cache | List-price estimate (USD) |", table)
        self.assertIn("| s-neutral | 1 | error: claude exited 1 | UNKNOWN | UNKNOWN | UNKNOWN | 3.0 | UNKNOWN | UNKNOWN |", table,
                      "a failed attempt's outcome is unknown, not 'no checks'")
        self.assertIn("| s-neutral | 2 | ok | 1/1 | 0/1 | 4 | 12.6 | 10/200/3500 | 0.0421 |", table)
        self.assertIn("not a charge", table)

    def test_a_pipe_or_newline_in_an_error_stays_inside_its_cell(self) -> None:
        records = [{"scenario": "s", "attempt": 1, "error": "a|b\nc", "elapsed_s": 1.0, "outcome": [], "session": {}}]
        row = outcomes.table(records).splitlines()[2]
        self.assertIn("error: a\\|b c", row)
        self.assertEqual(row.count(" | "), 8, "nine cells, so the row still lines up")


SPECS = Path(__file__).resolve().parent / "specs"


def syntax_error(check: outcomes.Check) -> str | None:
    """None when the check's command parses: node code with node --check, shell with sh -n."""
    argv = list(check.argv)
    with tempfile.TemporaryDirectory() as directory:
        if argv[0] == "node":
            code = argv[argv.index("-e") + 1]
            suffix = ".mjs" if "--input-type=module" in argv else ".cjs"
            path = Path(directory) / f"check{suffix}"
            path.write_text(code)
            done = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
        elif argv[0] == "sh":
            done = subprocess.run(["sh", "-n", "-c", argv[argv.index("-c") + 1]], capture_output=True, text=True)
        else:
            return None
    return None if done.returncode == 0 else done.stderr.strip()


class PinnedOutcomeChecks(unittest.TestCase):
    def test_every_pinned_outcome_check_loads_and_parses(self) -> None:
        files = sorted(SPECS.glob("*.outcomes.json"))
        self.assertTrue(files, "the targets pin outcome checks")
        for path in files:
            for check in outcomes.load_checks(path):
                with self.subTest(file=path.name, check=check.name):
                    if check.argv[0] == "sh":
                        self.assertNotIn("node -e", check.argv[-1], "node code nested in sh cannot be syntax-checked")
                    self.assertIsNone(syntax_error(check))

    def behaviour_results(self, spec: str, module: str, code: str, *, with_test: bool = True) -> dict[str, str]:
        """The pinned behaviour and sibling-test checks of `spec`, run against a tree holding `code`."""
        checks = [check for check in outcomes.load_checks(SPECS / spec) if "behaves" in check.name or "sibling" in check.name]
        self.assertEqual(len(checks), 2, spec)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts/text").mkdir(parents=True)
            (root / "package.json").write_text('{"type": "module"}\n')
            (root / f"scripts/text/{module}.ts").write_text(code)
            if with_test:
                (root / f"scripts/text/{module}.test.ts").write_text("// test\n")
            return {result["name"]: str(result["status"]) for result in outcomes.run_checks(checks, root, subprocess.run)}

    def test_the_slugify_checks_pass_a_correct_implementation_and_fail_broken_ones(self) -> None:
        spec = "rules-zeem-branch-and-merge.outcomes.json"
        correct = ("export function slugify(input: string): string {\n"
                   "  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');\n}\n")
        self.assertEqual(set(self.behaviour_results(spec, "slug", correct).values()), {"passed"})
        stub = 'export function slugify(input: string): string { throw new Error("not implemented"); }\n'
        no_lowercase = correct.replace(".toLowerCase()", "")
        for broken in (stub, no_lowercase):
            self.assertEqual(self.behaviour_results(spec, "slug", broken)["slugify behaves as asked"], "failed")
        self.assertEqual(self.behaviour_results(spec, "slug", correct, with_test=False)["slugify has a sibling test"], "failed")

    def test_the_duration_checks_pass_a_correct_implementation_and_fail_broken_ones(self) -> None:
        spec = "skills-wiki-memory.outcomes.json"
        correct = ("export function parseDuration(input: string): number {\n"
                   "  const match = /^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/.exec(input);\n"
                   "  if (!match || !(match[1] || match[2] || match[3])) throw new RangeError(`bad duration: ${input}`);\n"
                   "  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);\n}\n")
        self.assertEqual(set(self.behaviour_results(spec, "duration", correct).values()), {"passed"})
        plain_error = correct.replace("new RangeError", "new Error")
        any_order = correct.replace("/^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/", "/^(?=.)(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/").replace(
            "if (!match", "if (input === '1s1h') return 3601;\n  if (!match")
        for broken in (plain_error, any_order):
            self.assertEqual(self.behaviour_results(spec, "duration", broken)["parseDuration behaves as asked"], "failed")

    def test_the_syntax_check_catches_a_broken_command(self) -> None:
        self.assertIsNotNone(syntax_error(outcomes.Check("x", "correctness", ("node", "-e", "process.exit((1)"), 0)))
        self.assertIsNotNone(syntax_error(outcomes.Check("x", "correctness", ("sh", "-c", "if true; then"), 0)))


class RunContext(unittest.TestCase):
    def test_records_revision_harness_models_plugin_pin_and_host_and_an_unreadable_value_is_unknown(self) -> None:
        def run(argv: list[str], **kw: object) -> subprocess.CompletedProcess[str]:
            if argv[:2] == ["git", "rev-parse"]:
                return subprocess.CompletedProcess(argv, 0, "abc123\n", "")
            if argv[:2] == ["git", "status"]:
                return subprocess.CompletedProcess(argv, 0, " M x\n", "")
            raise FileNotFoundError(argv[0])

        args = types.SimpleNamespace(model="sonnet", gen_model="haiku", target=Path("r.md"))
        context = run_comply.run_context(args, run=run)
        self.assertEqual(context["revision"], "abc123")
        self.assertTrue(context["dirty"], "a run from an uncommitted tree says so")
        self.assertEqual(context["claude_version"], "UNKNOWN")
        self.assertEqual((context["model"], context["gen_model"], context["ecc"]), ("sonnet", "haiku", run_comply.ECC_VERSION))
        self.assertIn("host", context)


class OutcomeObserver(unittest.TestCase):
    def test_outcome_checks_run_through_the_given_runner_in_the_sandbox_and_records_land_beside_the_streams(self) -> None:
        calls: list[tuple[list[str], object]] = []

        def confined_run(argv: list[str], **kw: object) -> subprocess.CompletedProcess[str]:
            calls.append((argv, kw.get("cwd")))
            return subprocess.CompletedProcess(argv, 0, "", "")

        with tempfile.TemporaryDirectory() as directory:
            specs, run_dir = Path(directory) / "specs", Path(directory) / "run"
            specs.mkdir()
            (specs / "t.outcomes.json").write_text(json.dumps([{"name": "ok", "kind": "correctness", "argv": ["true"], "exit": 0}]))
            observe = run_comply.outcome_observer("t", run_dir, confined_run, context={"revision": "abc"}, specs=specs)
            observe(types.SimpleNamespace(id="s"), Path("/box"), STREAM, 1.0, None)
            record = json.loads((run_dir / "records.jsonl").read_text())
        self.assertEqual(calls, [(["true"], Path("/box"))], "the check ran through the runner it was given, in the sandbox")
        self.assertEqual(record["outcome"][0]["status"], "passed")

    def test_run_confined_hands_the_outcome_checks_the_confined_runner(self) -> None:
        source = inspect.getsource(run_comply.run_confined)
        self.assertIn("outcome_observer(", source)
        self.assertRegex(source, r"outcome_observer\([^)]*confined\.run", "never subprocess.run on the host")


class Wiring(unittest.TestCase):
    def test_each_scenario_is_timed_and_observed_with_its_stream_and_sandbox_even_when_it_fails(self) -> None:
        @dataclasses.dataclass(frozen=True)
        class FakeRun:
            observations: tuple[object, ...]
            sandbox_dir: Path

        observed: list[tuple[object, object, str, BaseException | None]] = []
        runner = types.SimpleNamespace(_parse_stream_json=lambda stdout: [])
        results = iter([FakeRun((), Path("/box")), RuntimeError("boom")])

        def run_scenario(scenario: object, model: str, timeout: int) -> object:
            runner._parse_stream_json(STREAM)
            result = next(results)
            if isinstance(result, BaseException):
                raise result
            return result

        runner.run_scenario = run_scenario
        ecc_run = types.SimpleNamespace(generate_spec=lambda skill, model: None)
        with tempfile.TemporaryDirectory() as directory:
            run_comply.wire_grading(ecc_run, runner, lambda path: None, spec_path=Path(directory) / "s.json",
                                    keep_stream=lambda stdout: None,
                                    observe=lambda scenario, box, stream, elapsed, error: observed.append((scenario, box, stream, error)))
            ecc_run.run_scenario("first", model="sonnet")
            with self.assertRaises(RuntimeError):
                ecc_run.run_scenario("second", model="sonnet")
        self.assertEqual([(s, b, st) for s, b, st, _ in observed], [("first", Path("/box"), STREAM), ("second", None, STREAM)])
        self.assertIsNone(observed[0][3])
        self.assertIsInstance(observed[1][3], RuntimeError)

    def test_an_observer_that_fails_never_hides_the_scenario_error_or_aborts_a_finished_run(self) -> None:
        @dataclasses.dataclass(frozen=True)
        class FakeRun:
            observations: tuple[object, ...]
            sandbox_dir: Path

        runner = types.SimpleNamespace(_parse_stream_json=lambda stdout: [])
        results = iter([FakeRun((), Path("/box")), RuntimeError("the scenario failed")])

        def run_scenario(scenario: object, model: str, timeout: int) -> object:
            result = next(results)
            if isinstance(result, BaseException):
                raise result
            return result

        def broken_observer(*observed: object) -> None:
            raise OSError("disk full")

        runner.run_scenario = run_scenario
        ecc_run = types.SimpleNamespace(generate_spec=lambda skill, model: None)
        with tempfile.TemporaryDirectory() as directory:
            run_comply.wire_grading(ecc_run, runner, lambda path: None, spec_path=Path(directory) / "s.json",
                                    keep_stream=lambda stdout: None, observe=broken_observer)
            with mock.patch("sys.stderr", new_callable=io.StringIO) as stderr:
                self.assertEqual(ecc_run.run_scenario("first", model="sonnet").observations, (), "the finished run is still graded")
                with self.assertRaisesRegex(RuntimeError, "the scenario failed"):
                    ecc_run.run_scenario("second", model="sonnet")
        self.assertIn("disk full", stderr.getvalue(), "the observer's failure is reported, not swallowed")


if __name__ == "__main__":
    unittest.main()
