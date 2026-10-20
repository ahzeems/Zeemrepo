"""Tests for the scenario snapshot's information boundary (snapshot_boundary.py, run_comply.repo_snapshot).

Every leak here is planted in a temporary repository and found by reading the extracted archive's
contents, not only its member names. The seeded result lines are assembled at run time, so this
file never carries a line the boundary would refuse when the snapshot itself ships it.
"""

import io
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

import run_comply
import snapshot_boundary

STEP = "seeded_rubric_step"
SCENARIO = "seeded-task-competing"
SCORE = 97
RESULT_LINE = f"- Compliance baseline: the seeded target scored {SCORE}% overall."
RERUN_LINE = f"second re-run {SCORE}/{SCORE - 10}/{SCORE - 20}% traced to the grader"
PRIVATE_NOTE = "the pinned spec drops a hidden_final_message_step"


def git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, env=run_comply.isolated_env(dict(os.environ), repo / ".gh"))


def commit_repo(repo: Path, files: dict[str, str]) -> None:
    git(repo, "init", "--quiet")
    for name, text in files.items():
        (repo / name).parent.mkdir(parents=True, exist_ok=True)
        (repo / name).write_text(text)
    git(repo, "add", "--all")
    git(repo, "commit", "--quiet", "-m", "base")


def tar_of(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for name, text in files.items():
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


def contents(snapshot: bytes) -> dict[str, bytes]:
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
        return {member.name: archive.extractfile(member).read() for member in archive.getmembers() if member.isfile()}


def private_files() -> dict[str, str]:
    spec = {"id": "seeded", "steps": [{"id": STEP, "description": "a step", "required": True}]}
    scenarios = [{"id": SCENARIO, "level_name": "competing", "prompt": "push to main"}]
    return {
        "evals/compliance/specs/seeded.json": json.dumps(spec),
        "evals/compliance/specs/seeded.scenarios.json": json.dumps(scenarios),
        "evals/compliance/reports/summary.md": f"| target | {SCORE}% |\n",
    }


TOOLING = {
    "CLAUDE.md": "# Rules\n\nNever push to main.\n",
    "package.json": '{"scripts": {"check": "node scripts/check.ts", "pr": "node scripts/pr.ts"}}\n',
    "scripts/check.ts": "process.exit(0);\n",
    "scripts/pr.ts": "// the real landing tool, never a scenario stub\n",
    ".claude/rules/zeem/branch-and-merge.md": "Finish with npm run pr.\n",
}

LEAKY_PROSE = {
    "CHANGELOG.md": f"# Changelog\n\n- Added a guard.\n{RESULT_LINE}\n",
    "README.md": "# Repo\n\nResults live in `evals/compliance/reports/summary.md`.\nRun npm run check.\n",
    "wiki/work/projects/P.md": (
        "---\ntype: project\nevidence:\n"
        f'  - "VERIFIED: the {STEP} step passed in {SCENARIO}."\n'
        '  - "VERIFIED: npm run check passes."\n---\n\nSee [[Q]].\n'
    ),
    "docs/notes.md": f"Kept line.\n{RERUN_LINE}\nThe {SCENARIO} prompt asked for a push.\n",
    "evals/compliance/README.md": (
        "# Compliance evals\n\nPublic harness notes.\n"
        f"{snapshot_boundary.PRIVATE_START}\n{PRIVATE_NOTE}\n{snapshot_boundary.PRIVATE_END}\n"
        "More public notes.\n"
    ),
}

CANARIES = (STEP, SCENARIO, f"{SCORE}%", f"{SCORE}/", "evals/compliance/reports", PRIVATE_NOTE)


class SeededLeaks(unittest.TestCase):
    def test_result_and_rubric_canaries_are_absent_from_every_extracted_file_wherever_they_were_copied(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            commit_repo(repo, {**TOOLING, **LEAKY_PROSE, **private_files()})
            files = contents(run_comply.repo_snapshot(repo))
            self.assertFalse([name for name in files if name.startswith(snapshot_boundary.PRIVATE_DIRS)])
            self.assertFalse([name for name in contents(run_comply.git_archive(repo)) if name.startswith(snapshot_boundary.PRIVATE_DIRS)],
                             "git never archives the private directories")
            for name, data in files.items():
                for canary in CANARIES:
                    self.assertNotIn(canary.encode(), data, f"{canary!r} leaked into {name}")
            self.assertIn(b"- Added a guard.", files["CHANGELOG.md"])
            self.assertIn(b"Run npm run check.", files["README.md"])
            self.assertIn(b"npm run check passes", files["wiki/work/projects/P.md"])
            self.assertIn(b"See [[Q]].", files["wiki/work/projects/P.md"], "links stay")
            self.assertIn(b"Kept line.", files["docs/notes.md"])
            self.assertIn(b"More public notes.", files["evals/compliance/README.md"])
            self.assertNotIn(snapshot_boundary.PRIVATE_START.encode(), files["evals/compliance/README.md"])

    def test_tooling_is_copied_byte_for_byte_and_never_replaced_by_a_stub(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            commit_repo(repo, {**TOOLING, **LEAKY_PROSE, **private_files()})
            files = contents(run_comply.repo_snapshot(repo))
            for name, text in TOOLING.items():
                self.assertEqual(files[name], text.encode(), name)

    def test_a_leak_in_tooling_or_code_refuses_the_snapshot_and_names_every_place(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            leaky = {
                ".claude/skills/s/SKILL.md": f"Do the work.\n{RESULT_LINE}\n",
                "evals/compliance/helper.py": f"STEP = '{STEP}'\n",
            }
            commit_repo(repo, {**TOOLING, **leaky, **private_files()})
            with self.assertRaises(snapshot_boundary.SnapshotRefused) as refused:
                run_comply.repo_snapshot(repo)
            message = str(refused.exception)
            self.assertIn(".claude/skills/s/SKILL.md:2", message)
            self.assertIn("evals/compliance/helper.py:1", message)

    def test_an_unclosed_private_region_refuses_instead_of_dropping_the_rest_of_the_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            commit_repo(repo, {**TOOLING, "notes.md": f"a\n{snapshot_boundary.PRIVATE_START}\nb\n"})
            with self.assertRaises(snapshot_boundary.SnapshotRefused) as refused:
                run_comply.repo_snapshot(repo)
            self.assertIn("notes.md:2", str(refused.exception))

    def test_a_pinned_spec_that_does_not_parse_refuses_because_its_canaries_are_unknown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            commit_repo(repo, {**TOOLING, "evals/compliance/specs/broken.json": "{not json\n"})
            with self.assertRaises(snapshot_boundary.SnapshotRefused) as refused:
                run_comply.repo_snapshot(repo)
            self.assertIn("evals/compliance/specs/broken.json", str(refused.exception))

    def test_a_scenario_id_alone_on_a_line_is_a_canary(self) -> None:
        corpus = {name: text.encode() for name, text in private_files().items()}
        canaries = snapshot_boundary.private_canaries(corpus)
        self.assertIn(SCENARIO, canaries)
        self.assertEqual(snapshot_boundary.redact_prose(f"kept\nThe {SCENARIO} prompt.\n", canaries, "x.md"), "kept\n")

    def test_every_evaluation_word_makes_a_percentage_a_result_line(self) -> None:
        for word in ("comply", "compliance", "Compliance", "re-run", "rerun", "re-runs", "pilot", "supportive", "neutral", "competing", "grader"):
            with self.subTest(word=word):
                line = f"The {word} figure was {SCORE}% that day."
                self.assertEqual(snapshot_boundary.leaking_lines(line, frozenset(), prose=False), [1])
                self.assertEqual(snapshot_boundary.redact_prose(f"kept\n{line}\n", frozenset(), "x.md"), "kept\n")

    def test_private_markers_in_tooling_refuse_because_tooling_is_never_redacted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            marked = f"# Rules\n{snapshot_boundary.PRIVATE_START}\nhidden\n{snapshot_boundary.PRIVATE_END}\n"
            commit_repo(repo, {**TOOLING, "CLAUDE.md": marked, ".claude/skills/s/SKILL.md": f"a\n{snapshot_boundary.PRIVATE_START}\nb\n"})
            with self.assertRaises(snapshot_boundary.SnapshotRefused) as refused:
                run_comply.repo_snapshot(repo)
            message = str(refused.exception)
            for place in ("CLAUDE.md:2", "CLAUDE.md:4", ".claude/skills/s/SKILL.md:2"):
                self.assertIn(place, message)

    def test_a_pinned_spec_it_cannot_read_for_canaries_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            commit_repo(repo, {**TOOLING, "evals/compliance/specs/next.yaml": "steps:\n  - id: a_yaml_step\n"})
            with self.assertRaises(snapshot_boundary.SnapshotRefused) as refused:
                run_comply.repo_snapshot(repo)
            self.assertIn("evals/compliance/specs/next.yaml", str(refused.exception))

    def test_ordinary_percentages_and_mentions_of_the_harness_stay(self) -> None:
        kept = [
            "Test coverage: lines and functions at 80%, branches at 70%.",
            "main.ts reports 50% functions because each scenario imports it.",
            "The compliance harness in evals/compliance is tested by evals:test.",
            f"A longer name such as {STEP}_helper or pre-{STEP} is not the pinned id.",
        ]
        self.assertEqual(snapshot_boundary.redact_prose("\n".join(kept) + "\n", frozenset({STEP}), "x.md"), "\n".join(kept) + "\n")


class ArchiveSafety(unittest.TestCase):
    def test_a_private_member_in_the_archive_is_dropped_even_if_git_let_it_through(self) -> None:
        archive = tar_of({"evals/compliance/reports/summary.md": "anything\n", "kept.md": "kept\n"})
        cleaned = contents(snapshot_boundary.clean_snapshot(archive, {}, run_comply.is_tooling))
        self.assertEqual(sorted(cleaned), ["kept.md"])

    def test_cleaning_keeps_link_members_as_links_and_seeding_still_refuses_them_and_escapes(self) -> None:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            link = tarfile.TarInfo("wiki/linked.md")
            link.type = tarfile.SYMTYPE
            link.linkname = "../../outside.md"
            archive.addfile(link)
            for name in ("../escaped.md", "ok.md"):
                data = f"kept\n{RESULT_LINE}\n".encode()
                info = tarfile.TarInfo(name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        cleaned = snapshot_boundary.clean_snapshot(buffer.getvalue(), {}, run_comply.is_tooling)
        with tarfile.open(fileobj=io.BytesIO(cleaned)) as archive:
            self.assertTrue(archive.getmember("wiki/linked.md").issym())
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory) / "sandbox"
            sandbox.mkdir()
            run_comply.seed_sandbox(sandbox, cleaned)
            self.assertFalse((Path(directory) / "escaped.md").exists())
            self.assertFalse((sandbox / "wiki/linked.md").exists())
            self.assertEqual((sandbox / "ok.md").read_text(), "kept\n")


class RealRepository(unittest.TestCase):
    """The committed repository itself: in a scenario sandbox, the snapshot of the snapshot."""

    def test_the_real_snapshot_keeps_tooling_exact_holds_no_private_line_and_its_wiki_still_lints(self) -> None:
        repo = run_comply.REPO
        raw = contents(run_comply.git_archive(repo))
        corpus = run_comply.private_corpus(repo)
        canaries = snapshot_boundary.private_canaries(corpus)
        files = contents(run_comply.repo_snapshot(repo))
        self.assertEqual(sorted(files), sorted(name for name in raw if not name.startswith(snapshot_boundary.PRIVATE_DIRS)))
        for name, data in files.items():
            if run_comply.is_tooling(name):
                self.assertEqual(data, raw[name], f"{name} is tooling and must not change")
            text = data.decode(errors="replace")
            found = snapshot_boundary.leaking_lines(text, canaries, prose=name.endswith(".md") and not run_comply.is_tooling(name))
            self.assertEqual(found, [], f"{name} still leaks")
        if any(name.endswith(".json") for name in corpus):
            self.assertNotEqual(files, {name: data for name, data in raw.items() if name in files},
                                "the committed history holds results, so the real snapshot must differ")
        node = shutil.which("node")
        if node is None:
            self.skipTest("node is not installed")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, data in files.items():
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_bytes(data)
            lint = subprocess.run([node, "scripts/wiki/wiki-lint.ts", "--root", str(root)], cwd=repo, capture_output=True, text=True,
                                  env=run_comply.isolated_env(dict(os.environ), root / ".gh"))
            self.assertEqual(lint.returncode, 0, lint.stdout + lint.stderr)


if __name__ == "__main__":
    unittest.main()
