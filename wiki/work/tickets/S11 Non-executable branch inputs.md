---
type: ticket
title: S11 Non-executable branch inputs
summary: Keep branch and ref inputs as data when preparing review diffs and logs, including Git-valid shell metacharacters.
tags: [area/git, area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S08 completion, then reproduce the branch substitution at the actual prompt-preparation boundary.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S11, finding A12 and its S08 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Prevent branch names from becoming executable shell syntax while preparing the intended diff and log.

## Inputs

- Plan S11 and audit A12; inspect the pinned SDK's argument substitution/preprocessing and the review prompt.
- Read the landed coordinator seam and `scripts/sandcastle/branch-guard.ts`.

## Approach

1. Use Git-valid special-character refs and a harmless sentinel in disposable fixtures to reproduce the current substitution.
2. Prefer argument-vector Git calls or verified commit identities over interpolating branch text into shell code.
3. Test the complete preparation path and document any deliberate input refusal.

## Acceptance criteria

- [ ] The old preparation path fails a harmless substitution control before the repair.
- [ ] Ordinary refs still produce the intended diff/log for the captured commits.
- [ ] Git-valid metacharacter/quoting inputs either remain safe data or are explicitly refused before execution; none execute or silently change meaning.
- [ ] A failed or missing ref does not become a misleading empty successful review.
- [ ] Actual preparation tests and the full check pass without live model calls.

## Out of scope

General shell parsing, GitHub issue mutation and unrelated branch-lifecycle policy.

## Allowed files

- `.sandcastle/review-prompt.md`, `.sandcastle/main.ts` only for wiring, `scripts/sandcastle/coordinator*.ts`.
- `scripts/sandcastle/branch-guard.ts`, `scripts/sandcastle/branch-guard.test.ts`; bounded new `scripts/sandcastle/review-input*.ts` with sibling tests if needed.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no sentinel or adversarial Git configuration in the real checkout.

## Human checkpoints

Verify approval and S08 landing. Seek owner agreement before broadening branch-name restrictions beyond what the fix requires.

## Secrets needed

None. Sentinels are harmless fixture-local files or captured output.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Positive: ordinary refs yield correct content and identity.
- Broken: command substitution, quotes and other legal metacharacters; assert no sentinel execution and no truncated/substituted ref. Use the real preparation code, not only a standalone escaping helper.

## Rollback and recovery

On uncertainty, refuse preparation with a named reason rather than executing an unsafe fallback. Preserve fixture evidence and repair/revert through a PR.

## Evidence

Record valid-ref checks, captured Git arguments/results, sentinel observations and independent verification.

## Wiki and doc updates

Replace stale branch-name guidance with the implemented contract and record this ticket's actual limits.
