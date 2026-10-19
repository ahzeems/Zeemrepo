---
type: ticket
title: S17 Durable recovery and notification reconciliation
summary: Resume missing phases from trusted durable state while preserving work and reconciling ambiguous publication or notification delivery.
tags: [area/agents, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: done
owner: agent
priority: P1
next_action: None. It landed as PR 59 (8a00e16). S18 wires recoverIssue and recoverRun into the public Sandcastle commands; the Discovered work, the untested default store label and the notification questions continue as idea notes that link this ticket.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S09 Explicit phase outcomes and review eligibility]]", "[[S13 Candidate artifact contract and quarantine]]", "[[S15 Independent isolated verification receipts]]", "[[S16 Trusted publication of verified candidate refs]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S17, A10 recovery behavior and its four named prerequisites."
  - "VERIFIED: job-spec approval is PR 17 and the parents landed: S09 as PR 45 (13c3b11), S13 as PR 37 (fdd46ff), S15 as PR 49 (caa99e3), S16 as PR 53 (2a4bf7a); S10's blocked outcome is PR 54 (40aba24). gh pr view on 2026-10-19 reported each MERGED by the owner. This branch starts from origin/main 4c56101. Implemented by Claude Code (claude-opus-5-5)."
  - "VERIFIED: red at c148b61 (tests and typed stubs, needed because the pre-commit hook runs lint and typecheck): run-state.test.ts failed 5 of 5, notifications.test.ts 6 of 6, recovery.test.ts 10 of 10, run-result.test.ts 1 of 17. Green at a71a775: 5 of 5, 6 of 6, 10 of 10 and 17 of 17; node --test over scripts/sandcastle/*.test.ts passed 481 of 481."
  - "VERIFIED: a mutation run planted 20 mutants, each restored, and all 20 failed a test: state written in place (3 failing) or without the rename (3); incompatible version accepted (1); foreign issue state accepted (1); group-writable state accepted (1); a marker by any login counts (1); no reconciliation before posting (1); posting when the issue cannot be read (2); notice posted without its marker (2); any recorded receipt stands (1); a new verification keeps later phases (1); changed inputs reuse old state (1); failed verification publishes (2); publication attempt not recorded first (1); delivered publication repeated (2); delivered notification repeated (1; it first survived because delivery reconciles anyway, so a71a775 asserts that a rerun reads no issue); state store placement unchecked (1); torn artifact proceeds (1); published not settled (2); a verifier throw escaping the issue (1)."
  - "VERIFIED: recovery tests run the real verifier driver (fake runtime and reviewer), real isolated publication over the file transport to a local bare remote, and a stateful fake gh whose pull requests and comments persist across runs. Exact counts asserted: an unchanged rerun runs no phase and reads no issue (verify 1, publish 1, container runs 1, pull requests 1, comments 1); a lost pull request acknowledgement ends with publish 2, creates 1; a lost comment acknowledgement ends with one comment; crashes before the verification, publication and notification state writes end with one container run, one pull request and one comment; a changed task reverifies (reusing the receipt, no container run) and reconciles without a new write."
  - "VERIFIED: interruption points injected: a verifier killed mid-import (the artifact, recovery.data included, keeps its SHA-256s and the control checkout stays clean), a truncated bundle (failed in import, kept), a save that throws before each of the three phase writes, a torn temporary state file (ignored, previous state read), a forged state naming another candidate's passing receipt and an unmade publication (re-verified and really published), and malformed, foreign, group-writable and version 9 state (refused and kept)."
  - "VERIFIED: at f89e1de npm run check exited 0: 1331 of 1331 tests, coverage all files 99.14% lines, 91.68% branches and 96.11% functions; recovery.ts 98.83% lines and 89.47% branches, run-state.ts 98.55% and 91.18%, notifications.ts 100% and 100%; evals (108 Python tests) and every lint, wiki, skills, governance, rules, compliance, changelog and memory guard passed."
  - "VERIFIED: npm run pr refused twice with 'npm run check changed this repository's git state' (refs changed; then local branch config and refs changed), because other agents' worktrees share this .git, and a third run's push was rejected by GitHub with '(failed)' and no reason; origin/main stayed 4c56101. The fourth run opened PR 59 at bd73ca1, where CI check and guards passed (runs 39239080970 and 39239081608, read with gh run list on 2026-10-19). This completion PR is 59."
  - "VERIFIED: the green commit a71a775 also changed one red-commit assertion in recovery.test.ts (the failed-notification case) from /nothing was posted|could not/ to /did not confirm/. The fake's commentFails fault returns a failed gh issue comment without posting, and notifications.ts cannot tell that apart from a lost acknowledgement, so it reports 'may have been posted, but gh did not confirm it'; the red regex had assumed the earlier read-failure wording. No other assertion changed between red and green."
  - "VERIFIED: review fixes after the independent verifier passed a2f7749 with five LOW findings. Red at ffae3f4: run-result 1 of 18 failed, run-state 1 of 6, recovery 2 of 11 (the new L1 crash case passes on existing code and fails once the notification attempted save is removed). Green at 6133518: 18 of 18, 6 of 6, 11 of 11, verification-receipt 10 of 10, scripts/sandcastle/*.test.ts 484 of 484. Fixes: L1 test for the notification attempted record; L2 store refusals name the run-state store; L3 an issue failed only in notification reads 'published, notification not confirmed' with status and exit unchanged; L5 a landed save removes its issue's stale temporary files, regular files only."
  - "VERIFIED: the mutation run was repeated at 6133518 with 26 mutants (the 20 above plus: notification attempt not recorded first, state store named as the receipt store, unnotified issue called not integrated, stale temporaries kept, stale temporary links removed, other issues' temporaries removed); all 26 failed a test."
  - "INFERRED: the hidden marker on the existing issue-comment channel is reconciliation, not a new notification channel or policy, so no owner decision was sought; the owner can overrule this in review."
  - "UNKNOWN: real gh output for gh api --paginate --jq with tojson was not observed; notifications.ts assumes one JSON object per line, as the fake prints. No real recovery run and no S12 real-container control ran: artifact and runtime behaviour did not change."
  - "VERIFIED: on 2026-10-19 gh pr view 59 reported MERGED by the code owner's account as 8a00e16, and git merge-tree --write-tree 8a00e16^ f55d95e gave 8a00e16's own tree, so main received exactly the reviewed head f55d95e (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (a Claude Code verifier subagent on Opus 5.5, claude-opus-5-5, in a separate context), relayed by the coordinator on 2026-10-19 and not reproduced here, f55d95e rated PASS."
---

## Goal

Recover incomplete work from durable per-issue/per-commit evidence without duplicate publication or notifications.

## Inputs

- Plan S17 and the approved partial-failure decision.
- Landed result, artifact, receipt and publication contracts; inspect AFK's current quiet-rerun and comment behavior.

## Approach

1. Store bounded phase state atomically outside candidate/guest writable state.
2. Bind reusable results to unchanged task, base and candidate inputs; separate recovery snapshots from publishable commits.
3. Reconcile stable remote identifiers/notification markers after ambiguous delivery before issuing another write.
4. Keep failed/unreviewed work held and the overall incomplete outcome nonzero.

## Acceptance criteria

- [x] Restart resumes missing phases instead of rebuilding or reverifying unchanged completed work without reason.
- [x] Changed task/base/candidate inputs invalidate dependent evidence; stale state never authorizes publication.
- [x] Interrupted import and interrupted state persistence preserve enough work to recover without host restoration of guest files.
- [x] A successful remote write followed by lost acknowledgement does not create a duplicate PR or notification on retry.
- [x] Mixed outcomes name held/failed work and remain incomplete/nonzero even when independent successes proceed.

## Out of scope

New notification channels, automatic owner approval, unrelated issue lifecycle changes and generic event-sourcing infrastructure.

## Allowed files

- New `scripts/sandcastle/run-state*.ts`, `scripts/sandcastle/recovery*.ts`, `scripts/sandcastle/notifications*.ts` with sibling tests.
- `scripts/sandcastle/run-result*.ts`, `scripts/sandcastle/artifact*.ts`, `scripts/sandcastle/quarantine*.ts`, `scripts/sandcastle/verification-receipt*.ts`, `scripts/sandcastle/isolated-publication*.ts` for explicit integration; `scripts/test-support/recovery-*.ts` support files.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no host restore from recovery archives, credential stores, approval bypasses or real issue closure.

## Human checkpoints

Verify approval and parent landings. Seek an owner decision for a new notification policy/channel or unrecoverable ambiguity; do not convert it into a silent success.

## Secrets needed

None for regression controls. Authorized production notifications use scoped credentials through trusted tooling; raw logs and credentials are not notification content.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`; run the relevant S12 real-container recovery control when artifact/runtime behavior changes.
- Positive: restart with unchanged inputs resumes only missing phases.
- Broken: crash before/after state writes, interrupted import, lost remote acknowledgement, malformed/stale state and changed inputs. Assert durable work preservation, remote reconciliation and exact write counts through the real recovery logic.

## Rollback and recovery

Retain trusted state, bundles and bounded unfinished-work snapshots for inspection. Fail closed on incompatible state versions; do not delete another run's work or replay writes blindly. Repair/revert through a PR.

## Evidence

Record interruption points, state/identity transitions, resumed phase counts, remote write counts and independent criterion verdicts.

## Wiki and doc updates

Document recovery entry points, retained artifacts, idempotency limits and operator decisions needed after ambiguity. Update the ticket with the actual completion PR.

## Delivery

- `scripts/sandcastle/run-state.ts`: one versioned state file per issue in a host-only store,
  saved by temporary file and rename, refused and kept when it cannot be trusted.
- `scripts/sandcastle/notifications.ts`: an issue comment with a hidden marker, posted only after
  the issue's comments show no marked comment from the same `gh` login.
- `scripts/sandcastle/recovery.ts`: `recoverIssue` and `recoverRun` resume verification,
  publication and notification, bound to the task, base and exact artifact.
- `scripts/sandcastle/run-result.ts`: the settled `published` outcome and the host phases.
  `scripts/sandcastle/verification-receipt.ts` exports its bounded private reader for the state file.
- Runbook section "Durable recovery" and a feature-map row.

## Discovered work

- A recorded `delivered` publication is not checked again: if someone closes the pull request,
  a rerun reports the issue published and opens nothing. Checking that the recorded pull request
  is still open would need a gh read on every rerun.
- `npm run sandcastle:afk` still comments without a marker, so its quiet rerun cannot reconcile a
  lost comment. Moving it onto `notifications.ts` belongs with S18's cutover (or S27, which owns
  `afk.ts`).
- A failed state write stops the whole run, so later issues are not attempted in that run. It is
  a host failure, but the run result then names nothing; S18 should report it as `failed`.
- The `gh api --paginate --jq` line format is only exercised against the fake. A real read-only
  call against a test issue would settle it.

