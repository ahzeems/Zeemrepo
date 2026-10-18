---
type: ticket
title: S12 Reproducible runtime and real containment control
summary: Align the sandbox toolchain and add a required real-container, non-model control proving the selected boundary before runtime integration.
tags: [area/agents, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: blocked
owner: agent
priority: P1
next_action: The owner decides whether a recorded image ID per run satisfies "reproducible" or the Debian packages must be pinned to a dated snapshot archive; a follow-up then ticks the criterion or pins the packages, and S12 is done.
blocker: Owner decision pending on the reproducibility criterion (base image, Claude Code and the npm lockfile are pinned; the Debian packages are not).
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Docker-capable containment proof is unavailable locally]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S12, finding A14, the A01 boundary proof and its S01 prerequisite."
  - "OWNER DECISION: job-spec approval is PR 17, merged by the code owner; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parent S01 landed as PR 18 (875a2e8), an ancestor of origin/main 2832fa9, which this branch starts from."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"CI runners only (Recommended)\" for the containment proof (recorded in Docker-capable containment proof is unavailable locally); on 2026-10-18 the owner said \"go ahead with S12 here\"."
  - "VERIFIED: on 2026-10-18 a scratch probe outside the repository drove the installed @ai-hero/sandcastle 0.12.0 createSandbox/run/close with noSandbox() and a fake agent; the core.fsmonitor command the agent planted ran during close(), after the agent's commit, which is the host-side cleanup path of finding A01."
  - "VERIFIED: at test commit a0e90ae both new test files failed because containment-smoke.ts and containment-smoke-guest.ts did not exist; at 31e7ca5 they pass 25 of 25 and npm run check:base exits 0 with 883 of 883 tests."
  - "VERIFIED: eleven planted mutations each failed tests: dropping the fsmonitor control, the host marker check, the host git-state check, the container inspection, the guest exit check, the mount allowlist, the credential and launch environment checks or the --mount refusal, treating missing Docker as a pass, and removing the planted fsmonitor from the guest."
  - "VERIFIED: npm run sandbox:smoke on this machine, which has no Docker, printed 'blocked: Docker is not available here ... This is not a pass' and exited 1."
  - "VERIFIED: node:24-bookworm resolved to index digest sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0 on Docker Hub on 2026-10-18; Claude Code 2.1.289 was published to npm on 2026-10-03."
  - "VERIFIED: the first real run, required check job 117627456790 at 78c05d1, refused: inside the container lint, typecheck and npm test passed (883 of 883) and the SDK probe ran, but evals:test failed 10 tests because bookworm's Python 3.11.2 has no tarfile extraction filter; the launcher printed 'the guest check evals:test exited 1' and exited 1."
  - "VERIFIED: after moving the base to node:24-trixie (index digest sha256:ff054b356ab93ed540518ca23cfcd9840e5256dd04db5a8d8afc43f4ecc7c9f8), the required check job at 456f46d (https://github.com/Zimfra/software_testing/actions/runs/39111511810) printed: guest reports node v24.22.0, python Python 3.13.5, git git version 2.47.3, claude 2.1.289 (Claude Code), sdk 0.12.0; contained, image sha256:15476cca3d416c4e851cdaabb1fd87a15a261a8bc98fa804930d3c75507aeb1b, the planted fsmonitor fired only inside the guest, the host checkout is unchanged and the container had no mounts."
  - "VERIFIED: gh api repos/Zimfra/software_testing/rules/branches/main lists check and guards as required status checks, so the step that runs npm run sandbox:smoke is part of a required check (2026-10-18)."
  - "VERIFIED: an independent verifier (Claude Code subagent, Opus 5.5, separate context) rated 2a9b4f8 PASS with no CRITICAL or HIGH finding; it reproduced red-first, npm run check, the CI log quotes and the pins, and showed the guest test leaves a decoy repository and global config untouched under a simulated hook environment. Its three MEDIUMs: eleven refusals deletable with tests green; the probe log not pinned; launch and inspect options that weaken the boundary not refused. Its LOWs: the Dockerfile overstated reproducibility, the success line overstated what the host checks, a linked result file would be read, and a dirty checkout could build an image from other files than the copy."
  - "INFERRED: after the fixes, the launcher mutations the first verifier reported surviving, as reconstructed by this session, each fail a test, as do removing the link check, the dirty-checkout check and the SecurityOpt check; a second verifier at 1cfeb08 could not reproduce the first verifier's exact list and found five of its own reconstruction still surviving. The guest test reads the raw sentinel log and requires fsmonitor between closing and closed. Hard-coding the guest's duringClose is equivalent against SDK 0.12.0, whose real log holds exactly that entry. The two scripts' tests pass 40 of 40."
  - "VERIFIED: a second verifier (Claude Code subagent, Opus 5.5, separate context) rated 1cfeb08 PASS: CI run 39112791234 at that head printed contained under the stricter inspection (CapDrop ALL, SecurityOpt exactly no-new-privileges, CgroupnsMode private, no PortBindings); its MEDIUM was five refusals still deletable with tests green (inspect Devices, the container: namespace prefix, a missing probe, the launch Docker-socket rule, the launch gate) and that the line above overclaimed; its LOWs were daemon-wide defaults the inspection cannot see, launch options it missed (attached short values, --runtime, --gpus, --sysctl, --cgroup-parent, --link, PublishAllPorts, DeviceRequests, unmasked system paths), the untested 1 MiB limit and git status exit, the undocumented dirty-checkout refusal, and the reproducibility criterion."
  - "VERIFIED: after those fixes every named survivor fails a test except deleting the launch gate; the launch now also requires --cgroupns=private; the two scripts' tests passed 49 of 49."
  - "INFERRED: --cgroupns=private keeps a cgroup v1 runner from being refused for sharing the host cgroup namespace; no cgroup v1 runner was exercised."
  - "VERIFIED: a third verifier (Claude Code subagent, Opus 5.5, separate context) rated 84e0736 PASS; CI run 39114073048 at that head printed contained under the stricter inspection. Its MEDIUM was this ticket ticking the reproducibility criterion and marking done while the criterion awaits the owner, now blocked instead. Its LOWs: the launch gate is reachable through the markerRoot option, so it can be pinned; and the launch container: prefix, attached -e values and empty ReadonlyPaths had no test; combined short options such as -itv/srv:/srv passed the launch check."
  - "VERIFIED: after those fixes a test pins the launch gate (a markerRoot naming docker.sock is refused before docker create), and deleting the gate, the launch container: rule, the attached -e form or the ReadonlyPaths check each fails a test, as does accepting combined short options; the two scripts' tests pass 51 of 51."
  - "UNKNOWN: whether recording the image ID per run satisfies the acceptance line's \"reproducible\": the base image, Claude Code and the npm lockfile are pinned, but the Debian packages are not, so rebuilds give different image IDs. That is the owner's call; pinning them would mean a dated Debian snapshot archive."
  - "INFERRED: the apt packages (git, python3, gh) are not version-pinned, so a rebuild can produce a different image ID (two CI builds of the same Dockerfile gave sha256:15476cca... and sha256:0e81639d...); the base image digest, Claude Code and the npm lockfile are pinned."
  - "INFERRED: the container was launched with --security-opt=no-new-privileges, --cap-drop=ALL, --cgroupns=private, one CONTAINMENT_MARKERS variable and no mount, as createArgs builds them and the launcher's own inspection accepted; the runner's docker inspect output was not logged."
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

- [ ] Runtime/SDK/image identities and dependency installation are reproducible and recorded; Node matches the declared version. (Recorded per run and Node matches; whether unpinned Debian packages meet "reproducible" awaits the owner.)
- [x] The guest image can run the declared repository check toolchain, including Python's `evals:test`, on a disposable known-good checkout.
- [x] Real SDK create/cleanup executes inside the disposable boundary; planted hook/fsmonitor sentinels never execute on the host.
- [x] Host Git metadata, working checkout, home and runtime-control sockets are not exposed; configuration violating the boundary refuses.
- [x] The real smoke command is executed by required CI at the implementation SHA, without model credentials or paid calls.
- [x] Missing Docker is blocked proof, never a successful skip; unit tests alone are not presented as containment evidence.

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
