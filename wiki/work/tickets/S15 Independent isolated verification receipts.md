---
type: ticket
title: S15 Independent isolated verification receipts
summary: Produce trusted verification receipts in fresh isolated contexts, bound to the actual candidate, inputs, check runner and reviewer.
tags: [area/agents, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify job approval and S12/S13 completion, then prove the receipt authority boundary independently of builder output.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S12 Reproducible runtime and real containment control]]", "[[S13 Candidate artifact contract and quarantine]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S15, findings A01/A13 and its S12/S13 prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make independent verification evidence authoritative only when trusted supervision produced it for the exact unchanged candidate and inputs.

## Inputs

- Plan S15 and target evidence contract, S12's proven runtime and S13's candidate envelope.
- Read existing finder/verifier briefs, shared state helpers and the approved partial-failure policy.
- S14 is not a prerequisite: use valid fixture candidates when its launcher is not yet available.

## Approach

1. Reconstruct the candidate in a fresh verification environment without implementer session/state or writable volumes.
2. Run trusted check definitions and an independent reviewer, treating check-machinery changes as explicit review inputs.
3. Have trusted supervision issue/store the receipt outside builder authority, binding repository, task/base/candidate identities, runner/reviewer/image versions, commands, outcomes and log digests.
4. Validate receipt origin and context, not merely plausible JSON or a matching SHA string.

## Acceptance criteria

- [ ] A passing unchanged candidate can receive a receipt from the real trusted driver; builder-written success cannot.
- [ ] Forged or tampered receipts, wrong run/task/base/candidate, missing review and changed check state refuse.
- [ ] An integration producing a new SHA needs new verification; authorized reuse is limited to unchanged inputs and trusted stored evidence.
- [ ] Reviewer mutation invalidates its verdict. A candidate rewriting its check command to a no-op is not accepted solely because that command exits zero.
- [ ] Tests establish isolation and receipt ownership; an absent reviewer/runtime reports blocked proof rather than success.

## Out of scope

Public-command cutover, live publication, payment authorization and a claim that model judgment is infallible.

## Allowed files

- New `scripts/sandcastle/verify-candidate*.ts`, `scripts/sandcastle/verification-receipt*.ts`, `scripts/sandcastle/verifier-driver*.ts` and shared `scripts/sandcastle/container-runtime*.ts`, with sibling tests.
- `scripts/sandcastle/artifact*.ts`, `scripts/sandcastle/quarantine*.ts`, `scripts/sandcastle/containment-smoke*.ts` only for tested integration; `scripts/test-support/verifier-*.ts` support files.
- `.sandcastle/Dockerfile` only for packaging the trusted verifier/profile while retaining S12's containment controls.
- `package.json` for a used verification command, `wiki/runbooks/Verify a repository change.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no generic trust/skip flag, acceptance of guest-chosen host paths, credential-store access or publishing of candidates.

## Human checkpoints

Verify approval and parent landings. Stop for owner review if the proposed receipt can be forged by the builder or a scope change is needed to establish authority. Paid/live reviewer trials require explicit authorization.

## Secrets needed

None for tests. Keep any implementation-specific authority material outside guest access and out of source/evidence; do not invent or commit a production secret.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Positive: trusted verification of a fixed fixture candidate and authorized unchanged-input reuse.
- Broken: forged matching-SHA JSON, replay under changed inputs, candidate mutation, missing review, no-op check machinery and shared implementer state. Exercise receipt issuance and validation through the actual driver, with fake external model responses.

## Rollback and recovery

Preserve candidate bundles and private diagnostics. Invalidate unusable receipts instead of loosening validation; never publish on a missing proof. Repair/revert through a PR.

## Evidence

Record the trusted issuer path, bound identities, command results, isolation observations, refusal matrix and independent review. Keep runtime/model evidence limits explicit.

## Wiki and doc updates

Document what a receipt establishes, where its authority originates and when it becomes stale. Add the actual verification command to the canonical recipes.
