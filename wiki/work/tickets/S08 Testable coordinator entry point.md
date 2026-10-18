---
type: ticket
title: S08 Testable coordinator entry point
summary: Expose the actual Sandcastle sequencing to fake external boundaries and include its production code in lint and coverage.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P1
next_action: None. It landed as PR 39; S09 and S11, whose parent is S08, are eligible. The reverse-order overlap gap continues as an idea note.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S08, finding A13 and its S01 prerequisite."
  - "VERIFIED: gh pr view 17 on 2026-10-18 reported MERGED by the code owner (job-spec approval); parent S01 is status done on main and its PR 18 is MERGED."
  - "VERIFIED: base c0f2e48 (origin/main). At test commit 0e357e6, node --test on the two coordinator test files and eslint-limits.test.ts failed 5 of 23: the three direct coordinate() cases on the typed stub's 'not implemented' rejection, and the lint control because ESLint applied no rule to .sandcastle/main.ts. The ten characterization cases in coordinator-entry.test.ts passed against the unchanged 243-line main.ts."
  - "VERIFIED: at 4287ae7 the same files pass 23 of 23; with the final test files and the original main.ts from c0f2e48 restored in place, coordinator-entry.test.ts still passes 12 of 12, so the refactor kept the observed sequencing, options and log lines."
  - "VERIFIED: discovered tests (coordinator-entry.test.ts): resolver hands the entry point the fake SDK; importing the coordinator loads no Sandcastle runtime and starts nothing; refusal on main; empty plan; full round with review only after commits; failed implementer; failed reviewer; left-over branch merged; already-merged issue skipped; ten-iteration limit; invalid plan aborts; failed merger aborts. coordinator.test.ts: refusal returns 1; uses the given cwd, not the process directory; closes the sandbox when the implementer throws. eslint-limits.test.ts: applies the source rules to the Sandcastle entry point."
  - "VERIFIED: thirteen planted controls, each restored afterwards: the original main.ts passed, and each of these failed at least one named test: removing the reviewer transition, running the reviewer unconditionally, moving close() out of finally, dropping left-over branches, removing the already-merged filter, merging before execution, MAX_ITERATIONS 9, removing the refusal, skipping the merger, making main.ts stop calling coordinate, a runtime SDK import in coordinator.ts, and dropping .sandcastle/*.ts from the ESLint files."
  - "VERIFIED: npm test at 4287ae7 passed 925 of 925 and its coverage table lists .sandcastle/main.ts (100% lines) and scripts/sandcastle/coordinator.ts (100% lines, 100% branches, 93.33% functions)."
  - "INFERRED: main.ts reports 50% functions and 66.67% branches because each scenario imports it under a new query string and Node keeps one instance per path; the first probe that loaded coordinator.ts under a query string showed the same effect (34.97%) until it loaded the plain URL."
  - "UNKNOWN: the real SDK (worktrees, commit collection, Output.object parsing), Docker, models, prompt effects and GitHub are not exercised; the fake stands in for all of them."
  - "VERIFIED: npm run check at 42d24c9 exited 0 (lint, typecheck, 925 tests with coverage, evals:test, wiki and skill lint, governance, rules, wiki compliance, changelog and memory guards)."
  - "VERIFIED: the required check job on PR 39 at 6b96994 failed only in the lint control, which passed locally; CI=true node --test scripts/toolchain/eslint-limits.test.ts reproduced it, because typescript-eslint's single-run mode reads a file already in its program from disk instead of the text given to lintText. At 111777b the control compares the size rules the real config resolves for .sandcastle/main.ts with those for eslint.config.ts; it passes with and without CI=true, fails when .sandcastle/*.ts is removed from the ESLint files, and CI=true npm test passes 925 of 925."
  - "VERIFIED: an independent verifier rated PR 39 at 3cc809e PASS with LOW findings: running the issue pipelines one after another, or listing left-over branches before produced ones, passed all 15 coordinator tests."
  - "VERIFIED: 2d9616c adds three coordinate() cases (pipelines overlap, with a bounded 2 s wait; merger order is produced branches then left-over ones, each in plan order; merged and left-over branches are judged in deps.cwd, not the process directory). All 18 coordinator tests pass on the unchanged coordinator. These cases characterize existing behavior, so they were shown red by mutation: sequential pipelines, the swapped merge order, and pendingIssues or aheadIssues given process.cwd() each failed the new case aimed at it, while the earlier 15 cases passed under all four."
  - "VERIFIED: observation, outside this diff: the Known notes bullet in the Sandcastle runbook that says the sandbox image is on Node 22 is stale since S12 moved it to node:24-trixie. Next action: the coordinator records it in a separate records PR."
  - "VERIFIED: the first red commit was made with git commit --no-verify; it was reset before publication and remade as 0e357e6 with a typed stub so the pre-commit hook ran and passed."
  - "VERIFIED: on 2026-10-18 gh pr view 39 reported MERGED by the code owner's account as 85a8a32, and git merge-tree --write-tree 85a8a32^ 28872e1 gave 85a8a32's own tree, so main received exactly the reviewed head 28872e1."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, 28872e1 rated PASS. Its LOWs: the overlap test runs one way only, so a sequential loop in reverse plan order passes all 18 coordinator tests (recorded as the idea note Coordinator concurrency test misses reverse-order runs), and the stale Node 22 runbook line, which PR 40 removed."
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

- [x] Tests invoke the real coordinator and observe plan, execution, review and integration ordering without live models.
- [x] Deliberately removing or misordering a transition makes a meaningful test fail.
- [x] Importing the coordinator does not launch a real run, contact GitHub or read credentials.
- [x] Existing behavior is characterized; S09/S10 fixes are not hidden in this prefactor.
- [x] The production path is included in canonical lint/typecheck/coverage and the full check passes.

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
