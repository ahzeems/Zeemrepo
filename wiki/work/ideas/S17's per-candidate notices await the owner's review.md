---
type: idea
title: S17's per-candidate notices await the owner's review
summary: S17 keys each issue notice on the repository, task and candidate, and posts new comment wording; the owner has not reviewed either choice.
tags: [area/agents, area/github]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Owner reviews whether one notice per candidate (a new candidate posts a new comment) and the S17 comment wording are acceptable; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "INFERRED: the S17 ticket's evidence on main (PR 59) records that the hidden marker on the issue-comment channel was treated as reconciliation, not a new channel or policy, so no owner decision was sought and the owner can overrule it in review. The coordinator relayed both points for the owner on 2026-10-19."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/recovery.ts line 135 sets the notice key to the SHA-256 of [\"notice\", repository, task, candidate], and line 136 sets the body \"Sandcastle verified candidate <candidate> for this issue and opened <url> for the owner's review. This issue stays open until the owner merges that pull request.\" (checked by Claude Code, Opus 5.5)."
---

## Problem

A new candidate for the same issue gets a new key, so its subscribers get another comment. The wording is new text on an existing channel that notifies the issue's subscribers.

## Desired outcome

The owner's answer is recorded, and the key or wording changes if the owner asks.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
