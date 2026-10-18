---
type: issue
title: Docker-capable containment proof is unavailable locally
summary: This checkout has no Docker executable, so containment evidence must come from a Docker-capable runner or an owner-authorized local setup.
tags: [area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: human
priority: P1
issue_kind: environment
next_action: None. The proof comes from the required CI check; this machine still has no Docker, and npm run sandbox:smoke reports that as blocked.
root_cause: No Docker executable is installed on the authoring machine, and nothing ran the containment control where Docker is available.
fix_ref: https://github.com/Zimfra/software_testing/pull/34
regression_evidence: Before S12 no command exercised the boundary; at 456f46d the required check job ran npm run sandbox:smoke on ubuntu-latest and it printed contained, while the same command on this machine exits 1 as blocked.
prevention: The required CI check job runs npm run sandbox:smoke on every pull request and push to main, and the command exits 1 when Docker is missing, so a missing runtime is never a pass.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
related: ["[[S12 Reproducible runtime and real containment control]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "VERIFIED: command -v docker returned exit 1 on 2026-10-16 while creating the job specs."
  - "UNKNOWN: real containment has not been demonstrated locally; S12 must create and run the required non-model container control."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"CI runners only (Recommended)\": the containment proof for S12, S14, S15 and S18 comes from CI, and nothing is installed locally."
  - "VERIFIED: on 2026-10-17 the required check and guards workflows run on ubuntu-latest; command -v docker and command -v podman found nothing on the machine now used."
  - "VERIFIED: the required check job at 456f46d (https://github.com/Zimfra/software_testing/actions/runs/39111511810) ran npm run sandbox:smoke and printed: guest reports node v24.22.0, python Python 3.13.5, git git version 2.47.3, claude 2.1.289 (Claude Code), sdk 0.12.0; contained, image sha256:15476cca3d416c4e851cdaabb1fd87a15a261a8bc98fa804930d3c75507aeb1b. The proof came from CI; the local machine was not changed."
---

## Reproduction

Run `command -v docker` in the selected environment. The job-spec authoring session received
exit 1. No Docker daemon, image or model-backed run was started.

## Expected and actual

The isolation acceptance requires a real Docker-capable boundary control. This machine cannot
currently supply it. Unit tests and source inspection are useful but do not satisfy that proof.

## Root cause

No Docker executable is available on the current PATH. Whether another host or the intended
CI image provides the complete runtime must be checked where the control will actually run.

## Fix

S12 wires the real control into an existing required CI check on a Docker-capable runner. A
matching-head passing CI result can resolve the proof prerequisite without installing Docker
on every authoring machine. Local installation or additional infrastructure needs owner authorization.

## Verification

Record the runtime/image identities, actual smoke command, head SHA, host/guest sentinel results
and CI URL. Close this issue only when a verified execution environment supplies the required proof;
do not claim that the local machine was repaired if the proof came from CI.

## Prevention

The required CI `check` job runs `npm run sandbox:smoke` on every pull request and on pushes to
`main`. Without Docker the command exits 1 as blocked, so a missing runtime never reads as a pass.
