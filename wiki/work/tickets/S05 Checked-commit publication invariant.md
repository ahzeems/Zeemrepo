---
type: ticket
title: S05 Checked-commit publication invariant
summary: Prevent publication when checks change the branch, commit or relevant repository state, and certify only the captured checked SHA.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify job approval and both parents' completion, then exercise check-induced state changes before publication.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S02 Explicit-checkout command routing]]", "[[S04 Content-sensitive working-state snapshots]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S05, finding A04 and its S02/S04 prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Publish only the unchanged branch and commit whose readiness and checks were established.

## Inputs

- Plan S05, audit A04, `pr-ready.ts`, `.githooks/pre-push` and their tests.
- Read the landed explicit-cwd and content-sensitive snapshot contracts from S02/S04.

## Approach

1. Capture branch, HEAD and relevant state before running checks.
2. Compare afterward even when checks fail; refuse before any push if state changed.
3. Pass only the original unchanged checked SHA through the existing pre-push handoff.

## Acceptance criteria

- [ ] The old tool fails a control where a successful check changes HEAD and publication would certify the replacement.
- [ ] HEAD moves, branch switches and relevant working/config/index/ref changes prevent pushing on both success and failure paths.
- [ ] An unchanged passing check publishes the captured SHA; failed checks never publish.
- [ ] A state mismatch names the changed class without leaking configuration or file contents.
- [ ] Pre-push still applies branch protections; no generic skip flag or `--no-verify` path is added.

## Out of scope

PR repository/base validation and the new isolated receipt publication path, which have their own tickets.

## Allowed files

- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`, `scripts/git/git-state.ts`, `scripts/git/git-state.test.ts`.
- `.githooks/pre-push`, `scripts/git/hooks.test.ts` only for the checked-SHA contract.
- `wiki/reference/Merge gate contract.md`, `wiki/lessons/Hook-run checks must preserve Git state.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no branch-protection, credential or main-push exceptions.

## Human checkpoints

Verify job approval and parent landings. Stop and report actual checkout mutation rather than attempting an automatic destructive repair.

## Secrets needed

None for regression controls; use a scripted publisher and real disposable Git state.

## Tests and evals

- `node --test scripts/git/pr-ready.test.ts scripts/git/git-state.test.ts scripts/git/hooks.test.ts`; `npm run check`.
- Positive: check exits zero and all captured state remains unchanged.
- Broken: mutate each captured state class during a successful and a failing check; assert zero push calls and no replacement-SHA certification.

## Rollback and recovery

Stop on changed state and retain the diagnostic snapshot. Never reset the real checkout to make verification pass. Revert or repair the implementation through a new PR.

## Evidence

Record captured/after SHAs, mutation cases, push-call observations, command exits and independent review.

## Wiki and doc updates

Update the merge-gate and hook-state explanations to describe the actual invariant, plus this ticket's completion record.
