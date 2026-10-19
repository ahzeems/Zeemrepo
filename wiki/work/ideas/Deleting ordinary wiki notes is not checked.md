---
type: idea
title: Deleting ordinary wiki notes is not checked
summary: The wiki history guard refuses deleting decisions and sessions after their day, but nothing refuses deleting any other note, although the wiki-memory skill says never delete a note to correct it.
tags: [area/wiki, area/compliance]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide with the owner which note types may be deleted, then plan the guard change test first.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S22 Historical wiki integrity]]"]
evidence:
  - "INFERRED: the S22 builder recorded in the ticket's Discovered work that deleting ordinary notes is not checked (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/wiki/wiki-history.ts reports a deleted violation only for notes it protects (decision and session bodies, per its header comment at line 8)."
---

## Problem

The skill rule "never delete a note to correct it" applies to every note, but S22 enforced it only for decisions and sessions. A branch can delete a lesson, runbook or idea note and every check passes.

## Desired outcome

Deleting a note that the rule protects fails `npm run wiki:compliance`, with any allowed deletion stated in the schema.

## Next step

Ask the owner whether work notes may be deleted, then plant a deleted lesson in a fixture.
