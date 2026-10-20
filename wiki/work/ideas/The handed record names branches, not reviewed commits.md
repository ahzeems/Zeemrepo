---
type: idea
title: The handed record names branches, not reviewed commits
summary: afk lands a handed issue whose branch moved after its review if the merger merged it anyway, because the coordinator's record holds branch names only.
tags: [area/agents, area/git]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: S18 decides whether its check of merged commits against reviewed SHAs covers this; if not, plan recording the reviewed SHA in the handed record.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "INFERRED: the S27 ticket's Discovered work on main (PR 57) records it and says verifying merged commits against the reviewed SHA probably belongs to S18."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/coordinator.ts line 47 writes the record as JSON {handed: branches}, a list of branch names with no commit (checked by Claude Code, Opus 5.5)."
---

## Problem

The coordinator reports an issue whose branch moved after review as not integrated, but afk still lands it when the merger merged it, because afk only checks that the branch name was handed.

## Desired outcome

afk lands an issue only when the merged commit is the one that was reviewed.

## Next step

Check S18's merged-commit verification when it is planned in detail.
