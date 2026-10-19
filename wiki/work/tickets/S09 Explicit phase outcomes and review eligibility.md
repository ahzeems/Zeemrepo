---
type: ticket
title: S09 Explicit phase outcomes and review eligibility
summary: Implement the approved phase outcomes so failures cannot report success and only checked, reviewed results are eligible for integration.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: claude-code
status: done
owner: agent
priority: P1
next_action: None. It landed as PR 45 (13c3b11); S10 is now eligible. The afk landing risk is assigned to S16, the merger's post-merge commits are covered by S18 (its acceptance criterion that changed integration SHAs are independently verified), and durable retry state by S17; the rest of the discovered work continues as idea notes that link this ticket.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S09, finding A10 and its S08 prerequisite."
  - "VERIFIED: gh pr view 17 on 2026-10-18 reported MERGED by the code owner (job-spec approval); parent S08 landed as PR 39 (MERGED). Base a6b69c5 (origin/main)."
  - "VERIFIED: red at a4ab69d: node --test on run-result.test.ts, coordinator.test.ts and coordinator-entry.test.ts failed 33 of 41 against typed stubs. Green at 52aea4b: 41 of 41. afk red at 2ad74cf: afk.test.ts failed 2 of 66; green at a8cdf88 with afk-guard.test.ts: 124 of 124."
  - "VERIFIED: scenario matrix through the real coordinator with the fake SDK and real Git fixtures, asserting the structured RunResult and exitCode: reviewed candidate merged at its SHA (complete, 0); every sandbox creation rejected for 10 rounds (incomplete, 2, never All done); implementer throws (failed implementer, 2); missing, malformed, failed verdict and crashed reviewer (held or failed, merger never called, 2); stale verdict naming the base commit (held, 2); reviewer commits then passes its own tip (held), fresh review next round (integrated); A passes and B fails review (merger gets A only, A integrated, incomplete naming issue 2 not issue 1, 2); merger merges nothing (not-integrated, 2); branch moved after review then merged (not-integrated, 2); merger throws (failed, 2, no further round); invalid plan (failed, 2). Entry tests check exit status through .sandcastle/main.ts."
  - "VERIFIED: eleven planted mutants, each restored, each failed tests: reviewer edit ignored 2 of 41; stale verdict accepted 2 of 41; failed verdict accepted 3 of 41; exhaustion counted complete 3 of 41; incomplete exits 0 19 of 41; merger gets every executed issue 10 of 31; moved branch counted integrated 1 of 31; unmerged counted integrated 2 of 31; left-over branch not reviewed 4 of 31; afk ignores an incomplete loop 2 of 66; afk aborts on loop exit 2 2 of 66."
  - "VERIFIED: npm test at 2c69407 passed 1123 of 1123; coverage lists coordinator.ts 99.18% lines, 94.25% branches, run-result.ts 100% lines, 93.33% branches, afk.ts 98.00% lines."
  - "INFERRED: relayed verifier report (coordinator message, 2026-10-18): an independent verifier rated PR 45 at 7c90c93 PASS, killed 8 of its own mutants and held most of 18 crafted verdict inputs, and raised LOW findings: a closed pass followed by an unclosed failing <review> block, and a verdict with duplicate keys, were eligible; the prompt's example block was a filled-in pass; the runbook table lacked eligible and overstated held retries; plus the discovered items below."
  - "VERIFIED: review fixes test first: at 892931a run-result.test.ts failed 2 of 12 (unclosed trailing block, duplicate keys); green at ed33800, 12 of 12. The prompt-example test at 0c6df25 passes on the new prompt and fails 1 of 13 with the previous prompt restored. Mutants, each restored: unclosed trailing block ignored 1 of 32 failed; duplicate keys accepted 1 of 32; keys counted at every depth (a nested sha key) 1 of 32."
  - "INFERRED: the real SDK's SandboxRunResult.stdout carries the reviewer's <review> block and commits land on the host branch the coordinator reads with git rev-parse; both come from the Sandcastle 0.12.0 type definitions and its host worktree code, not from a run."
  - "UNKNOWN: model behaviour (whether a real reviewer follows the read-only verdict contract), Docker and GitHub are not exercised; fake responses establish only the coordinator's handling."
  - "VERIFIED: on 2026-10-18 gh pr view 45 reported MERGED by the code owner's account as 13c3b11, and git merge-tree --write-tree 13c3b11^ f19d838 gave 13c3b11's own tree, so main received exactly the reviewed head f19d838 (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, f19d838 rated PASS: the unclosed trailing block, duplicate keys, prompt example, runbook table and PR body findings are fixed. Left open: the MEDIUM on afk landing after loop exit 2 (S16), the unused aheadIssues, no-work for vanished commits, and a new LOW that a <review> mentioned in prose holds the issue."
