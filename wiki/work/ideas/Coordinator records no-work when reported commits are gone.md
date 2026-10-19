---
type: idea
title: Coordinator records no-work when reported commits are gone
summary: When the implementer reports commits but its branch is missing or already in HEAD, the coordinator records the settled no-work outcome, so lost work is not reported as lost.
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan a test-first outcome for reported-but-missing commits in scripts/sandcastle/coordinator.ts, distinct from no-work.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S09 Explicit phase outcomes and review eligibility]]"]
evidence:
  - "INFERRED: the independent verifier of PR 45 at 7c90c93 reported (LOW) that coordinator.ts gives no-work when the branch is gone or reset into HEAD after commits were reported, and that the run still ends incomplete only because the planner plans the issue again; its review at f19d838 left it open as recorded in the S09 Discovered work (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/sandcastle/coordinator.ts line 105 returns kind no-work when the candidate is undefined or an ancestor of HEAD, without reading the commit count the implementer reported."
---

## Problem

`no-work` is a settled outcome: it says the implementer had nothing to do. The same outcome is recorded when the implementer reported commits but its branch has vanished or was reset into HEAD. The run summary then hides that work was lost.

## Desired outcome

Reported commits that cannot be found give an outcome that names the loss and keeps the run incomplete, independent of whether the planner plans the issue again.

## Next step

Write a failing coordinator test with an implementer that reports commits and a deleted branch, then add the outcome.
