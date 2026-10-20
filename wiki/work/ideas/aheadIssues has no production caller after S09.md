---
type: idea
title: aheadIssues has no production caller after S09
summary: After S09 nothing outside tests calls aheadIssues in already-done.ts, and a comment there still names it as the consumer that must not lose work.
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Check every caller of aheadIssues, then retire it and its comment in a small refactor branch, or record why it stays.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S09 Explicit phase outcomes and review eligibility]]"]
evidence:
  - "INFERRED: the independent verifier of PR 45 at 7c90c93 reported (LOW) that aheadIssues has no production caller and the comment at already-done.ts line 53 is stale; its review at f19d838 left it open as recorded in the S09 Discovered work (2026-10-18)."
  - "VERIFIED: on main at caa99e3, grep over scripts and .sandcastle finds aheadIssues only in scripts/sandcastle/already-done.ts (its definition at line 92 and the comment at line 53) and in test files."
---

## Problem

S09 stopped the merger from consuming `aheadIssues`, but the function and its tests stayed, and the comment above `alreadyDone` still says a merger depends on it. A reader following the comment looks for a caller that no longer exists.

## Desired outcome

Dead code is removed with its tests, or the comment names the real reason it is kept.

## Next step

A refactor branch with no behaviour change: confirm no caller, delete the function and its tests, fix the comment.
