---
type: ticket
title: S27 Afk lands only issues handed to the merger
summary: After a loop exit 2, npm run sandcastle:afk lands only the issue branches the coordinator handed the merger, not every sandcastle/issue-<N> branch Git shows merged.
tags: [area/agents, area/git, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: agent
priority: P2
next_action: Owner review of the records PR that adds this ticket; once it and S11's PR 50 have merged, build it in a fresh session from current main.
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

- [ ] A test in `scripts/sandcastle/afk.test.ts` fails on main and passes after the fix: after a loop
      exit 2, a branch merged without being handed to the merger is neither pushed nor commented, and
      afk names it and exits 2.
- [ ] A test shows a handed, merged issue still lands after exit 2 and after exit 0.
- [ ] A test shows a missing or malformed coordinator record lands nothing and exits 2.
- [ ] A test in `scripts/sandcastle/coordinator.test.ts` shows the coordinator records exactly the
      issues it handed the merger.
- [ ] Each new refusal is shown by a planted mutation that a test catches; the counts are recorded.
- [ ] The runbook's afk section states the new rule; `npm run check` passes.

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

## Wiki and doc updates

The afk section of [[Run Sandcastle on GitHub issues]] and this ticket.
