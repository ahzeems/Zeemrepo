---
type: ticket
title: S26 Evidence-based token setup guidance
summary: Correct token setup guidance so identity, expiry and write permission are supported by the checks that actually establish them.
tags: [area/auth, area/docs, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify job approval and S01 completion for safe hook-run checks, then verify the token guidance against primary sources.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Sandcastle token setup lessons]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S26, finding A16 and its S01 safe-verification prerequisite."
  - "UNKNOWN: job-spec approval and documentation verification are pending."
---

## Goal

Provide token instructions whose identity, expiry and permission claims match their actual evidence.

## Inputs

- Plan S26, audit A16, the Sandcastle runbook's Token setup section and Sandcastle token setup lessons.
- Read current primary GitHub token/permission documentation and record the access date.

## Approach

1. Remove expiry-as-identity reasoning and distinguish a read-only diagnostic from proof of write capability.
2. Check version-sensitive resource-owner, permission and approval claims against primary sources; keep unverified observations labeled.
3. Preserve a clear, separately authorized write-capability trial without printing or storing token values.

## Acceptance criteria

- [ ] Equal expiry is not presented as proof that the old token remains or as a required difference between tokens.
- [ ] Instructions distinguish the authenticated identity, optional expiry metadata and a real write-permission result.
- [ ] Primary sources and read dates support version-sensitive claims; unsupported categorical claims are corrected or explicitly uncertain.
- [ ] Any live write trial has explicit owner authorization and records the observed actor/result without secrets; no mock is claimed as real permission proof.
- [ ] Wiki/governance/full checks pass and the operating guidance agrees with its evidence record.

## Out of scope

Generating/revoking tokens, repairing local auth profiles, changing organization policy or conducting an unapproved live trial.

## Allowed files

- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `wiki/work/ideas/Sandcastle token setup lessons.md`.
- This ticket and a new `changelog/` fragment; update a directly affected memory-index summary only if its meaning changes.

## Forbidden files

All other files; credential stores, env-file values, repository/organization settings and historical decision/session bodies.

## Human checkpoints

Verify job approval and S01 landing. Ask before any authenticated write trial and name its exact target; the owner performs credential/organization changes.

## Secrets needed

None for source-based documentation work. An authorized trial uses an existing scoped credential through the documented environment without exposing its value.

## Tests and evals

- `npm run wiki:lint`; `npm run governance:check`; `npm run check`.
- Positive: a distinct token may share an expiry, and a valid identity read is described only as identity evidence.
- Broken reasoning control: a read-only token can pass read diagnostics but fail a comment; the instructions must require actual write evidence for the stronger claim.
- Review the final commands for failure handling and source support. Do not invent tests mirroring prose or claim an unperformed live permission check.

## Rollback and recovery

Correct current guidance with observed facts while preserving historical observations as history. No token or account rollback is performed by this documentation job.

## Evidence

Record primary URLs/access dates, the claims they support, documentation check exits and any explicitly authorized live result, with independent review.

## Wiki and doc updates

Update the current runbook and owning evidence record, retaining the distinction between observed history and verified current guidance.
