---
type: idea
title: A rerun does not check that a published pull request is still open
summary: Recovery treats a recorded delivered publication as final, so after someone closes that pull request a rerun reports the issue published and opens nothing.
tags: [area/agents, area/github]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide in S18 whether a rerun reads the recorded pull request's state, at the cost of one gh read per published issue.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "INFERRED: the S17 ticket's Discovered work on main (PR 59) records it."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/recovery.ts line 109 returns the recorded URL when publication status is delivered, without a gh call (checked by Claude Code, Opus 5.5)."
---

## Problem

A closed pull request leaves the issue with no open review, but the run result says published.

## Desired outcome

A rerun either reopens or replaces a closed pull request, or reports it, instead of reporting published.

## Next step

Raise it when S18 wires recovery into the public commands.
