---
type: idea
title: afk's issue comments carry no notification marker
summary: npm run sandcastle:afk posts issue comments without the hidden marker notifications.ts uses, so its quiet rerun cannot tell whether a lost comment was posted.
tags: [area/agents, area/github]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Move afk's comment onto deliverNotice in notifications.ts as part of S18's cutover.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]", "[[S27 Afk lands only issues handed to the merger]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "INFERRED: the S17 ticket's Discovered work on main (PR 59) records it and assigns it to S18's cutover or S27."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/afk.ts line 171 builds the comment body without noticeMarker, and afk.ts does not import notifications.ts (checked by Claude Code, Opus 5.5)."
---

## Problem

A comment whose acknowledgement was lost is either posted twice or reported as failed on the next run, because afk cannot find it by marker.

## Desired outcome

afk's comments reconcile the same way recovery's do.

## Next step

S27 has landed, so this belongs to S18's cutover.
