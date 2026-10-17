---
type: ticket
title: S23 Benchmark-clean evaluation snapshots
summary: Exclude prior results and private grading commentary from scenario snapshots while preserving actual operational tooling and valid wiki context.
tags: [area/evals, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify approval and S01 completion, then inspect actual archives for seeded leaks and preserve the real checkable snapshot.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S23, finding A17 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
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

- [ ] Seeded private-result/rubric canaries are absent even when copied outside report/spec directories.
- [ ] Operational rules and actual check tooling remain present and usable; no scenario stub replaces required enforcement.
- [ ] The resulting snapshot has valid wiki/provenance context and runs the intended offline checks.
- [ ] Archive path/link safety and environment confinement remain intact.
- [ ] The README states the actual boundary and limits; no claim is made about unmeasured effects on historical model scores.

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

## Evidence

Record archive members/content assertions, retained tooling checks, leak-control failures and documented residual visibility, with independent review.

## Wiki and doc updates

Update the evaluation README's snapshot guarantee and this ticket's evidence. Do not retroactively label old scores uncontaminated.
