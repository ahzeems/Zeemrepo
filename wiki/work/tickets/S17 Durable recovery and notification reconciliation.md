---
type: ticket
title: S17 Durable recovery and notification reconciliation
summary: Resume missing phases from trusted durable state while preserving work and reconciling ambiguous publication or notification delivery.
tags: [area/agents, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and all parent landings, then inject interruptions and lost acknowledgements into the actual recovery path.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S09 Explicit phase outcomes and review eligibility]]", "[[S13 Candidate artifact contract and quarantine]]", "[[S15 Independent isolated verification receipts]]", "[[S16 Trusted publication of verified candidate refs]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S17, A10 recovery behavior and its four named prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
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

- [ ] Restart resumes missing phases instead of rebuilding or reverifying unchanged completed work without reason.
- [ ] Changed task/base/candidate inputs invalidate dependent evidence; stale state never authorizes publication.
- [ ] Interrupted import and interrupted state persistence preserve enough work to recover without host restoration of guest files.
- [ ] A successful remote write followed by lost acknowledgement does not create a duplicate PR or notification on retry.
- [ ] Mixed outcomes name held/failed work and remain incomplete/nonzero even when independent successes proceed.

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
