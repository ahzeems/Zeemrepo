---
type: project
title: Repository audit remediation
summary: Deliver an owner-reviewed remediation plan and independently verifiable work from the repository audit, executable across fresh LLM sessions.
tags: [area/planning, area/agents, area/compliance]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: in-progress
owner: human
priority: P1
next_action: S11, S16 and S24 are in progress on their own branches; start S10 (parent S09, now landed) when a heavy-job slot is free, at most two heavy jobs at a time. S21 waits for the owner's approval of its baseline; S14, S17 and S18 wait for their parents.
idea: "[[Execute the repository audit remediation]]"
evidence:
  - "OWNER DECISION: on 2026-10-16 the owner requested committed planning, a pull request and execution by another LLM in a separate terminal session."
  - "VERIFIED: GitHub reports planning PR 15 merged by code owner ahzeems on 2026-10-16 as edb9e35da1284e7593bd62f6408cc719771d9b7d; the plan's approval metadata is now recorded."
  - "OWNER DECISION: on 2026-10-16 the owner requested the job specs, tickets and issues needed for the next LLM to take the build."
  - "OWNER DECISION: on 2026-10-17 the owner confirmed \"ive merged it\" for job-spec PR 17; GitHub reported it merged after an APPROVED code-owner review."
  - "OWNER DECISION: on 2026-10-17 the owner set the execution defaults: containment proof from CI runners only (\"CI runners only (Recommended)\"), offline controls only with any live or paid trial reported UNKNOWN (\"Offline only (Recommended)\"), and one ticket branch and PR at a time in plan order (\"One at a time (Recommended)\")."
  - "OWNER DECISION: on 2026-10-17 the owner chose the machine account as the local commit author (\"zimmybot (Recommended)\")."
  - "VERIFIED: S01 landed as PR 18, merged as 875a2e8 by the code owner after an APPROVED review."
  - "VERIFIED: S02 landed as PR 21, merged as 5d56a42 by the code owner after an APPROVED review."
  - "VERIFIED: on 2026-10-18 gh pr list --state merged showed twelve of 26 slices landed: S01 (PR 18), S02 (PR 21), S03 (PR 25), S04 (PR 23), S05 (PR 32), S06 (PR 38, follow-up PR 42), S07 (PR 26), S08 (PR 39), S12 (PR 34, follow-up PR 40), S13 (PR 37), S19 (PR 35) and S25 (PR 36)."
  - "VERIFIED: on 2026-10-18 gh pr view showed PRs 44 to 49 merged by the code owner's account, each squash merge carrying exactly its last reviewed head, so eighteen of 26 slices have landed: the twelve above plus S20 (PR 44, 1790817), S09 (PR 45, 13c3b11), S26 (PR 46, f949e56), S23 (PR 47, 024d415), S22 (PR 48, 3905db2) and S15 (PR 49, caa99e3). When checked on 2026-10-18 after PR 49 merged, S11 was open as PR 50 (head 95d8717) and feat/s16-trusted-publication and fix/s24-compliance-outcomes had no PR yet; S10 depends only on S09 and is the one eligible ticket not started (checked by Claude Code, Opus 5.5)."
---

## Outcome

A reviewed plan and job specs that preserve the audit's evidence, define the expected behavior,
and let a fresh LLM implement a bounded slice without inventing decisions or relying on chat history.

## Scope

- Give every finding in the audit inventory an explicit disposition and evidence requirement.
- Use the selected full-workflow isolation target in [[Choose the Sandcastle execution boundary]];
  establish its feasible implementation through the linked research ticket.
- Apply the approved behavior in [[Define Sandcastle partial-failure outcomes]] to run outcomes,
  per-issue integration and recovery.
- Limit landing assurance to the fork and verified boundary recorded in
  [[Choose the landing audit history scope]].
- Resolve the choices that change implementation, then write the proposed plan with test seams
  and dependency-linked implementation slices.
- The approved plan sets `job_specs: required` so build tickets carry inputs, file boundaries,
  tests, recovery, evidence and human checkpoints. Confirm or reuse the approved breakdown before
  creating them, and obtain owner approval of the job specs before implementation.
- Keep the existing branch, test-first, independent-review and owner-merge workflow.
- Give meaningful progress updates explaining the current task, why it matters, the evidence
  found, any concrete blocker and the next action, following the fresh-session runbook.

## Acceptance criteria

- [x] Every inventory finding is linked to a proposed slice or an explicit, reasoned deferral.
- [x] Every decision needed by the plan is resolved with owner evidence or reproducible research.
- [x] The plan is proposed in a pull request and identifies its intended base, test seams and limits.
- [x] After owner merge, approval is verified on GitHub and recorded before build-ticket creation.
- [x] Each build ticket has one deliverable, checkable acceptance, explicit dependencies and a
  valid and broken control for the behavior it changes.
- [ ] The handoff routes a fresh session by actual work status and explains where to stop for
  owner decisions, verification failures, missing capabilities or approval.
- [ ] Each implemented slice has an independent criterion-by-criterion verdict at a pinned SHA.

## Work links

- [[Repository audit remediation map]]: decisions and the next planning action.
- [[Repository audit findings 2026-10-16]]: baseline findings and evidence limits.
- [[Resume repository audit remediation]]: entry point for a different LLM session.
- [[Planning pull request publication is blocked]]: resolved publication record for [PR 15](https://github.com/Zimfra/software_testing/pull/15), including the local authentication limits.
- [[Audit remediation verification approach]]: test seams included in the approved plan.
- [[Repository audit remediation implementation plan]]: approved contract and index of the 26 proposed job specs.
- [[S01 Fixture Git containment]]: first ticket after job-spec approval; it protects later hook-run regression work.
- [[Docker-capable containment proof is unavailable locally]]: runtime-proof environment issue for S12 and its consumers.
- [[Inactive GitHub profile blocks unscoped PR preflight]]: remaining local publication-context issue.
