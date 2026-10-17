---
type: ticket
title: S14 Isolated coordinator preparation and export
summary: Run the coordinator and workers inside the proven disposable boundary and return untrusted candidate and recovery artifacts through the defined contract.
tags: [area/agents, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify job approval and every listed parent, then implement the isolated preparation/export stage without public-command cutover.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]", "[[S09 Explicit phase outcomes and review eligibility]]", "[[S10 Blocked-queue planning contract]]", "[[S11 Non-executable branch inputs]]", "[[S12 Reproducible runtime and real containment control]]", "[[S13 Candidate artifact contract and quarantine]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S14, finding A01 and its six named prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Prepare and execute an isolated run that returns candidate/recovery data without granting publication authority.

## Inputs

- Plan S14 and the research ticket; read all landed parent interfaces and S12's actual container proof.
- Use S13's artifact schema, S09/S10 outcomes and S11's safe review-input handling rather than competing contracts.
- Read the current image and entry points to identify every host-executed operation.

## Approach

1. Build a pinned host launcher outside the candidate checkout, capturing the trusted starting inputs.
2. Execute the coordinator with the SDK's local provider only inside the outer disposable environment, with sanitized environment and bounded resources.
3. Collect validated candidate exports and bounded unfinished-work artifacts before teardown; preserve recoverable state on interruption.
4. Expose a clearly named preparation boundary for tests/operators; reserve public-command cutover for S18.

## Acceptance criteria

- [ ] The actual coordinator and SDK Git cleanup run inside the proven boundary, not on the host.
- [ ] No host Git directory, working checkout, home or runtime-control socket is exposed; unsafe or missing runtime configuration refuses.
- [ ] Candidate exports satisfy S13 and preserve pinned identities; guest phase labels cannot authorize verification or publication.
- [ ] Failure, timeout, signal and interrupted collection preserve recoverable work and cannot claim completed publication.
- [ ] Real-container fake-agent controls exercise preparation/export; no live model or GitHub write credential is needed for tests.

## Out of scope

Authoritative verification receipts, final publication, durable cross-run retry orchestration and public-command cutover.

## Allowed files

- New `scripts/sandcastle/isolated-run*.ts`, `scripts/sandcastle/guest-runner*.ts`, `scripts/sandcastle/prepare-run*.ts` and shared `scripts/sandcastle/container-runtime*.ts`, each with sibling tests.
- `scripts/sandcastle/coordinator*.ts`, `scripts/sandcastle/containment-smoke*.ts` and `.sandcastle/Dockerfile` for the actual stage integration.
- `package.json` only for an independently useful preparation command; `scripts/test-support/isolated-run-*.ts` and `scripts/test-support/containment-*.ts` support files.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; do not rewire existing `sandcastle`/`sandcastle:afk` public commands, publish refs, mount host control sockets or create a host-execution fallback.

## Human checkpoints

Verify job approval and all parent landings. Stop if the real containment control fails. Infrastructure installation, paid services and live credential use require the owner's explicit authorization.

## Secrets needed

None for regression proof. Authorized production runs receive only explicitly scoped runtime credentials through the established boundary; never copy the host credential store.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Extend S12's real runner to exercise the actual coordinator with a fake agent and inspect launch parameters plus collected artifacts.
- Positive: bounded preparation produces a candidate marked unverified. Broken: unsafe mounts, absent runtime, fake completion labels, timeout/crash and interrupted export. Assert host sentinels remain untouched and recovery data survives.

## Rollback and recovery

Retain run-owned recovery artifacts and diagnostics before removing disposable resources. Refuse the new stage if unsafe; never recover by executing the coordinator on the host. Repair/revert through a PR.

## Evidence

Record pinned inputs, runtime/image identity, launch configuration, actual execution path, artifact identities, interruption results and matching-head container CI evidence.

## Wiki and doc updates

Document the preparation boundary and its limits, cleanup ownership and recovery procedure. Keep public-command documentation clear about the later S18 cutover.