---

## Goal

Represent real execution outcomes and hold failed, missing or stale review results out of integration.

## Inputs

- Plan S09, audit A10 and the approved partial-failure decision.
- Landed S08 coordinator, current review/merge prompts and existing AFK result/exit handling.

## Approach

1. Define the phase-result contract around the approved behavior and existing CLI exit conventions.
2. Tie check/review results to candidate SHAs; invalidate them when the candidate or acceptance inputs change.
3. Make reviewer work read-only or invalidate a review that edits its candidate; no reviewer certifies its own repair.
4. Propagate partial/total failure through the actual coordinator and wrapper, preserving eligible independent successes.

## Acceptance criteria

- [x] All agent creations failing, exhausted work and failed integration cannot end as a successful completed run.
- [x] Failed, absent, malformed or stale review outcomes hold that issue out of integration.
- [x] A reviewer edit cannot certify the edited result without a new independent review.
- [x] Passing independent issue A remains eligible when B fails; the overall result is incomplete/nonzero and identifies B.
- [x] Explicit 0/1/2 mapping follows the shared CLI conventions; phase claims alone do not authorize publication.

## Out of scope

Durable retry storage, trusted verifier receipts, notification reconciliation and live model behavior.

## Allowed files

- `scripts/sandcastle/coordinator*.ts`, `scripts/sandcastle/afk.ts`, `scripts/sandcastle/afk*.test.ts`.
- New `scripts/sandcastle/run-result*.ts` with sibling tests; `.sandcastle/review-prompt.md`, `.sandcastle/merge-prompt.md` for the result contract.
- Relevant coordinator test support, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no owner-approval changes, real issue comments or publication bypasses.

## Human checkpoints

Verify job approval and S08 landing. Any change to the approved partial-failure policy needs an owner decision, not a new enum chosen silently.

## Secrets needed

None. Use deterministic fake agent/check/review responses.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Positive: all phases pass for a fixed SHA; independent successful work remains eligible in a mixed run.
- Broken: rejected sandbox creation, missing/stale review, reviewer mutation, exhausted attempts and integration failure. Exercise the real coordinator and assert both structured result and exit outcome.

## Rollback and recovery

Preserve candidate work and diagnostics on failure. If the new contract cannot represent an outcome honestly, stop rather than translating it to success; repair/revert through a PR.

## Evidence

Record the scenario matrix, exact tested SHAs, eligibility decisions and exits, with independent verification. Model-backed correctness is not established by fake responses.

## Wiki and doc updates

Document outcome meanings and the remaining receipt/recovery work. Update this ticket without marking the dependent capabilities implemented.

## Outcome contract

Each issue's latest outcome, from `scripts/sandcastle/run-result.ts`: `no-work`, `failed` (phase
`sandbox`, `implementer` or `reviewer`), `held`, `eligible` (reviewed, not yet merged),
`integrated` or `not-integrated`. The run is `complete` (exit 0) only when the planner drains the
queue and no latest outcome is outstanding; `incomplete` (exit 2) names each outstanding issue or
the 10-round limit; `failed` (exit 2) is a planner or merger error; `refused` (exit 1) is `main`
or a detached HEAD. `npm run sandcastle:afk` lands what Git shows after a loop exit 2 and then
exits 2. The approved policy was applied as written; no new outcome needed an owner decision.

## Discovered work

- The merger is an agent with a shell and can merge a held branch it was not handed; the
  coordinator reports only listed issues it failed to merge, and afk classifies from Git, so such a
  merge would be announced and landed. Needs trusted merging or publication (S16 territory).
- The merger may commit a fix after a merge, which no reviewer sees; the run still reports the
  issue integrated. New integration SHAs need new verification (S18 acceptance: changed integration SHAs are independently verified).
- A comment the merger posts on an issue is a phase claim made before the coordinator checks
  integration; it can announce an issue the coordinator then reports not integrated
  (notification reconciliation, S17).
- A `held` or `failed` issue is retried only if the planner plans it again; there is no durable
  retry state (S17).
- `scripts/sandcastle/already-done.ts` `aheadIssues` has no production caller after S09, and its
  comment still names the merger as its consumer. It is outside this ticket's Allowed files;
  retire it later.
- `coordinator.ts` records `no-work` when the implementer reports commits but the branch is gone
  or was reset into HEAD; that work is not reported as lost.
- MEDIUM (verifier): after a loop exit 2, `afk.ts` (main, after the loop step) continues and
  lands whatever Git shows merged, so a misbehaving merger could merge a held branch it was not
  handed and afk would land it. Not a regression (exit 0 already did this); trusted publication
  is S16.

