---
type: ticket
title: S02 Explicit-checkout command routing
summary: Make an explicit runner cwd authoritative despite inherited Git repository, index or configuration routing.
tags: [area/git, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: done
owner: agent
priority: P1
next_action: None. Its child S03 Fresh pinned main revisions is eligible; S05 also waits on S04, and S13 waits on S03.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S02, finding A03 and its S01 prerequisite."
  - "OWNER DECISION: job-spec approval is PR 17, merged after an APPROVED code-owner review; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parent S01 landed as PR 18, merged as 875a2e8 by the code owner after an APPROVED review; its record is done on main at 7542dd2."
  - "VERIFIED: base 7542dd2; at red commit the new pr-ready test failed because git rev-parse --show-toplevel run through spawnRunner(selected) printed the decoy repository; the no-cwd test already passed."
  - "VERIFIED: after the fix, node --test scripts/git/pr-ready.test.ts scripts/lib/git.test.ts passed 58 of 58 and scripts/sandcastle/afk.test.ts, the other spawnRunner caller, 53 of 53."
  - "VERIFIED: red commit 2f19e70 and fix commit 787c96e; an independent verifier at 89fc078 rated all five criteria MET, reproducing the red failure against the base runner and probing history injection with its own script."
  - "VERIFIED: an independent finder at 89fc078 reported no CRITICAL or HIGH issue; its MEDIUM gaps (history injection untested, no-cwd routing shown only through environment text) are closed by tests that run git through the runner, and dropping GRAFT_FILE, REPLACE_REF_BASE or NO_REPLACE_OBJECTS from the scrub, or GIT_INDEX_FILE in no-cwd mode, each fails a test in a scratch copy."
  - "INFERRED: the explicit-cwd tests read the developer's global git configuration, as any git run does; the runner cannot pin it because it drops every GIT_ variable, and nothing they run writes outside temporary repositories."
  - "INFERRED: PR 21's body records a second verifier at c695f5e as PASS, with every finder point resolved or accepted with a reason and four mutations of the scrub rule each failing a test; that verifier's own report is not stored in the repository."
  - "VERIFIED: gh pr view 21 on 2026-10-17 reported MERGED as 5d56a42 by the code owner after an APPROVED review; c695f5e is an ancestor of origin/main."
---

## Goal

Ensure Git, Node and npm launched with an explicit cwd operate on that identified checkout.

## Inputs

- Plan S02, audit A03, `scripts/git/pr-ready.ts` and `scripts/lib/git.ts`.
- Read `environmentFor`, `gitOptionsAt`, `spawnRunner` and their actual callers before changing them.
- Parent S01 must be completed through its merged implementation PR.

## Approach

1. Use two real disposable repositories and route the inherited environment toward the decoy.
2. Exercise `spawnRunner` itself and apply the shared explicit-checkout environment rule.
3. Preserve the existing omitted-cwd semantics needed by legitimate Git-hook callers.

## Acceptance criteria

- [x] The old runner fails the explicit-cwd decoy control before the fix.
- [x] Git inspection and commands launched through Node or npm resolve the selected fixture, not the decoy.
- [x] The decoy's refs, index, configuration and files remain unchanged.
- [x] Omitted-cwd hook routing retains the intended behavior; configuration/history injection remains scrubbed.
- [x] Targeted tests and the full check pass without relaxing the fixture-environment guard.

## Out of scope

Remote freshness, PR identity validation, publication state snapshots and sandbox architecture.

## Allowed files

- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`, `scripts/lib/git.ts`, `scripts/lib/git.test.ts`.
- `scripts/test-support/repo-fixture.ts` only if a reusable fixture capability is required.
- `wiki/lessons/Git hooks route child Git commands to the hooked repository.md`, this ticket and `CHANGELOG.md`.

## Forbidden files

All other files; do not alter real Git configuration, auth profiles, hooks or branch protection to make a control pass.

## Human checkpoints

Verify job-spec approval and the parent's actual landing. Seek owner agreement before changing the omitted-cwd contract or widening file scope.

## Secrets needed

None; fixtures and subprocess output must contain no real credentials.

## Tests and evals

- `node --test scripts/git/pr-ready.test.ts scripts/lib/git.test.ts`; `npm run check`.
- Positive: explicit cwd with an ordinary environment and omitted cwd with intentional hook routing.
- Broken: inherited decoy Git directory/worktree/index/config routes while cwd names another fixture. Assert the actual subprocess result, not only an environment object.

## Rollback and recovery

Use disposable repositories for all routing probes. Revert or repair the change on a new branch/PR if callers regress; never restore state by resetting the real checkout blindly.

## Evidence

Record red/green output, the fixture and decoy state comparisons, exact SHAs and an independent criterion verdict.

## Wiki and doc updates

Update the routing lesson only with observed behavior and update this ticket's status, next action and completion PR.

- [no-doc-change: no decision, reference or runbook states the routing rule; it lives in scripts/lib/git.ts and the routing lesson, which this branch updates, and npm run pr behaves as before because it passes no cwd]
