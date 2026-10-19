---
type: idea
title: A deleted issue branch escapes afk's handed guard
summary: afk's handed-issue guard reads branch names after the loop, so an unhanded branch merged and then deleted during the loop still lands.
tags: [area/agents, area/git]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: S18's check of merged commits should cover both probes; the narrow refusal for the first is a pending owner decision in its own note.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]", "[[S18 Public-command cutover and end-to-end isolation proof]]", "[[afk refusing a deleted branch whose old tip is in HEAD awaits an owner decision]]"]
evidence:
  - "INFERRED: the S27 ticket's Discovered work on main (PR 57) records the independent verifier's two probes at df81f41: P1, an unhanded branch that existed before the loop, merged and then deleted, is only warned about and issue 4 still landed with exit 2; P2, a branch created, merged and deleted during the loop is not seen and issue 4 landed with exit 0. It assigns the class to S18."
---

## Problem

The guard compares the handed record with the issue branches present after the loop. A merger that deletes a branch after merging it removes the evidence the guard reads.

## Desired outcome

No issue lands unless its merged work was handed and reviewed, whatever branches exist after the loop.

## Next step

Covered by S18's merged-commit checks; record there whether P1 and P2 are refused.
