---
type: ticket
title: S13 Candidate artifact contract and quarantine
summary: Validate candidate manifests and explicit-ref bundles as untrusted data without activating candidate code or importing guest Git metadata.
tags: [area/git, area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S02/S03 completion, then implement bounded candidate validation against real disposable repositories.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S02 Explicit-checkout command routing]]", "[[S03 Fresh pinned main revisions]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S13, finding A01 and its S02/S03 prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Accept only bounded, identity-consistent candidate artifacts into quarantine, without trusting guest success claims.

## Inputs

- Plan S13 and the target execution/evidence contract; read the Git-bundle experiment in the research ticket.
- Landed checkout routing and fresh-main contracts; `scripts/test-support/repo-fixture.ts` and shared CLI/record helpers.

## Approach

1. Define the versioned candidate manifest and explicit allowed refs around pinned repository/base/task/candidate identities.
2. Validate artifact types, limits, prerequisites and object identities in fresh repositories with trusted configuration.
3. Keep candidate phase claims and unfinished-work recovery data distinct from authoritative verification and publishable refs.

## Acceptance criteria

- [ ] A valid full/incremental candidate preserves its exact SHA and expected ancestry.
- [ ] Wrong version/ref/base/candidate, missing prerequisites, malformed or oversized data and unsafe file types refuse.
- [ ] No guest Git configuration, hook metadata or manifest command executes on the host.
- [ ] Tracked hook/script files remain untrusted candidate content; no candidate checkout is performed by validation.
- [ ] Recovery data is bounded and never restored into the host working checkout; builder success labels confer no publication authority.

## Out of scope

Running agents, issuing verifier receipts, publication or treating a bundle as a backup of uncommitted work.

## Allowed files

- New `scripts/sandcastle/artifact*.ts` and `scripts/sandcastle/quarantine*.ts` modules with sibling tests.
- Bounded fixture support under `scripts/test-support/artifact-*.ts`; generated bundles stay in disposable directories.
- `package.json` only for an actually used validation CLI, `.claude/skills/verify-work/references/feature-map.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no real candidate checkout, host Git configuration, credentials or publishing endpoints.

## Human checkpoints

Verify job approval and both parent landings. Ask before widening accepted artifact/ref types or adding a dependency; limits and trust boundaries must be explicit in review.

## Secrets needed

None. Artifacts must not carry runtime credentials or private environment values.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`; exercise any new validation CLI through valid/broken fixtures.
- Positive: exact-SHA full and prerequisite-satisfied incremental bundles.
- Broken: each identity/format/limit failure independently, symlinks and traversal-like artifact names, unexpected refs, embedded executable metadata and forged phase labels. Assert no host-side sentinel execution or checked-out candidate files.

## Rollback and recovery

Keep rejected artifacts quarantined for bounded diagnostics and remove only owned temporary state. Never import or execute a rejected artifact to recover from validation failure.

## Evidence

Record manifest/version controls, advertised/imported SHAs, prerequisite/ref checks, sentinel results and independent review.

## Wiki and doc updates

Document the implemented artifact and rejection contract, including recovery-data limits and what it does not certify.
