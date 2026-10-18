---
type: ticket
title: S23 Benchmark-clean evaluation snapshots
summary: Exclude prior results and private grading commentary from scenario snapshots while preserving actual operational tooling and valid wiki context.
tags: [area/evals, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: claude-code
status: done
owner: agent
priority: P2
next_action: Owner review of the fix/s23-clean-eval-snapshots pull request; S24 builds on the contract under Snapshot contract for S24.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S23, finding A17 and its S01 prerequisite."
  - "VERIFIED: gh pr view on 2026-10-18 reported PR 17 (these job specs) and PR 18 (S01) MERGED."
  - "VERIFIED: on main a6b69c5 the generated archive excluded only the two private directories; reading its extracted files found scores and pinned step ids in CHANGELOG.md, wiki/work/projects/Zimi migration.md, the A18 row of the audit findings and evals/compliance/README.md."
  - "VERIFIED: red commit e4a28fa, python3 -m unittest test_snapshot_boundary ran 8 tests with 4 failures and 3 errors; the seeded score line reached CHANGELOG.md in the extracted archive; only the byte-for-byte tooling case passed."
  - "VERIFIED: fix 8654ae3 and test ac4ae86, npm run evals:test (through the shared heavy-command lock) ran 69 tests OK, 9 of them in test_snapshot_boundary.py."
  - "VERIFIED: 14 planted mutants of snapshot_boundary.py and repo_snapshot each failed test_snapshot_boundary (14 of 14 killed); the first run left 3 alive (each private-directory layer alone, the word-bounded id match), and ac4ae86 added the cases that kill them. That set covered neither the scenario-list read nor single evaluation words, so it did not show those were tested (see the review round below)."
  - "VERIFIED: the cleaned snapshot of ac4ae86 drops 21 lines from 5 files (CHANGELOG.md 4, the Zimi migration record 4, the audit findings 1, the S24 ticket 1, the private region of the eval README 11), keeps all 481 files and leaves every tooling file byte-identical."
  - "VERIFIED: that cleaned snapshot, extracted to a scratch directory, committed as main with node_modules linked, passed npm run check with exit 0: 1098 node tests, 69 Python tests, wiki-lint 125 notes, skills-lint 17 skills, governance, rules, changelog and memory guards."
  - "UNKNOWN: the scratch run had no local origin, because the block-pr-merge hook refused the push of main to a local bare origin; the harness's own confined baseline commit was not exercised, and no live evaluation was run."
  - "INFERRED: relayed coordinator report: npm run pr from this worktree at d9c2cc9 refused on refs changed in my four attempts after the first (shared .git, other agents moving their refs; a for-each-ref diff showed the s22 and s26 branches move), and the coordinator's own reruns refused twice on refs changed before the third pushed it as PR 47."
  - "INFERRED: relayed verifier report on d9c2cc9: PASS with one MEDIUM (no test for scenario-id canaries; a mutant that stops reading scenario lists survived) and three LOWs (README said an unclosed private region stops the run, but markers in tooling were ignored; a dropped evaluation word survived; a non-JSON spec added no canaries and did not refuse), plus pattern gaps leaking undocumented: an id split across lines, changed case or separator, an id as a file name, a marker with trailing text."
  - "VERIFIED: red commit 6afb0ca, the new tool-marker and YAML-spec cases failed (2 failures of 63 tests in test_snapshot_boundary and test_run_comply); fix 8ee8589 refuses a marker line in any non-prose file (the preferred option for L1, not a README-only correction) and any non-JSON file under specs/; the README now lists the four pattern gaps."
  - "VERIFIED: at 7a29848, 25 planted mutants each failed test_snapshot_boundary (25 of 25 killed): the 14 above, the scenario-list read (the reviewer's M6), the non-JSON refusal, the marker refusal, and the removal of each of the 8 evaluation-word alternatives (including the reviewer's O4, re-run)."
  - "INFERRED: the boundary is pattern-based, so results restated without a percentage or an evaluation word, or a rubric paraphrased without its ids, would pass; the README records this limit."
---

## Goal

Build an evaluation snapshot whose claimed information boundary holds in its actual contents.

## Inputs

- Plan S23, audit A17, `repo_snapshot`, `seed_sandbox`, tooling replacement rules and archive tests.
- Inspect copied scores/commentary in changelog, work records and evaluation documentation, including wiki/provenance links that sanitization must preserve.

## Approach

1. Seed identifiable prior-result/rubric leaks in multiple fixture surfaces and inspect the real generated archive.
2. Define the snapshot's data boundary while preserving operational instructions and real enforcement tooling.
3. Keep wiki links and provenance dependencies valid; document unavoidable visible implementation details rather than claiming complete grader blindness.

## Acceptance criteria

- [x] Seeded private-result/rubric canaries are absent even when copied outside report/spec directories.
- [x] Operational rules and actual check tooling remain present and usable; no scenario stub replaces required enforcement.
- [x] The resulting snapshot has valid wiki/provenance context and runs the intended offline checks.
- [x] Archive path/link safety and environment confinement remain intact.
- [x] The README states the actual boundary and limits; no claim is made about unmeasured effects on historical model scores.

## Out of scope

Changing scoring requirements, paid model runs, rewriting historical reports or hiding operational rules the evaluated agent is meant to follow.

## Allowed files

- `evals/compliance/run_comply.py`, `evals/compliance/test_run_comply.py`; new `evals/compliance/snapshot_*.py` and `evals/compliance/test_snapshot_*.py` files if needed.
- `evals/compliance/README.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; especially real historical report bodies, pinned scoring specs, source operational rules and network/credential confinement.

## Human checkpoints

Verify approval and parent landing. Seek owner agreement before weakening real checks or changing the evaluation's intended information boundary. Live evaluation spending remains separately authorized.

## Secrets needed

None. Use generated canaries and archives; no real Claude login or GitHub token.

## Tests and evals

- `npm run evals:test`; `npm run check`.
- Positive: a clean snapshot preserves real tooling and passes the relevant checks in a disposable environment.
- Broken: leaks copied into root docs, wiki work records and evaluation prose; unsafe archive paths/links and scenario tooling stubs. Inspect extracted/archive content, not only member-directory exclusions.

## Rollback and recovery

Keep diagnostic fixture archives privately until inspected. If sanitization breaks validity, repair the transformation instead of bypassing check execution. Preserve historic reports and clearly version new evaluation conditions.

## Snapshot contract for S24

What later work can rely on (`evals/compliance/snapshot_boundary.py`, README "Snapshot boundary"):

- Every file in the harness's `reports/` and `specs/` folders (beside `run_comply.py`) stays out of every
  scenario snapshot, whatever its file name.
- Each `id` in a pinned spec's `steps` and in a pinned scenarios list becomes a canary with no code
  change. A spec that is not valid JSON stops the run.
- Code or other non-Markdown files shipped in the snapshot, and the tooling paths, must not name a
  pinned step or scenario id, hold a percentage beside an evaluation word, or carry a private-region
  marker line: the run refuses and lists each place. Pinned specs must be JSON; any other file in
  `specs/` refuses. An evaluator such as `outcome_validation.py` should read ids from the pinned spec at run
  time.
- Markdown outside tooling may mention results; those lines are dropped from the snapshot. README
  commentary about the pins goes between `<!-- snapshot:private -->` and `<!-- /snapshot:private -->`
  lines.
- Tooling (`package.json`, `CLAUDE.md`, `.claude/`, `.github/`, `.githooks/`, `scripts/`, `config/`)
  reaches the sandbox byte for byte, and the snapshot still passes `npm run check`.

## Operating documentation

[no-doc-change: the snapshot boundary is documented beside its code in the eval README, the harness's operating document; the ticket allows no wiki decision, reference or runbook edit]

## Discovered work

- The pinned scenario prompts are not canaries: only ids are matched. A prompt copied into prose
  would pass unless it carries an id or a score.
- `evals/compliance/test_run_comply.py` is 809 lines, over the 800-line limit that applies to tests;
  this branch added its tests in a new file instead.
- The block-pr-merge hook refuses `git push origin main` even to a local bare repository in a
  scratch directory, so the harness's baseline step cannot be reproduced by hand from a session.

## Evidence

Record archive members/content assertions, retained tooling checks, leak-control failures and documented residual visibility, with independent review.

## Wiki and doc updates

Update the evaluation README's snapshot guarantee and this ticket's evidence. Do not retroactively label old scores uncontaminated.
