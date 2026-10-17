---
type: ticket
title: S12 Reproducible runtime and real containment control
summary: Align the sandbox toolchain and add a required real-container, non-model control proving the selected boundary before runtime integration.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S01 completion, then establish the real containment control in a Docker-capable environment before dependent isolation work.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Docker-capable containment proof is unavailable locally]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S12, finding A14, the A01 boundary proof and its S01 prerequisite."
  - "UNKNOWN: job-spec approval, real containment and implementation evidence are pending."
---

## Goal

Establish a reproducible Node-24 runtime and an actual container proof that gates the selected isolation design.

## Inputs

- Plan S12, audits A01/A14 and the source-level isolated-handoff research.
- `.nvmrc`, package lock, `.sandcastle/Dockerfile`, current workflows and the verification feature map.
- A Docker-capable local environment or CI runner. Local absence is a recorded limitation, not passing proof.

## Approach

1. Align and record the image/toolchain and use lockfile-based dependency installation.
2. Add a real-container smoke runner using the pinned SDK's create/cleanup path and a fake agent or harmless sentinels.
3. Wire the runner into the existing required check job while keeping ordinary authoring checks independent of local Docker.
4. Make missing runtime and unsafe launch configurations explicit non-success outcomes.

## Acceptance criteria

- [ ] Runtime/SDK/image identities and dependency installation are reproducible and recorded; Node matches the declared version.
- [ ] The guest image can run the declared repository check toolchain, including Python's `evals:test`, on a disposable known-good checkout.
- [ ] Real SDK create/cleanup executes inside the disposable boundary; planted hook/fsmonitor sentinels never execute on the host.
- [ ] Host Git metadata, working checkout, home and runtime-control sockets are not exposed; configuration violating the boundary refuses.
- [ ] The real smoke command is executed by required CI at the implementation SHA, without model credentials or paid calls.
- [ ] Missing Docker is blocked proof, never a successful skip; unit tests alone are not presented as containment evidence.

## Out of scope

Production agent orchestration, verified publication, cloud provisioning and paid model evaluation.

## Allowed files

- `.sandcastle/Dockerfile`, `.dockerignore` or `.sandcastle/.dockerignore` as appropriate to the actual build context.
- New `scripts/sandcastle/containment-smoke*.ts` with sibling unit tests; bounded fixture support under `scripts/test-support/containment-*.ts`.
- `package.json`, `.github/workflows/check.yml`, `scripts/lib/change-policy.ts` and its test if new runtime paths need classification.
- `CLAUDE.md`, `README.md`, `.claude/skills/verify-work/references/feature-map.md`, `wiki/runbooks/Verify a repository change.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket, its linked environment issue and a new `changelog/` fragment.

## Forbidden files

All other files; no host Docker-socket mount, privileged workaround, credential copying or branch-ruleset changes.

## Human checkpoints

Verify job approval and S01 landing. Obtain owner authorization for installing local infrastructure or paid services; an existing Docker-capable CI runner can supply the proof. Stop if the selected boundary cannot be established.

## Secrets needed

None for the smoke test. Fake agent/service inputs must not require real model or GitHub write credentials.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Create and wire `npm run sandbox:smoke` in this slice; document its exact prerequisites. It is a proposed new command, not an existing passed check.
- Positive: guest toolchain checks, actual isolated SDK cleanup and expected artifact collection. Broken: host-execution sentinel, prohibited mount, missing runtime/toolchain and nonzero guest result. Capture matching-head CI evidence for the real test.

## Rollback and recovery

Remove only this run's disposable resources after preserving diagnostics. If containment fails, keep automation refused; never fall back to host execution. Repair/revert through a PR.

## Evidence

Record image/tool versions, launch parameters without secrets, actual SDK path, host/guest sentinel observations, exits and CI URL. Require independent inspection of the real boundary result.

## Wiki and doc updates

Update the real verification recipe, CI/local-check distinction, runtime prerequisites and environment issue only with observed results.
