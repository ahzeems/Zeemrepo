---
type: project
title: Compliance evals measure of record
summary: Record that outcome scores are the compliance evals' measure of record and the compliance rate is a strict secondary signal, without changing ECC's grader.
tags: [area/agents, area/planning]
created: 2026-10-20
updated: 2026-10-20
agent: claude-code
status: done
owner: human
priority: P2
next_action: Done. The remaining follow-ups (assess GateGuard's effect on scenario agents; decide whether to promote finish_with_npm_run_pr to a hook) stay in [[Improve the agent workflow]].
idea: "[[Improve the agent workflow]]"
evidence:
  - "OWNER DECISION: the owner chose \"Record outcomes as the measure\" (2026-10-20), after being shown that the after_step cascade is ECC's deliberate design and that the write-guard and wiki-memory zeros were classifier misses, not skipped steps."
  - "VERIFIED: ECC's grader.py _demote_steps_resting_on_failures demotes a detected step whose after_step failed; in the first confined run (2026-10-20) write-guard supportive scored 0% compliance with 6/6 outcome and wiki-memory collapsed at write_memory_note with 3/3 outcome, so only branch-and-merge's rate read accurately."
  - "VERIFIED: ADR-0028 records the decision and is indexed from the Memory index; evals/compliance/README.md and reports/summary.md point to it; no file under evals/compliance/specs/ and no ECC file changed on this branch (git diff --name-only origin/main...HEAD)."
---

Use evidence and owner decisions; do not invent approval.

## Outcome

The repository reads its compliance evals by outcome first.
[[ADR-0028 Outcome is the measure of record for compliance evals]] states that outcome scores are the
measure of record and the `skill-comply` compliance rate is a strict secondary signal, so a
classifier miss that the `after_step` cascade amplifies (write-guard, wiki-memory) is not mistaken
for agent non-compliance.

## Scope

Record-only. In scope: ADR-0028, and a pointer to it from `evals/compliance/README.md` ("Reading
results") and `evals/compliance/reports/summary.md`. Out of scope: any change to ECC's grader (ECC
wins, [[ADR-0026 ECC wins over the repository rules]]) or to the pinned specs and scenarios (kept for
comparability); assessing GateGuard's effect on scenario agents and deciding the
`finish_with_npm_run_pr` hook, which both stay as follow-ups in [[Improve the agent workflow]].

## Acceptance criteria

- ADR-0028 exists, status active, indexed from the Memory index, and states outcome as the measure of
  record with compliance as a strict secondary signal read with its known limits.
- `evals/compliance/README.md` and `reports/summary.md` cite ADR-0028.
- No file under `evals/compliance/specs/` and no ECC file changed.
- `npm run check` exits 0.

## Work links

- [[Improve the agent workflow]]
- [[ADR-0028 Outcome is the measure of record for compliance evals]]
- [[Agent workflow improvement]]
