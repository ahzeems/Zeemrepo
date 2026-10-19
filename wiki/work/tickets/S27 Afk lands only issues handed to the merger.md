---
type: ticket
title: S27 Afk lands only issues handed to the merger
summary: After a loop exit 2, npm run sandcastle:afk lands only the issue branches the coordinator handed the merger, not every sandcastle/issue-<N> branch Git shows merged.
tags: [area/agents, area/git, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: agent
priority: P2
next_action: None. It landed as PR 57 (d7890ee). The reviewed-SHA and deleted-branch gaps, the symlink case and the review LOWs continue as idea notes that link this ticket.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S09 Explicit phase outcomes and review eligibility]]", "[[S11 Non-executable branch inputs]]"]
related: ["[[S16 Trusted publication of verified candidate refs]]", "[[Run Sandcastle on GitHub issues]]", "[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner answered the coordinator's question on where the afk fix should live with \"New ticket after #50 (Recommended)\". The option read: a small build ticket for afk.ts and coordinator.ts, built once S11's PR 50 has merged so the two coordinator.ts changes do not collide; approved when the owner merges the records PR."
  - "INFERRED: the S09 ticket's Discovered work on main records the finding as a MEDIUM from S09's verifier: after a loop exit 2, afk.ts continues and lands whatever Git shows merged, so a misbehaving merger could merge a held branch it was not handed and afk would land it. It is not a regression (exit 0 already did this)."
  - "INFERRED: the S16 ticket's Discovered work on origin/feat/s16-trusted-publication (PR 53) names main and classify in afk.ts, and says closing it needs the coordinator's RunResult to reach afk; both files were outside S16's Allowed files."
  - "VERIFIED: on main at caa99e3, afk.ts main runs node .sandcastle/main.ts as a child process, continues on exit 2, and classify builds its issue list from mergedBranches, which runs git for-each-ref --merged HEAD over refs/heads/sandcastle/, keeps the sandcastle/issue-<N> refs and drops those already merged into origin/main. Nothing from the coordinator's RunResult reaches afk."
  - "VERIFIED: on 2026-10-19 PR 50 (S11), which edits scripts/sandcastle/coordinator.ts and its tests, was open and not merged."
  - "INFERRED: this ticket is a follow-up to slices S09 and S16 of the approved remediation plan, not one of the plan's 26 slices; the owner's decision above approves adding it when the records PR merges."
  - "VERIFIED: gh pr view on 2026-10-19 reported PR 55 (which adds this ticket) MERGED at 4c56101 and S11's PR 50 MERGED at 6facf2a. Base 4c56101 (origin/main). Implementer: Claude Code, Claude Opus 5.5 (Anthropic)."
  - "OWNER DECISION: asked on 2026-10-19 whether the build may change scripts/test-support/afk-harness.ts outside the allowed files (an optional handed field on the fake loop's Script; after the loop it writes the record through a writer exported from coordinator.ts; by default every local sandcastle/issue-N branch, null for no record, a string for raw text), the owner answered \"Allow the harness edit (Recommended)\" (option: test support only, about 8 lines in the fake loop runner; afk-guard.test.ts and production behaviour not otherwise touched; the ticket records the exception). Relayed by the coordinator, 2026-10-19."
  - "OWNER DECISION: asked on 2026-10-19 to confirm that afk refuses after a loop exit 0 too when a merged branch was not handed (refuse to push, name the issue, exit 2), the owner answered \"Yes, refuse after exit 0 (Recommended)\" (option: matches the ticket's goal 'after any loop exit'). Relayed by the coordinator, 2026-10-19."
  - "VERIFIED: red at d3440a9 (typed writer stub, not called): coordinator.test.ts failed 2 of 23 (no record written); afk.test.ts failed 9 of 78 counting subtests (the unhanded branch landed after exit 0 and exit 2; each of the five missing, stale or malformed record cases landed). The positive case (a handed issue lands after exit 0 and 2, a handed unmerged one does not) passed on main as a control."
  - "VERIFIED: green at 8c820ee: node --test over afk.test.ts, afk-guard.test.ts, coordinator.test.ts, coordinator-entry.test.ts and coordinator-queue.test.ts passed 191 of 191. coordinator-entry.test.ts also asserts that .sandcastle/main.ts leaves the record, so neither main.ts nor run-result.ts changed."
  - "VERIFIED: ten planted mutants, each restored, run against afk.test.ts or coordinator.test.ts plus coordinator-entry.test.ts: unhanded branch not refused killed (3 failures); missing record handing issue 4 killed (3); non-string entries accepted killed (2); non-array handed accepted killed (2); stale record not removed killed (2); coordinator records nothing killed (2); records skipped and blocked issues killed (1); keeps only the last round's hand-off killed (1); writes no record killed (3). Dropping the typeof-object check survived (0); it is equivalent, because the Array.isArray check on value.handed refuses an array, string or number record anyway."
  - "VERIFIED: npm run check at b6860ae (code, runbook, ticket and fragment) exited 0: npm test 1323 of 1323, coverage afk.ts 98.18% lines and 93.64% branches, coordinator.ts 99.32% lines and 95.58% branches; lint, typecheck, wiki, skills, governance, rules, compliance, changelog and memory guards passed. sandbox:smoke (Docker) not run locally."
  - "VERIFIED: the first red run also failed coordinator-entry.test.ts 1 of 12 (the import-freshness test), because the harness started importing coordinator.ts; the fix commit moved that file off the harness."
  - "INFERRED: relayed coordinator message (2026-10-19): an independent verifier passed PR 57 at df81f41 with two MEDIUM and two LOW findings. Its own mutant set killed 8 of 10; the survivors were entry.work === 'worked' in place of !== 'empty' (no test for an unhanded branch with unrecognised work) and the uncovered failed-round return in coordinator.ts (lines 249-250), whose mutant only makes afk refuse more. It also showed that a merged unhanded branch deleted during the loop gets past the guard (see Discovered work)."
  - "VERIFIED: review fixes test first. Red at 56540b8: afk.test.ts failed 1 of 81 (a directory at the record path threw EISDIR before the loop); the new unrecognised-work unhanded cases passed, since the code already refused them, and the mutant below shows the test now covers them. Green at 1c0506c: afk.test.ts 81 of 81."
  - "VERIFIED: the mutant script rerun at 1c0506c with three new mutants, each restored: only worked unhanded branches refused killed (3 failures); an uncleared record not refused killed (1); the clearing failure rethrown killed (1). The ten earlier mutants gave the same results (nine killed, the equivalent typeof-object mutant survived)."
  - "INFERRED: relayed coordinator message (2026-10-19): the re-review passed PR 57 at f6fad15, with two LOWs: readiness deleted the record even when afk then refused for another reason, and the usage text did not list the record-path refusal."
  - "VERIFIED: second review fixes test first. Red at 90e0fc0: afk.test.ts failed 2 of 83 (code on the branch beside a record: the refusal deleted the record; the parent test counts too). Fix at 3a70ea8: readiness checks the record path with lstat and a write check on its directory, and afk deletes it only after every pre-loop check passed. A case for a record in a directory afk may not write was added at 1da9ee0, after the fix, to kill the permission-check mutant. Green at 1da9ee0: afk.test.ts 84 of 84."
  - "VERIFIED: mutant script rerun at 1da9ee0, 15 mutants, each restored, 14 killed: record deleted during readiness (2 failures), unremovable record not refused (3), a directory counted as removable (2), directory permission not checked (2), stale record not removed (2), and the ten earlier ones as before. The equivalent typeof-object mutant still survives."
  - "INFERRED: the record is written by the host coordinator after the merger returns, so a merger that plants a record is overwritten; a merger that replaces the record path with a symlink is not handled. The tests use scripted loops and the fake SDK; no real merger or Docker run was made."
  - "VERIFIED: on 2026-10-19 gh pr view 57 reported MERGED by the code owner's account as d7890ee, and git merge-tree --write-tree d7890ee^ 48b9490 gave d7890ee's own tree, so main received exactly the reviewed head 48b9490 (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (a Claude Code verifier subagent on Opus 5.5, claude-opus-5-5, in a separate context), relayed by the coordinator on 2026-10-19 and not reproduced here, 48b9490 rated PASS."
---

## Goal

`npm run sandcastle:afk` lands, after any loop exit, only the `sandcastle/issue-<N>` branches the
coordinator handed the merger in that run.

## Inputs

- The S09 ticket's Discovered work (the verifier's MEDIUM) and the S16 ticket's Discovered work.
- `scripts/sandcastle/afk.ts` (`main`, `classify`, `mergedBranches`) and `afk.test.ts`.
- `scripts/sandcastle/coordinator.ts` (`runSandcastle`, `coordinate`, `report`) and
  `scripts/sandcastle/run-result.ts` (`RunResult`, `IssueResult`), read after S11 has landed.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, the afk steps.

