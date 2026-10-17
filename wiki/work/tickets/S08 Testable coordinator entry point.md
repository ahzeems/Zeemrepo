---
type: ticket
title: S08 Testable coordinator entry point
summary: Expose the actual Sandcastle sequencing to fake external boundaries and include its production code in lint and coverage.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify job approval and S01 completion, then extract a testable coordinator without mixing in the later behavior fixes.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S08, finding A13 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Test and account for the real coordinator rather than a wrapper that substitutes the entire loop.

## Inputs

- Plan S08, audit A13, `.sandcastle/main.ts` and existing Sandcastle tests/harnesses.
- Read the shared CLI pattern and the current lint, typecheck, coverage and test-pairing configurations.

## Approach

1. Characterize current sequencing with fake planner/agent/service boundaries and disposable Git fixtures.
2. Extract the actual loop into bounded modules, leaving a thin entry point and no import-time execution.
3. Wire the production path into lint, typecheck, coverage and discovered tests. Keep later semantic repairs separate.

## Acceptance criteria

- [ ] Tests invoke the real coordinator and observe plan, execution, review and integration ordering without live models.
- [ ] Deliberately removing or misordering a transition makes a meaningful test fail.
- [ ] Importing the coordinator does not launch a real run, contact GitHub or read credentials.
- [ ] Existing behavior is characterized; S09/S10 fixes are not hidden in this prefactor.
- [ ] The production path is included in canonical lint/typecheck/coverage and the full check passes.

## Out of scope

New failure semantics, isolation deployment, PR publication or a production fake-agent bypass switch.

## Allowed files

- `.sandcastle/main.ts`; new `scripts/sandcastle/coordinator*.ts` with sibling tests.
- `scripts/test-support/afk-harness.ts` and new bounded `scripts/test-support/coordinator-*.ts` support files.
- `eslint.config.ts`, `tsconfig.json`, `package.json`, relevant `scripts/toolchain/*.test.ts` controls.
- `.claude/skills/verify-work/references/feature-map.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; do not change publication permissions, credentials, approved outcomes or existing coverage thresholds.

## Human checkpoints

Verify approval and parent landing. Respect any explicit harness denial for configuration edits; obtain the owner's edit rather than bypassing it. Propose a split if the prefactor no longer fits one context.

## Secrets needed

None; external agent and service boundaries are fake.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run lint`; `npm run typecheck`; `npm run check`.
- Positive: the actual loop traverses its expected phases and releases resources in fixtures.
- Broken: remove a real transition or redirect the entry point away from the tested code; the control must fail. Tests that only inspect source strings are insufficient.

## Rollback and recovery

Preserve the original entry-point behavior until its replacement is tested. Repair/revert through a new PR and retain characterization tests; do not enable a fallback that runs paid agents during tests.

## Evidence

Record discovered test names, exercised entry point, mutation control and actual coverage scope at the final SHA, plus independent review.

## Wiki and doc updates

Update the feature-map recipe and runbook to identify the real tested path and remaining model/integration limits.
