---
type: idea
title: afk refusing a deleted branch whose old tip is in HEAD awaits an owner decision
summary: Whether afk should refuse when an issue branch deleted during the loop had a pre-loop tip now in HEAD is an owner decision.
tags: [area/agents, area/git]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether afk adds the narrow P1 refusal before S18; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]", "[[S18 Public-command cutover and end-to-end isolation proof]]", "[[A deleted issue branch escapes afk's handed guard]]"]
evidence:
  - "INFERRED: the S27 ticket's Discovered work on main (PR 57) proposes the narrow refusal for probe P1 (refuse when a deleted issue branch's pre-loop tip is now in HEAD), says it is not built and needs the owner."
---

## Problem

Today afk only warns that the branch was deleted and still lands the other issues. The refusal would stop landing in that case, which changes what afk lands, so S27 asked the owner before building it. It does not cover P2 (a branch created and deleted inside the loop).

## Desired outcome

The owner's answer is recorded. If refusal is chosen, a build ticket adds it to afk with a failing test first.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
