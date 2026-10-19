---
type: ticket
title: S10 Blocked-queue planning contract
summary: Keep blocked issues out of execution and represent empty and blocked queues as explicit non-executing outcomes.
tags: [area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges PR 54; the merge of main at 3cecc3b needs an independent review.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S09 Explicit phase outcomes and review eligibility]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S10, finding A11 and its S09 prerequisite."
  - "VERIFIED: gh pr view 17 on 2026-10-19 reported MERGED by the code owner (job-spec approval); parent S09 landed as PR 45 (MERGED, 13c3b11). Base caa99e3 (origin/main). Implementer: Claude Code, Claude Opus 5.5 (Anthropic)."
  - "VERIFIED: red at b42b44e against typed stubs: plan-schema.test.ts failed 3 of 8, run-result.test.ts 2 of 16, coordinator-queue.test.ts 6 of 12; coordinator.test.ts 19 of 19 and coordinator-entry.test.ts 12 of 12 still passed with blocked: [] added to their plans. Green at e6c82e5: 67 of 67 across the five files."
  - "VERIFIED: cases through the real coordinator with the fake SDK and real Git fixtures, asserting calls, worker branches, RunResult and exitCode: empty queue (planner only, complete, 0); wholly blocked queue (planner only, blocked, 2, each issue and blocker named, never All done); selected 1 with 2 blocked (worker for issue 1 only, 1 integrated, 2 blocked, run blocked, 2); 2 unblocked next round (workers 1 then 2, complete); refused before any worker (failed, 2): issue both selected and blocked, selected issue with blockers, no blocked list, self-blocking, repeated issue, unsafe branch, invalid id."
  - "VERIFIED: ten planted mutants, each restored, each failed tests (67 tests): selected-and-blocked accepted 2; blocked list optional 2; self-block accepted 2; selected blockers accepted 2; empty blockers accepted 1; blocked issues scheduled 2; blocked-only run counted complete 3; blocked dropped from results 2; waiver restored in the prompt 1; repeated blocked issue accepted 3."
  - "VERIFIED: npm test at e6c82e5 plus the runbook edit passed 1266 of 1266; coverage lists plan-schema.ts 100% lines, 98.46% branches, run-result.ts 100% lines, 96.34% branches, coordinator.ts 99.21% lines."
  - "INFERRED: the structural checks prove only the declared dependency metadata and the coordinator's handling. Whether a real planner reads issue text correctly and lists the right issues as blocked is model behaviour; coordinator-queue.test.ts shows a selected issue titled 'Blocked by #3' still runs when the plan does not declare it blocked."
  - "OWNER DECISION: asked on 2026-10-19 'S10: when a Sandcastle run ends with only blocked issues left (no failures), what exit code should it return?', the owner answered 'Exit 2 (Recommended)' (relayed by the coordinator, 2026-10-19)."
  - "INFERRED: relayed coordinator message (2026-10-19): PR 54 at 0ca882f had green CI and an independent verifier passed it, raising LOW findings: a stale blocked result persisted across rounds, plan-schema returned issues problems before checking blocked, the prompt test matched fixed waiver phrases only, and afk.ts exit-2 wording."
  - "VERIFIED: review fixes test first. Red at e766595: coordinator-queue.test.ts failed 1 of 15 (issue 2 blocked in round 1 and omitted by the round-2 plan left the run blocked), plan-schema.test.ts failed 1 of 9 (only the issues problem was reported). Green at fad2a07: 71 of 71 across the five coordinator, schema and run-result test files."
  - "VERIFIED: fourteen planted mutants against 71 tests, each restored, all failed tests; the four new ones: stale blocked kept 1; planner failure clears known blocked issues 1; blocked unchecked after issues problems 1; prompt reworded to let a blocked issue be selected when all are blocked ('select the least risky one') 1."
  - "INFERRED: relayed coordinator message (2026-10-19): the re-review FAILED PR 54 at f50edf0 on a MEDIUM regression from the stale-blocked fix. An issue held in round 1 and declared blocked in round 2 had its held outcome replaced by blocked, which a later empty plan cleared, so the run ended complete with exit 0 while sandcastle/issue-2 held unreviewed work; a draining plan reported blocked instead of incomplete. Two waiver rewordings that survive the prompt test are accepted as the documented limit."
  - "VERIFIED: round-3 fix test first. Red at e52d6a0: coordinator-queue.test.ts failed 2 of 17 (both reproductions, outcome blocked or absent instead of held). Green at 1a469b0: 73 of 73 across the five schema, run-result and coordinator test files. Sixteen planted mutants, each restored, all failed tests; the overwrite reintroduced (blocked results recorded unfiltered) failed 2 of 73, and clearing every earlier outcome on a new plan failed 20 of 73."
  - "INFERRED: relayed coordinator message (2026-10-19): the re-review passed PR 54 at 43c0a6c with no new defect, and noted LOW gaps: only held was tested as kept against a later blocked declaration, and this evidence named the red commit indirectly."
  - "VERIFIED: three tests added at the commit after 43c0a6c (failed, not-integrated and integrated issues later declared blocked). The code was already correct, so red is shown by planting: with the coordinator's worked check dropping one kind, the 43c0a6c tests failed 0 of 73 for failed, not-integrated and integrated, and the new tests fail 1 of 76 each; dropping held fails 2 of 73 and 2 of 76. Dropping eligible fails 0 of 76 and is equivalent: an eligible outcome never reaches a later round, because the same round merges it or the run stops failed. Dropping no-work also fails 0 of 76: a no-work issue a later plan declares blocked keeps no-work, and the run can complete; that choice is untested and listed under discovered work."
  - "OWNER DECISION: asked on 2026-10-19 how PR 54 should take in main when the pre-commit hook refused the merge commit because S11's new test plans failed typecheck without blocked lists, the owner answered 'Allow fixes in merge (Recommended)' (relayed by the coordinator, 2026-10-19): a one-time exception in which the merge commit also adds blocked: [] to five S11 test plans, with no other new lines and hooks on."
  - "VERIFIED: merge commit 3cecc3b takes origin/main 2a4bf7a (PRs 50 to 53). One conflict, in coordinator.test.ts, resolved with a line from each side: S11's base-commit line and this branch's plans. Under the exception it adds blocked: [] at review-input.test.ts:47 (two plans) and :52, and coordinator.test.ts:164 and :176; the commit message lists them. The pre-commit hook ran and passed. Before that, the hook had refused the merge without those lines, failing typecheck at review-input.test.ts(47,26) and (47,47) with TS2741."
  - "VERIFIED: at the merged tree, tsc -p tsconfig.json passed and node --test scripts/sandcastle/*.test.ts passed 459 of 459."
  - "UNKNOWN: no real model, Docker or GitHub run. The prompt test refuses known waiver phrases and requires the positive rule's wording; a waiver added elsewhere in the prompt in new words, with the rule kept, would still pass. Only a review of the prompt or a model run catches that."
