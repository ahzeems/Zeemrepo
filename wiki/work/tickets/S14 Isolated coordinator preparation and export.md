---
type: ticket
title: S14 Isolated coordinator preparation and export
summary: Run the coordinator and workers inside the proven disposable boundary and return untrusted candidate and recovery artifacts through the defined contract.
tags: [area/agents, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges PR 60. S18 wires the stage into the public commands and needs an owner decision on model credentials in the guest.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]", "[[S09 Explicit phase outcomes and review eligibility]]", "[[S10 Blocked-queue planning contract]]", "[[S11 Non-executable branch inputs]]", "[[S12 Reproducible runtime and real containment control]]", "[[S13 Candidate artifact contract and quarantine]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S14, finding A01 and its six named prerequisites."
  - "VERIFIED: job-spec approval is PR 17 (89f841f) and every parent is merged: S08 PR 39 (85a8a32), S09 PR 45 (13c3b11), S10 PR 54 (40aba24), S11 PR 50 (6facf2a), S12 PRs 34 (c0f2e48) and 40 (c11dfa7), S13 PR 37 (fdd46ff); gh pr view on 2026-10-19 reported all MERGED. The branch starts from origin/main 4c56101. Implemented by Claude Code (claude-opus-5-5)."
  - "VERIFIED: red at 29327d7 (tests plus typed stubs, because the pre-commit hook runs lint and typecheck): guest-runner.test.ts and isolated-run.test.ts failed 20 of 20. Green at 84656aa: 7 of 7 and 13 of 13; that commit also changed one red assertion (isolated-run.test.ts, candidate.ref compared with the run branch ref became a candidate SHA comparison) because quarantine renames the imported ref to refs/quarantine/candidate. Red at c5aca85 for the control: isolated-run-smoke.test.ts and containment-smoke.test.ts failed 5 of 57; green at 4378beb, 57 of 57."
  - "VERIFIED: npm test at 4378beb passed 1333 of 1333 with coverage over the thresholds (all files 98.76 lines, 91.13 branches, 95.51 functions)."
  - "VERIFIED: a mutation run on the working tree after 4378beb planted 19 mutants, each restored, and all 19 failed a test: export Git not hardened, a provider other than noSandbox, init without the base check, no recovery truncation, claims always succeeded, no resource-limit check, inspect refusals ignored, no kill after timeout, no export after a failed run, collection error ignored, dirty tooling accepted, exec timeout reported as exit, container not removed, launch without limits, quarantine refusal accepted, abort ignored, host marker ignored, hang recovery unchecked, fsmonitor not required. The collection-error mutant first survived (quarantine still refused the missing bundle), so a140cf2 made the test require the launcher's own refusal."
  - "VERIFIED: the guest tests run the actual runSandcastle with the real SDK 0.12.0 noSandbox provider and scripted agents in child processes on disposable repositories: the exported artifact passes S13 checkArtifacts on the pinned base, fired.txt in the candidate shows the implementer's planted fsmonitor ran where the coordinator ran, and a hung run killed by process group leaves only recovery.data keeping sandcastle/issue-1 as a patch."
  - "VERIFIED: Docker is not installed on this machine; the real-container path ran only in CI. At ae26d69 the check job (run 39241305832) failed in Prove the sandbox boundary with 'the guest check test exited 1': the launcher test's host-home check assumed HOME is not a prefix of the guest paths, but inside the S12 guest HOME is the agent user's home, which contains every guest path. b2ffa20 fixed the test. The smoke exited 1 because the guest's npm test failed, not because of a boundary violation."
  - "VERIFIED: at b2ffa20 the check job (run 39246025673, tested as merge commit c867dc1) passed; Prove the sandbox boundary printed 'verifier-control: the driver issued a receipt ...', 'isolated-run-control: the coordinator ran in a bounded container and returned an unverified candidate on the pinned base; its planted fsmonitor fired only in the guest; a hung run timed out with its committed work kept as recovery data.' and 'containment-smoke: contained. Image sha256:54b04ced89f37252c08fff264a2c6bf9304f2e58634b172b22af43cf00e5632a, SDK 0.12.0 ...'. Read with gh run view on 2026-10-19."
  - "INFERRED: the kill inside the container (kill -KILL -1 as the guest user) and the SDK's close() cleanup ran in the guest, from the hung case timing out with its work kept and the planted fsmonitor firing only there; neither was observed directly."
  - "VERIFIED: npm run pr refused four times with 'refs changed' while other agents shared .git: once at ae26d69 (the rerun pushed it and opened PR 60) and three times at b2ffa20; the coordinator's own retry then pushed b2ffa20."
  - "VERIFIED: a fifth npm run pr refusal came at f413303: it pushed the commit, then refused because GitHub still reported head b2ffa20; the rerun reported PR 60 open at f413303. CI at f413303 (run 39250830361) passed and printed isolated-run-control and 'containment-smoke: contained.' (image sha256:85cac8f0...)."
  - "VERIFIED: the re-review findings on f413303 were fixed: red at 61e0dbc (2 of 22 failed: the fail-closed guard and the guard wiring), green at d618776 (26 of 26 across guest-runner, isolated-run and isolated-run-smoke tests). The Docker call guard is now an allowlist of the launcher's own subcommands and options. A third mutation run planted 6 mutants, all killed: -ie GH_TOKEN added to exec() (with and without the guard wiring), the guard wiring removed, unknown options allowed, any subcommand allowed, --no-textconv removed from the export's diff."
  - "VERIFIED: the independent verifier's findings on b2ffa20 were fixed after merging origin/main (08ad472): red at a03fb45 (2 of 21 failed on typed stubs), green at 40e5002 (21 of 21). A second mutation run planted 7 mutants, all killed: --env GH_TOKEN added to exec() (with and without the guard), PidsLimit or NanoCpus unchecked, export hooks not disabled, export external diff allowed, env guard returning nothing."
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

- [x] The actual coordinator and SDK Git cleanup run inside the proven boundary, not on the host.
- [x] No host Git directory, working checkout, home or runtime-control socket is exposed; unsafe or missing runtime configuration refuses.
- [x] Candidate exports satisfy S13 and preserve pinned identities; guest phase labels cannot authorize verification or publication.
- [x] Failure, timeout, signal and interrupted collection preserve recoverable work and cannot claim completed publication.
- [x] Real-container fake-agent controls exercise preparation/export; no live model or GitHub write credential is needed for tests.

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

## Result

- `scripts/sandcastle/isolated-run.ts` is the preparation boundary (`prepareRun`), with no npm
  script; `scripts/sandcastle/guest-runner.ts` runs inside the container; `isolated-run-smoke.ts`
  is the real-container control that `npm run sandbox:smoke` runs after the verifier control.
- The guest passes the SDK's `noSandbox()` provider to `runSandcastle` under the coordinator's
  `docker` key, so `coordinator.ts` is unchanged.
- The run branch is `sandcastle/run-<task>`; the base crosses as a Git bundle, so the pinned base
  SHA is preserved (a tar copy would rewrite it).
- "Signal" is the caller's `AbortSignal`; no command wires process signals to it until S18.

## Discovered work

- Model credentials: the launcher passes no environment, and S12's launch check refuses any
  credential variable, so a real-model run fails at its first agent. How a scoped credential
  enters the boundary is an owner decision for S18.
- The guest runs `npm ci` for the tooling and the coordinator's `npm install` hook with network
  access; the container has the default bridge network. Whether a run should have a narrower
  network policy is open.
- The guest's tooling directory is writable by the agents, so the export step is guest-controlled
  code. The host trusts none of its output, but S15/S17 should not assume the export is honest.
- The export's `git status` and `git diff` still run a clean filter the agents configure (inside
  the guest). Disarming filters generically would need the configured driver names; it is recorded
  as a limit in the runbook.
