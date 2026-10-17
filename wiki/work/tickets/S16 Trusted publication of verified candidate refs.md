---
type: ticket
title: S16 Trusted publication of verified candidate refs
summary: Publish only receipt-bound candidate refs through pinned host tooling while preserving actor, repository, branch and owner-review protections.
tags: [area/git, area/github, area/agents]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and every parent, then test the isolated publication path without executing candidate code on the host.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S05 Checked-commit publication invariant]]", "[[S06 Exact PR destination and head identity]]", "[[S13 Candidate artifact contract and quarantine]]", "[[S15 Independent isolated verification receipts]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S16, the A01 publication boundary and A04/A05 invariants, with its four named parents."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Hand the intended independently verified commit to the correct PR using trusted host tooling, never candidate scripts or hooks.

## Inputs

- Plan S16, landed publication-state and PR-identity checks, S13 artifact validation and S15 receipt authority.
- Inspect `pr-ready.ts`, branch-policy/guard logic and `.githooks/pre-push` to identify every host executable.
- Read the recorded machine-account environment limitation before any authorized publication.

## Approach

1. Publish from a pinned trusted control checkout, accepting only the validated ref and receipt context.
2. Reuse the existing actor/repository/branch checks without pretending control-checkout tests verify candidate code.
3. Integrate the hook/check contract explicitly; no generic unchecked skip or `--no-verify` path.
4. Preserve post-push recovery information if PR creation or lookup fails.

## Acceptance criteria

- [ ] Unverified refs, stale/forged receipts, wrong destinations or PR identities cannot publish successfully.
- [ ] Owner/code-owner credentials, main pushes, history rewrites and protection bypasses remain refused.
- [ ] A valid receipt-bound candidate creates or reuses the exact intended PR.
- [ ] Tests prove the source of each host-side executable; planted candidate scripts/hooks never run on the host.
- [ ] Candidate verification is distinguished from control-checkout checks, and a post-push failure is reported accurately.

## Out of scope

Owner approval/merging, credential-profile repair, notification retries and public CLI cutover.

## Allowed files

- New `scripts/sandcastle/isolated-publication*.ts` with sibling tests; `scripts/sandcastle/artifact*.ts`, `scripts/sandcastle/quarantine*.ts`, `scripts/sandcastle/verification-receipt*.ts` for explicit integration.
- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`, `.githooks/pre-push`, `scripts/git/hooks.test.ts`, `scripts/git/branch-guard.test.ts`, `scripts/git/branch-policy.test.ts` for preserved invariants.
- `wiki/reference/Merge gate contract.md`, `wiki/runbooks/Land a change.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; particularly CODEOWNERS, GitHub rulesets, owner credentials and candidate-supplied host executables.

## Human checkpoints

Verify approval and all parent landings. Request explicit authorization for an additional live publication trial; ordinary implementation-PR publication follows the existing workflow. Stop if hook compatibility would require bypassing protections.

## Secrets needed

None for fake-service/local-remote tests. Authorized publication uses the machine account in a validated context; no credential is copied into the guest, repository or evidence.

## Tests and evals

- `node --test "scripts/git/*.test.ts" "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Positive: real local Git transport with a valid receipt and controlled correct GitHub response.
- Broken: each identity/receipt/actor/ref violation, planted candidate executables and failure after push. Assert no forbidden remote write and preserve truthful partial-state reporting.

## Rollback and recovery

Inspect remote state before retrying an ambiguous push/PR result. Preserve verified refs and receipts; never force-push or repeat a write blindly. Repair through a new PR.

## Evidence

Record checked/published SHAs, actor/repository checks, executable provenance, hook behavior, fake/live boundaries and independent verification.

## Wiki and doc updates

Update the merge-gate contract and publication recovery instructions to match the isolated path without claiming the manual path changed unless it actually did.
