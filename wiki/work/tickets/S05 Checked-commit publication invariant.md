---
type: ticket
title: S05 Checked-commit publication invariant
summary: Prevent publication when checks change the branch, commit or relevant repository state, and certify only the captured checked SHA.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges its pull request.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S02 Explicit-checkout command routing]]", "[[S04 Content-sensitive working-state snapshots]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S05, finding A04 and its S02/S04 prerequisites."
  - "OWNER DECISION: job-spec approval is PR 17, merged by the code owner; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parents S02 (PR 21) and S04 (PR 23) are MERGED (gh pr view); this branch starts from origin/main 33e776f."
  - "VERIFIED: at test commit 104f212, node --test scripts/git/pr-ready.test.ts against the base pr-ready.ts failed 16 entries: every state change during a passing or failing check (a commit, a branch switch, a new ref, local config, a staged file, a working-tree file), the replacement-commit control, the redaction case and the exact-SHA push. Under the base code a passing check that commits is pushed with PR_READY_CHECKED set to the replacement commit."
  - "VERIFIED: at fix commit 72d261b, node --test on pr-ready, git-state and hooks tests passed 125 of 125; npm run lint and npm run typecheck exit 0."
  - "VERIFIED: seven planted mutations of pr-ready.ts each failed tests: no comparison (15), comparing only after a pass (7), hiding the check failure when state changed (7), snapshotting after the check (15), pushing the branch name instead of the SHA (1), certifying a different commit (1) and not setting the upstream (1)."
  - "VERIFIED: git push --set-upstream with a SHA source pushes but sets no upstream (probe in a scratch repository), so pr-ready writes branch.<name>.remote and branch.<name>.merge after the push."
  - "VERIFIED: an independent verifier (Claude Code subagent, Opus 5.5, separate context) rated b6358df PASS with all five criteria met, reproducing the 16 red failures, 125 of 125 green, a real npm run check leaving git-state unchanged, branch-guard still refusing a rewrite pushed by SHA, and 9 of its 11 mutations caught (the two survivors equivalent). It found one MEDIUM: with a fetch refspec covering only main, git branch --set-upstream-to failed after the push, so no pull request was opened; and three LOWs: the PR_READY_CHECKED sentence said the hook compares the pushed commit (it compares HEAD), the refusal said the commit was not the one checked when only other state changed, and GitState was exported unused."
  - "VERIFIED: a new pr-ready test with the fetch refspec narrowed to main failed with exit 128 from git branch --set-upstream-to; after writing the tracking config directly it passes, the three test files pass 126 of 126, and dropping either config line fails a test. The three LOWs are fixed."
  - "INFERRED: the verifier also reported that a guard hook blocked one of its scratch commands (a push to main on a throwaway local bare remote) and that it then wrote a later command's refspec as a split string so the command text would not look like a push to main. git ls-remote showed origin unchanged afterwards (main at 33e776f, no new branches); the owner was told."
  - "VERIFIED: .githooks/pre-push is unchanged; it still runs branch-guard push before the PR_READY_CHECKED skip, and hooks.test.ts pins that order."
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

- [x] The old tool fails a control where a successful check changes HEAD and publication would certify the replacement.
- [x] HEAD moves, branch switches and relevant working/config/index/ref changes prevent pushing on both success and failure paths.
- [x] An unchanged passing check publishes the captured SHA; failed checks never publish.
- [x] A state mismatch names the changed class without leaking configuration or file contents.
- [x] Pre-push still applies branch protections; no generic skip flag or `--no-verify` path is added.

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
