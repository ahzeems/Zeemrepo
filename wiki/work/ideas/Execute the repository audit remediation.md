---
type: idea
title: Execute the repository audit remediation
summary: Turn the repository audit into a reviewed plan and dependency-linked job specs that another LLM can execute from a fresh terminal session.
tags: [area/planning, area/agents, area/compliance]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: in-progress
owner: human
priority: P1
next_action: Obtain owner merge approval of the proposed job specs; the next LLM then verifies approval and starts S01 Fixture Git containment.
project: "[[Repository audit remediation]]"
evidence:
  - "OWNER DECISION: on 2026-10-16 the owner said: yes the goal is to take this planning, commit into the repo with a pull request, and for the planning to be executred by another llm in a different terminal session maybe claude for example"
  - "VERIFIED: the audit inspected 616a4ea59f84885cae294f0aa5f31dd9dffac129; the provider-neutral authoring prerequisite is implemented locally at 7fd3faa86650ce6e2c4c7874e5204ab87c0b611a, with independent review and a passing full check recorded in the preceding work."
  - "VERIFIED: after adding the map, tickets, inventory and fresh-session runbook, npm run check exited 0 on Node 24.22.0 with 762 Node tests and 56 Python tests passing; wiki-lint validated 65 notes and every repository guard passed."
  - "VERIFIED: independent review of 7c2b7c6bc0da50eb954a4ce2b3d63e895db7ae35 found two handoff ambiguities. The follow-up explicitly preserves the existing documentation-only landing default for the host-hardening option and makes job-spec approval conditional on the plan requiring job specs."
  - "OWNER DECISION: on 2026-10-16 the owner selected full-workflow isolation with a controlled host import; Choose the Sandcastle execution boundary records the verbatim answer."
  - "VERIFIED: after recording the isolation decision and its research follow-up, npm run check exited 0 on Node 24.22.0 with 762 Node tests and 56 Python tests passing; wiki-lint validated 66 notes and all repository guards passed."
  - "OWNER DECISION: on 2026-10-16 the owner replied 'approved' to the partial-failure policy recorded in Define Sandcastle partial-failure outcomes."
  - "VERIFIED: after recording the partial-failure approval and updating the handoff, npm run check exited 0 on Node 24.22.0 with 762 Node tests, 56 Python tests and all repository guards passing."
  - "OWNER DECISION: on 2026-10-16 the owner chose 'audit only the fork' and then asked 'and let me know in some detail whats being worked on and why'."
  - "VERIFIED: the SDK's pinned no-sandbox API supports the proposed outer-container execution design, and a temporary-repository experiment preserved commit identity while excluding source Git configuration, hooks and untracked work from a bundle import."
  - "VERIFIED: after recording fork scope, research results and the proposed verification approach, npm run check exited 0 on Node 24.22.0 with 762 Node tests and 56 Python tests passing; wiki-lint validated 68 notes and all repository guards passed."
  - "OWNER DECISION: on 2026-10-16, after the verification approach was presented, the owner said: do what it takes to get the PR completed so we can merge, - proceed as required"
  - "VERIFIED: the proposed plan exposed a blocking validator defect: a completed map counted its downstream plan as an unfinished ticket. Before the fix, work-tracking.test.ts reported 40 tests with 36 passing and 4 failing entries, covering proposed, approved and executing plans plus their parent test."
  - "VERIFIED: after the narrow validator fix, all 40 work-tracking tests passed. The full check passed 766 Node tests, 56 Python tests and all guards; wiki-lint validated 69 notes. All seven trusted guard CLIs from main at 616a4ea also passed against the proposed-plan tree."
  - "VERIFIED: a structural inspection of the proposed plan found 26 unique slices, an acyclic parent graph, coverage of all A01-A22 findings and Fixture Git containment as the first eligible slice."
  - "VERIFIED: independent standards and spec reviews at 18e32772ddc74e9debffad66e708b4623e728cf6 reported no findings. The independent verifier passed the full check and replayed the map/plan regression controls against base and head."
  - "VERIFIED: the machine account published PR 15 at https://github.com/Zimfra/software_testing/pull/15. GitHub reported author zimmybot, base main, head 18e32772ddc74e9debffad66e708b4623e728cf6 and an outstanding code-owner review request."
  - "VERIFIED: GitHub subsequently reported PR 15 merged by code owner ahzeems at 2026-10-16 16:08:27 UTC as edb9e35da1284e7593bd62f6408cc719771d9b7d. The plan's approval is recorded; the follow-up handoff changes are in PR 16."
  - "VERIFIED: all 26 slice titles, dependencies, deliverables, acceptance criteria and affected surfaces match the plan at approved head 18e32772ddc74e9debffad66e708b4623e728cf6. The follow-up changes approval and handoff state, not the approved implementation scope."
  - "VERIFIED: after merging current main and recording approval, npm run check exited 0 on Node 24.22.0 with 766 Node tests, 56 Python tests and all guards passing. The follow-up has its own changelog entry relative to the newly merged main."
  - "OWNER DECISION: on 2026-10-16 the owner said: create the job spec and the tickets and or issues required for the next LLM to talk the build"
  - "VERIFIED: PRs 15 and 16 were rechecked as owner-merged before creating the 26 proposed job specs from the approved breakdown."
  - "VERIFIED: structural inspection found 26 proposed build tickets with all 13 visible required sections, exact approved parent lists, an acyclic graph covering A01-A22 and S01 as the sole initial root. The approved slice contracts are unchanged apart from links to their job specs."
  - "VERIFIED: npm run check passed with Node 24.22.0, 766 Node tests, 56 Python tests and all repository guards after job-spec creation; wiki-lint validated 97 notes."
  - "UNKNOWN: job-spec merge approval and implementation evidence remain pending. Docker is unavailable locally, and the unscoped CLI still reports an invalid inactive GitHub profile."
---

## Problem

The audit found execution-boundary, Git-state, orchestration, privacy and evaluation gaps. Its
findings were in a conversation, so a different terminal session could not reliably recover the
evidence, distinguish recommendations from decisions, or know which work was ready to start.

## Desired outcome

Commit the planning records and submit them in a pull request. The owner approves the resulting
plan through the repository workflow. A fresh LLM session can then find the approved plan, create
the agreed session-sized job specs, and work one unblocked ticket at a time with independent
verification and a recoverable handoff.

## Next step

The next LLM verifies approval of the plan and the current job-spec revision, then follows
[[Resume repository audit remediation]] to execute [[S01 Fixture Git containment]] before its
dependants. The handoff stands alone without this conversation.
