---
type: ticket
title: S09 Explicit phase outcomes and review eligibility
summary: Implement the approved phase outcomes so failures cannot report success and only checked, reviewed results are eligible for integration.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S08 completion, then encode the approved outcomes in the actual coordinator and review contract.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S09, finding A10 and its S08 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
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

- [ ] All agent creations failing, exhausted work and failed integration cannot end as a successful completed run.
- [ ] Failed, absent, malformed or stale review outcomes hold that issue out of integration.
- [ ] A reviewer edit cannot certify the edited result without a new independent review.
- [ ] Passing independent issue A remains eligible when B fails; the overall result is incomplete/nonzero and identifies B.
- [ ] Explicit 0/1/2 mapping follows the shared CLI conventions; phase claims alone do not authorize publication.

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
