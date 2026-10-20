"""The information boundary of a scenario snapshot: what the evaluated agent may see of earlier results.

The private evaluation corpus is `reports/` (earlier scores and the reviewer's reading of them) and
`specs/` (the pinned steps and scenarios the grader applies). Both directories are left out of the
archive, and copies of their content elsewhere are found by reading every file:

- a rubric canary: a pinned step id or scenario id, taken from the corpus at the same commit;
- a result line: a percentage on a line that names an evaluation (compliance, a re-run, a pilot,
  a prompt kind or the grader);
- in prose only, a reference to the private directories or to `summary.md`;
- in prose only, a region between PRIVATE_START and PRIVATE_END lines; a marker line in any other
  file refuses, since nothing else is redacted.

Markdown outside the tooling paths is prose: each leaking line or private region is dropped, so
links and frontmatter on other lines survive. Tooling and every other file are copied byte for byte,
because the checks and provenance hashes depend on them; a leak there refuses the whole snapshot.
"""

from __future__ import annotations

import io
import json
import re
import tarfile
from collections.abc import Callable, Mapping

REPORTS_DIR = "evals/compliance/reports/"
SPECS_DIR = "evals/compliance/specs/"
PRIVATE_DIRS = (REPORTS_DIR, SPECS_DIR)
PRIVATE_START = "<!-- snapshot:private -->"
PRIVATE_END = "<!-- /snapshot:private -->"

SCORE = re.compile(r"\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)*\s?%")
EVALUATION_WORD = re.compile(r"comply|compliance|re-?runs?\b|pilot|supportive|neutral|competing|grader", re.IGNORECASE)
PRIVATE_REFERENCE = re.compile(r"evals/compliance/(?:reports|specs)\b|(?<![\w-])summary\.md\b")


class SnapshotRefused(Exception):
    """The snapshot would hand the agent private evaluation content it cannot remove safely."""


def private_canaries(corpus: Mapping[str, bytes]) -> frozenset[str]:
    """Step ids of each pinned spec and ids of each pinned scenario."""
    canaries: set[str] = set()
    for name, data in corpus.items():
        if not name.startswith(SPECS_DIR):
            continue
        if not name.endswith(".json"):
            raise SnapshotRefused(f"{name} is not a JSON spec, so its rubric canaries cannot be read")
        try:
            document = json.loads(data)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SnapshotRefused(f"{name} does not parse, so its rubric canaries are unknown: {error}") from error
        entries = document.get("steps", []) if isinstance(document, dict) else document
        canaries |= {entry["id"] for entry in entries if isinstance(entry, dict) and isinstance(entry.get("id"), str)}
    return frozenset(canaries)


def canary_pattern(canaries: frozenset[str]) -> re.Pattern[str] | None:
    if not canaries:
        return None
    alternatives = "|".join(re.escape(canary) for canary in sorted(canaries, key=len, reverse=True))
    return re.compile(rf"(?<![\w-])(?:{alternatives})(?![\w-])")


def line_leaks(line: str, pattern: re.Pattern[str] | None, *, prose: bool) -> bool:
    if pattern is not None and pattern.search(line):
        return True
    if SCORE.search(line) and EVALUATION_WORD.search(line):
        return True
    return prose and PRIVATE_REFERENCE.search(line) is not None


def leaking_lines(text: str, canaries: frozenset[str], *, prose: bool) -> list[int]:
    """1-based numbers of the lines that leak; a private marker line counts too, because only prose
    is redacted and a marker anywhere else would ship its region."""
    pattern = canary_pattern(canaries)
    return [number for number, line in enumerate(text.splitlines(), start=1)
            if line_leaks(line, pattern, prose=prose) or line.strip() in (PRIVATE_START, PRIVATE_END)]


def redact_prose(text: str, canaries: frozenset[str], name: str) -> str:
    """The text without private regions and leaking lines; an unclosed region refuses."""
    pattern = canary_pattern(canaries)
    kept: list[str] = []
    opened: int | None = None
    for number, line in enumerate(text.splitlines(keepends=True), start=1):
        marker = line.strip()
        if opened is None and marker == PRIVATE_START:
            opened = number
        elif opened is not None:
            if marker == PRIVATE_END:
                opened = None
        elif marker != PRIVATE_END and not line_leaks(line, pattern, prose=True):
            kept.append(line)
    if opened is not None:
        raise SnapshotRefused(f"{name}:{opened}: private region is never closed")
    return "".join(kept)


def clean_snapshot(archive: bytes, corpus: Mapping[str, bytes], is_tooling: Callable[[str], bool]) -> bytes:
    """The archive without the private directories, with prose redacted; refuses, naming every
    leaking line, when tooling or a non-prose file leaks. Other member kinds pass through unchanged."""
    canaries = private_canaries(corpus)
    refusals: list[str] = []
    output = io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(archive)) as source, tarfile.open(fileobj=output, mode="w") as target:
        for member in source.getmembers():
            if member.name.startswith(PRIVATE_DIRS):
                continue
            if not member.isfile():
                target.addfile(member)
                continue
            data = source.extractfile(member).read()
            data = clean_file(member.name, data, canaries, is_tooling, refusals)
            copy = tarfile.TarInfo(member.name)
            copy.mode, copy.mtime, copy.size = member.mode, member.mtime, len(data)
            target.addfile(copy, io.BytesIO(data))
    if refusals:
        raise SnapshotRefused("private evaluation content outside reports/ and specs/:\n" + "\n".join(refusals))
    return output.getvalue()


def clean_file(name: str, data: bytes, canaries: frozenset[str], is_tooling: Callable[[str], bool], refusals: list[str]) -> bytes:
    prose = name.endswith(".md") and not is_tooling(name)
    if prose:
        try:
            return redact_prose(data.decode(), canaries, name).encode()
        except UnicodeDecodeError:
            prose = False
        except SnapshotRefused as refused:
            refusals.append(str(refused))
            return data
    refusals.extend(f"{name}:{number}" for number in leaking_lines(data.decode(errors="replace"), canaries, prose=False))
    return data
