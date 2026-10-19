---
type: idea
title: Review verdicts assume 40-character commit IDs
summary: The verdict parser accepts only 40-hex SHA-1 commit IDs, so in a repository using SHA-256 object IDs every review would be held; the path fails closed but is untested.
tags: [area/agents, area/git]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Add a test that pins the held outcome for a 64-hex SHA, or widen FULL_SHA with a test, in scripts/sandcastle/run-result.ts.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S09 Explicit phase outcomes and review eligibility]]"]
evidence:
  - "INFERRED: the independent verifier of PR 45 listed under remaining limits at 7c90c93 and f19d838 that a SHA-256 repository would have every verdict held, untested (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/sandcastle/run-result.ts line 25 defines FULL_SHA as /^[0-9a-f]{40}$/."
---

## Problem

Git can create repositories with SHA-256 object IDs, whose commit IDs are 64 hex characters. The verdict parser requires exactly 40, so every review there is held. That fails closed, but no test states it, so a later change could make it fail open.

## Desired outcome

A test pins the behaviour for 64-character IDs, whichever behaviour the owner chooses.

## Next step

Write the test against `judgeReview` first; decide whether to support SHA-256 or keep holding.
