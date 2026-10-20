---
type: idea
title: A failed run-state write leaves the run result naming nothing
summary: When saving durable state fails, the whole run stops, later issues are not attempted and the run result names no failed issue.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: S18 reports a state-write failure as failed for the issue being saved, and decides whether later issues still run.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "INFERRED: the S17 ticket's Discovered work on main (PR 59) records it and says S18 should report it as failed."
---

## Problem

A host failure to save state is real, but an operator reading the run result cannot tell which issue it hit or that later issues never ran.

## Desired outcome

The run result names the issue whose state could not be saved and the issues not attempted.

## Next step

Take it into S18.