## Approach

1. Write the failing test first in `afk.test.ts`: a loop that exits 2 having merged one handed
   issue and one issue it was not handed; afk today lands both.
2. Make the coordinator's record of which issues it handed the merger reach afk. `afk.ts` starts
   `.sandcastle/main.ts` as a child process, so the record has to cross that boundary (for example
   a result file the coordinator writes and afk reads and validates). Choose the narrowest path.
3. Change `classify` to land only the handed issues. Report a merged branch the merger was not
   handed as not landed, by issue number, and exit 2.
4. Treat a missing or malformed record as a refusal to land anything, not as permission to fall back
   to Git's merged list.
5. Update the runbook's afk section to say what afk lands and what it refuses.

## Acceptance criteria

- [x] A test in `scripts/sandcastle/afk.test.ts` fails on main and passes after the fix: after a loop
      exit 2, a branch merged without being handed to the merger is neither pushed nor commented, and
      afk names it and exits 2.
- [x] A test shows a handed, merged issue still lands after exit 2 and after exit 0.
- [x] A test shows a missing or malformed coordinator record lands nothing and exits 2.
- [x] A test in `scripts/sandcastle/coordinator.test.ts` shows the coordinator records exactly the
      issues it handed the merger.
- [x] Each new refusal is shown by a planted mutation that a test catches; the counts are recorded.
- [x] The runbook's afk section states the new rule; `npm run check` passes.

