---
type: project
title: Repository audit remediation
summary: Deliver an owner-reviewed remediation plan and independently verifiable work from the repository audit, executable across fresh LLM sessions.
tags: [area/planning, area/agents, area/compliance]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: in-progress
owner: human
priority: P1
next_action: S18, the last slice, has every dependency landed and waits on the owner's decision on how a scoped model credential reaches the isolated guest. S14's review follow-ups are in review on fix/s14-guard-followups; run at most two heavy jobs at a time.
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
  - "VERIFIED: on 2026-10-19 gh pr view showed PRs 50, 52, 53 and 54 merged by the code owner's account, and for each git merge-tree --write-tree <merge>^ <head> gave the merge commit's own tree, so main received exactly the reviewed head: S11 (PR 50, 6facf2a, head aff82d8), S24 (PR 52, 4a446b6, head 1c6ab76), S16 (PR 53, 2a4bf7a, head 1ddde59) and S10 (PR 54, 40aba24, head 2201b85). Twenty-two of the plan's 26 slices have landed; S14, S17, S18 and S21 remain (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on 2026-10-19 the same check passed for the records PRs 51 (35ba4ea, head 6e0e607) and 55 (4c56101, head f346949), both merged by the code owner's account; PR 55 added S27 as a follow-up slice to S09 and S16, outside the plan's 26 (checked by Claude Code, Opus 5.5)."
  - "OWNER DECISION: on 2026-10-19 the owner wrote \"S21 baseline approved, go ahead\" (relayed by the coordinator)."
  - "INFERRED: the S21 PR will list the concrete inventory for the owner to review before merging, per S21's acceptance criterion \"The owner reviews the baseline inventory and the required actual approval evidence is recorded before landing it\" and the coordinator's brief of 2026-10-19."
  - "VERIFIED: at about 10:22 UTC on 2026-10-19 local branches feat/s14-isolated-coordinator, feat/s17-durable-recovery, fix/s21-skill-provenance and fix/s27-afk-handed-issues existed in their own worktrees, with no remote branch and no open PR for any of them; S18 depends on S14 and S17 (and the landed S15 and S16) (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on 2026-10-19 gh pr view showed PRs 57, 58 and 59 merged by the code owner's account, and for each git merge-tree --write-tree <merge>^ <head> gave the merge commit's own tree, so main received exactly the reviewed head: S27 (PR 57, d7890ee, head 48b9490), S21 (PR 58, 0358628, head 412a60e) and S17 (PR 59, 8a00e16, head f55d95e). Twenty-four of the plan's 26 slices have landed, plus the follow-up S27; S14 and S18 remain (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on 2026-10-19 the records PR 56 showed MERGED by the code owner's account as 8622967 (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: at about 12:45 UTC on 2026-10-19 PR 60 (feat/s14-isolated-coordinator, head 7b0df89) was open, so S14 is in review; S18 depends on S14, S15, S16 and S17, of which only S14 has not landed. This supersedes the 10:22 UTC in-progress line above for S17, S21 and S27 (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on 2026-10-19 gh pr view 60 reported MERGED by the code owner's account at 12:55:07 UTC as 2a69b17, and git merge-tree --write-tree 2a69b17^ 7b0df89 gave 2a69b17's own tree, so main received exactly the reviewed head 7b0df89. Twenty-five of the plan's 26 slices have landed, plus the follow-up S27; S18 remains, and all its dependencies (S14, S15, S16, S17) have landed. This supersedes the 12:45 UTC line above for S14 (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (a Claude Code verifier subagent on Opus 5.5, claude-opus-5-5, in a separate context), relayed by the coordinator on 2026-10-19 and not reproduced here, 7b0df89 (S14, PR 60) rated PASS with three LOWs, N1 to N3; the S14 builder's follow-ups are on branch fix/s14-guard-followups."
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
- S10, S11, S16 and S24 (PRs 54, 50, 53 and 52) record their merges and final reviews, the project record lists 22 landed slices with S14, S17, S21 and S27 in progress, S09's and S16's afk item points at [[S27 Afk lands only issues handed to the merger]], and five new idea notes carry the gaps the S10 and S16 tickets left open.
