---
type: ticket
title: S24 Outcome-based compliance requirements
summary: Check prohibited actions and required artifacts/outcomes independently instead of treating positive tool-call labels as complete compliance evidence.
tags: [area/evals, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify approval and S23 completion, then add independent offline outcome controls and version the revised evaluation requirements.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S23 Benchmark-clean evaluation snapshots]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S24, finding A18 and its S23 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make each declared prohibition and required outcome independently falsifiable in the compliance harness.

## Inputs

- Plan S24, audit A18, pinned specs/scenarios and the outcome examples in historical reports.
- Read the pinned ECC integration/schema before adding fields; unsupported JSON fields are not enforcement.
- Use S23's clean snapshot boundary and existing confined subprocess mechanisms.

## Approach

1. Add independent prohibited-action and artifact/outcome checks, using a separate evaluator where the upstream step schema cannot express them.
2. Require observed failing tests, runnable wiring and both change records rather than weak substitutes.
3. Separate process-label scores, attempted violations and actual artifact/state outcomes; report coverage limits and version changed requirements.

## Acceptance criteria

- [ ] Explicit controls detect prohibited main pushes, PR merges and approvals; a denied attempt is not silently counted as compliance.
- [ ] Warning-only guards, missing executed red tests, absent runnable wiring and either missing required record fail independently.
- [ ] Compliant controls pass without unrelated dependency cascades masking the actual outcome.
- [ ] Validation runs against the actual evaluated artifacts/state under confinement, not only implementer prose or one tool-call label.
- [ ] Revised specs/report interpretation are versioned; new totals are not presented as comparable to the old rubric without qualification.

## Out of scope

Unapproved live model runs, retroactive rewriting of old scores and claims of complete adversarial-proof command interpretation.

## Allowed files

- `evals/compliance/specs/*.json`, `evals/compliance/run_comply.py`, `evals/compliance/test_run_comply.py`.
- New `evals/compliance/outcome_validation.py` and `evals/compliance/test_outcome_validation.py` if needed.
- `evals/compliance/README.md`; new separately identified reports only after authorized measurement; this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; historical report bodies, runtime credentials and weakened confinement are excluded.

## Human checkpoints

Verify approval and S23 landing. Obtain authorization before a paid/live evaluation batch. Stop if an outcome needs capability the current harness cannot actually observe; report it as unverified.

## Secrets needed

None for offline controls. Authorized live evaluation uses the existing constrained credential path without recording secrets.

## Tests and evals

- `npm run evals:test`; `npm run check`.
- Positive: compliant fixture artifacts, observed red/green execution and both records.
- Broken: each prohibited action/outcome independently, warning-only exit zero, documentation-only wiring, missing changelog or work record, and a mislabeled/cascaded tool trace. Assert independent outcomes through the actual harness integration.

## Rollback and recovery

Preserve old versioned results and raw-evidence limits. Repair the evaluator/spec through a new PR; do not alter earlier reports to manufacture improved compliance.

## Evidence

Record the per-requirement control matrix, evaluator invocation, artifact/state evidence, version changes and independent verification. Live scores require their own actual runs.

## Wiki and doc updates

Explain each metric's meaning and limits, changed comparability and authorized-run evidence in the evaluation README and this ticket.
