---
type: idea
title: One container runs all of a candidate's checks
summary: The verifier runs every check of a candidate in one container, so code a candidate runs during npm ci or an early check could affect a later check.
tags: [area/agents]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a measurement of a container per check, with its cost, before deciding to change the driver.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the S15 builder recorded in the ticket's Discovered work that checks share one container and that a container per check would remove the question (2026-10-18)."
---

## Problem

Install scripts and early checks execute candidate code. S15 flags the files such code lives in for this repository, but the container state they leave behind is shared with later checks.

## Desired outcome

Either each check starts from a clean container, or the receipt contract states the shared-state limit.

## Next step

Time the extra container starts on CI to decide.
