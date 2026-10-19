---
type: idea
title: The planner cannot flag an ambiguous dependency for the owner
summary: The S10 plan can only list an issue whose dependency is unclear as blocked; nothing tells the owner the dependency needs a decision, as the ticket's human checkpoint asks.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide how an ambiguous dependency reaches the owner (an issue comment, a label or a run-report line), then plan it test first.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S10 Blocked-queue planning contract]]"]
evidence:
  - "INFERRED: the S10 ticket's Discovered work (PR 54) records that the plan cannot say a dependency is ambiguous beyond listing the issue as blocked, while its human checkpoint asks for ambiguous semantics to go to the owner (2026-10-19)."
  - "VERIFIED: on main at 4c56101, .sandcastle/plan-prompt.md lines 24 to 26 tell the planner to treat an unclear dependency as blocked, and scripts/sandcastle/plan-schema.ts gives a blocked entry only id, title and blockedBy (checked by Claude Code, Opus 5.5)."
---

## Problem

When the planner cannot tell whether one issue depends on another, it lists the issue as blocked.
The run report then shows an ordinary blocked issue. The owner has no signal that the blocker is a
guess, so the issue can wait on a dependency that does not exist until someone rereads it.

## Desired outcome

An ambiguous dependency is visible to the owner as a question, separate from a dependency the
planner is sure of.

## Next step

Choose the channel. An issue comment or label needs a planner or coordinator that can write to
GitHub, which it cannot today.