## Out of scope

- Trusted merging or publication (S16) and the public-command cutover (S18).
- Verifying commits the merger adds after a merge (S18) and durable retry state (S17).
- Changing what the merger is allowed to do inside the loop.

## Allowed files

- `scripts/sandcastle/afk.ts`, `scripts/sandcastle/afk.test.ts`.
- `scripts/sandcastle/coordinator.ts`, `scripts/sandcastle/coordinator.test.ts`,
  `scripts/sandcastle/coordinator-entry.test.ts`.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files. If the record cannot reach afk without changing `.sandcastle/main.ts` or
`scripts/sandcastle/run-result.ts`, stop and name the file and the reason; the coordinator asks the
owner.

## Human checkpoints

Verify that the owner merged the records PR adding this ticket, and that S11's PR 50 has merged,
before starting. Ask the owner if the fix would change which issues afk lands after a loop exit 0.

## Secrets needed

None. Tests use the fake SDK and temporary git repositories; no model or GitHub call.

## Tests and evals

- `node --test scripts/sandcastle/afk.test.ts scripts/sandcastle/coordinator.test.ts`; `npm run check`.
- Positive: a handed issue merged and landed after exit 0 and after exit 2.
- Broken: an unhanded merged branch after exit 2; a missing record; a malformed record; a record
  naming an issue whose branch is not merged.

## Rollback and recovery

If the change refuses legitimate work, keep the refusing controls and fix the narrow read of the
record. Do not restore landing from Git's merged list as a fallback. Use a reviewed revert if needed.

## Evidence

Record the red and green runs with counts, the mutants and their results, and the independent review
of the final head.

## Allowed-file exception

`scripts/test-support/afk-harness.ts` changed outside the allowed files, with the owner's approval
quoted in the evidence: the fake loop writes the coordinator's record (`Script.handed`).
`coordinator-entry.test.ts` (allowed) stopped importing the harness, because the harness now loads
`coordinator.ts` before that file's import-freshness test.

## Wiki and doc updates

The afk section of [[Run Sandcastle on GitHub issues]] and this ticket.

## Discovered work

- The record holds the handed branches, not their reviewed SHAs. A handed issue whose branch moved
  after its review (the coordinator reports it not integrated) still lands if the merger merged
  it anyway. Verifying merged commits against the reviewed SHA probably belongs to S18.
- The guard reads branch names, so it holds only for issue branches still present after the loop.
  The verifier showed two ways past it at df81f41. An unhanded branch that existed before the loop,
  merged and then deleted, is only warned about as deleted; issue 4 still landed and the run exited
  2. A branch created, merged and deleted during the loop is not seen at all; issue 4 landed with
  exit 0. This predates S27 and is the same class as a merger committing straight onto HEAD, so it
  belongs to S18's checking of merged commits. A possible narrow refusal for the first case: refuse
  when a deleted issue branch's pre-loop tip is now in HEAD. It is not built and needs the owner.
- A merger with a shell on the checkout could replace `.git/sandcastle-handed.json` with a symlink
  before the coordinator writes it; the write and afk's read would follow the link. Neither checks
  for that.

## Implementation

- PR 57, branch `fix/s27-afk-handed-issues`: red d3440a9, fix 8c820ee; review fixes red 56540b8, fix 1c0506c; second review fixes red 90e0fc0, fix 3a70ea8, test 1da9ee0.