---

## Goal

Prevent the planner from deliberately selecting blocked work and preserve explicit empty/blocked queue outcomes.

## Inputs

- Plan S10, audit A11, `.sandcastle/plan-prompt.md` and `scripts/sandcastle/plan-schema.ts`.
- S09's landed outcome contract and coordinator selection tests.

## Approach

1. Remove instructions that waive dependencies when no issue is eligible.
2. Validate the planner result needed to distinguish no work, blocked work and eligible work.
3. Reject contradictory known dependency/eligibility declarations before starting workers, retaining existing ID/branch/title validation.

## Acceptance criteria

- [x] An all-blocked result starts no worker and reports blocked work without claiming issue completion.
- [x] An empty queue starts no worker and remains distinct from failed execution.
- [x] Declared blocked candidates cannot be scheduled; eligible candidates still run.
- [x] Invalid IDs, duplicate issues, unsafe branches and malformed result combinations remain refused.
- [x] Tests separate mechanically validated dependency metadata from unverified natural-language model reasoning.

## Out of scope

Automatically rewriting issue dependencies, adding a new issue tracker or claiming model interpretation is proven by a fake planner.

## Allowed files

- `.sandcastle/plan-prompt.md`, `scripts/sandcastle/plan-schema.ts`, `scripts/sandcastle/plan-schema.test.ts`.
- `scripts/sandcastle/coordinator*.ts`, `scripts/sandcastle/run-result*.ts` and relevant coordinator test support.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files and real GitHub issue state; no automatic dependency overrides.

