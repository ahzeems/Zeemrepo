---
type: idea
title: A merger could swap the handed record for a symlink
summary: The coordinator writes and afk reads .git/sandcastle-handed.json without checking for a symlink, so a merger with a shell on the checkout could redirect both.
tags: [area/agents, area/git]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a refusal of a symlinked record path in the coordinator's write and afk's read, or confirm S14's isolated guest removes the merger's shell on the host checkout.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]", "[[S14 Isolated coordinator preparation and export]]"]
evidence:
  - "INFERRED: the S27 ticket's Discovered work on main (PR 57) records that neither the write nor the read checks for a symlink at the record path."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/coordinator.ts line 47 writes the record with writeFileSync, which follows a symlink (checked by Claude Code, Opus 5.5)."
---

## Problem

The record decides what afk lands. If the merger can replace the record path with a symlink before the coordinator writes it, the write and the later read follow the link.

## Desired outcome

The record path is refused when it is a link, or the merger cannot reach it.

## Next step

Decide after S14 lands whether the isolated guest already closes this.
