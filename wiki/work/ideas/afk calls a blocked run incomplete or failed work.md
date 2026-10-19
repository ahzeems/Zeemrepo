---
type: idea
title: afk calls a blocked run incomplete or failed work
summary: After S10 a run with only blocked issues also exits 2, but afk.ts still describes every loop exit 2 as incomplete or failed work.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Close when S27's PR lands if it changes afk.ts 344 and 351; otherwise fix the wording in a small branch.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S10 Blocked-queue planning contract]]", "[[S27 Afk lands only issues handed to the merger]]"]
evidence:
  - "INFERRED: the S10 ticket's Discovered work (PR 54) records the wording gap and says S27 may take it, and its relayed review raised afk.ts exit-2 wording as a LOW (2026-10-19)."
  - "VERIFIED: on main at 4c56101, scripts/sandcastle/afk.ts line 344 (a comment) and line 351 (the warning) describe exit 2 as an incomplete or failed run (checked by Claude Code, Opus 5.5)."
  - "INFERRED: relayed coordinator message (2026-10-19): the S27 builder was told to update afk.ts lines 344 and 351 to mention blocked runs; the S27 ticket on main does not list this."
  - "UNKNOWN: whether the S27 branch in progress changes these lines; this note was written without reading it."
---

## Problem

S10 made a run whose only outstanding issues are blocked end with status `blocked` and exit 2.
afk reads only the exit code and warns that the loop "reported incomplete or failed work". An
operator who sees that warning after a run that only waited on blocked issues looks for a failure
that did not happen.

## Desired outcome

The afk warning for exit 2 covers blocked issues as well as incomplete or failed work.

## Next step

Check whether S27 changed the lines; if not, fix the wording in a small branch.