## Human checkpoints

Verify job approval and S09 landing. Raise ambiguous dependency semantics as an owner question rather than scheduling the least-blocked issue.

## Secrets needed

None; use controlled issue snapshots and fake planner outputs.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Positive: empty, wholly blocked and eligible queues produce their respective outcomes.
- Broken: a selected issue also declared blocked, malformed status/issue combinations and duplicate identities. Assert worker invocation count and structured outcomes through the real coordinator.

## Rollback and recovery

Keep blocked work pending with its reason. If selection cannot be established, refuse execution rather than restoring the dependency-waiver fallback.

## Evidence

Record validated input/output cases, worker selection and exits, with model-reasoning limits and independent review.

## Wiki and doc updates

Align the prompt, schema and runbook descriptions of eligibility. Record the implementation PR in this ticket.

## Outcome contract

- The plan is `{"issues": [...], "blocked": [...]}`. A blocked entry has `id`, `title` and `blockedBy`
  (distinct issue numbers, not its own). Both lists are required and disjoint
  (`scripts/sandcastle/plan-schema.ts`).
- A declared blocked issue gets the outcome `blocked` and no sandbox, branch or agent
  (`scripts/sandcastle/coordinator.ts`).
- An empty queue is `complete` (exit 0). A drained run whose only outstanding issues are blocked is
  `blocked` (exit 2). Blocked beside failed, held or unmerged issues is `incomplete` (exit 2), and the
  reason names both (`scripts/sandcastle/run-result.ts`).
- The prompt no longer tells the planner to pick the least-blocked issue; when unsure it lists the
  issue as blocked (`.sandcastle/plan-prompt.md`). A test fails if the waiver returns or the prompt's
  example plans stop passing the schema.

## Owner decision

- **Exit code for a blocked run.** A blocked run exits 2, like an incomplete one, because
  `scripts/lib/cli.ts` allows only 0, 1 and 2 and 0 would let a wrapper read blocked work as done.
  The run status (`blocked`) and its log lines keep it apart from failure. OWNER DECISION,
  2026-10-19: "Exit 2 (Recommended)".
- **Stale blocked results.** A blocked outcome is the latest plan's view, so each round with a plan
  clears earlier blocked-only results; an issue a later plan no longer lists (closed or relabelled)
  stops counting. A blocked declaration replaces only an earlier blocked result or none: an issue
  already failed, held, eligible, not integrated or integrated keeps that outcome, because its
  branch may hold work the partial-failure policy must report. A planner failure keeps the blocked
  issues already known in the failed run's report.

## Discovered work

- `scripts/sandcastle/afk.ts` (lines 344 and 351) describes any loop exit 2 as "incomplete or failed
  work". A blocked run now also exits 2, so the AFK wording should mention blocked issues. The file
  is outside this ticket's allowed files; S27, the afk ticket, may take it.
- The plan has no way to say an issue's dependency is ambiguous beyond listing it as blocked; the
  ticket's human checkpoint asks for ambiguous semantics to go to the owner, which would need an
  issue comment or label the planner cannot write today.

- A `no-work` issue (the implementer committed nothing) that a later plan declares blocked keeps
  `no-work`, so the run can end complete. Whether blocked should replace `no-work` is undecided and
  untested; a mutant that lets it pass every test.

## Implementation

- PR 54, branch `fix/s10-blocked-queue`.
