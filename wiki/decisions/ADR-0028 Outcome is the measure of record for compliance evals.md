---
type: decision
title: ADR-0028 Outcome is the measure of record for compliance evals
summary: Outcome scores are the compliance evals' measure of record; the compliance rate is a strict secondary signal, and ECC's grader and pinned specs are unchanged.
tags: [area/agents, kind/convention]
created: 2026-10-20
updated: 2026-10-20
agent: claude-code
status: active
related: ["[[ADR-0026 ECC wins over the repository rules]]", "[[Agent workflow improvement]]", "[[Improve the agent workflow]]"]
---

## Context

The compliance evals run real agent sessions and grade their tool calls with ECC's `skill-comply`.
Its grader enforces step order, and `_demote_steps_resting_on_failures` undoes a step that was
detected when a prerequisite step failed its own checks, so one missed step zeros the rest of the
chain. The grader cannot tell a step the agent skipped from a step the classifier failed to label.

The first bubblewrap-confined run (2026-10-20) showed the gap. write-guard's supportive agent built
the guard (outcome 6/6) yet scored 0% compliance, because `prove_gap` was never classified and the
cascade then zeroed every later step; wiki-memory collapsed the same way at `write_memory_note`
(outcome 3/3). Only branch-and-merge's 75% read accurately.

The grader is ECC's, and ECC wins ([[ADR-0026 ECC wins over the repository rules]]); the pinned
specs' `after_step` links reflect orderings the skills really impose (write-guard proves the gap
before it writes tests). So neither the grader nor those links should be bent to raise a number.
Phase 4 added an independent outcome measure (`evals/compliance/outcomes.py`: correctness and safety
checks that run in the sandbox after the session), which does not depend on the classifier.

Shown that the cascade is ECC's deliberate design and that the zero was a misclassification rather
than a skipped step, the owner chose "Record outcomes as the measure" (OWNER DECISION, 2026-10-20).

## Decision

Outcome scores (correctness and safety from `outcomes.py`) are the measure of record for whether
agents do the repository's work correctly and safely. The `skill-comply` compliance rate is a strict
secondary signal, read with its documented limits (one label per tool call, the 500-character input
cut, the `after_step` cascade, and no `gh` login in the sandbox); a low rate is not by itself
evidence of non-compliance when the outcome checks pass. ECC's grader and the pinned specs and
scenarios are unchanged.

## Consequences

- Phase 5 tuning and any hook-promotion decision read outcomes first; compliance flags a candidate,
  it does not condemn.
- `evals/compliance/README.md` ("Reading results") and `evals/compliance/reports/summary.md` point
  here.
- Nothing in ECC or in the pinned specs and scenarios changes, so runs stay comparable with the
  baseline.
- When compliance and outcome disagree, as they did for write-guard and wiki-memory, the
  disagreement is itself the signal that the grader's limits bit, not that the agent failed.
