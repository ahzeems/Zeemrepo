---
type: idea
title: afk calls a blocked run incomplete or failed work
summary: After S10 a run with only blocked issues also exits 2, but afk.ts still describes every loop exit 2 as incomplete or failed work.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: human
priority: P3
next_action: None. S27 changed the wording in PR 57 (d7890ee); afk's exit-2 comment, warning and usage text now name blocked runs.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S10 Blocked-queue planning contract]]", "[[S27 Afk lands only issues handed to the merger]]"]
evidence:
  - "INFERRED: the S10 ticket's Discovered work (PR 54) records the wording gap and says S27 may take it, and its relayed review raised afk.ts exit-2 wording as a LOW (2026-10-19)."
  - "VERIFIED: on main at 4c56101, scripts/sandcastle/afk.ts line 344 (a comment) and line 351 (the warning) describe exit 2 as an incomplete or failed run (checked by Claude Code, Opus 5.5)."
  - "INFERRED: relayed coordinator message (2026-10-19): the S27 builder was told to update afk.ts lines 344 and 351 to mention blocked runs; the S27 ticket on main does not list this."
  - "UNKNOWN: whether the S27 branch in progress changes these lines; this note was written without reading it."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/afk.ts line 351 (the comment, formerly 344) reads \"Exit 2 is the loop's blocked, incomplete or failed run\", line 359 (the warning, formerly 351) reads \"the Sandcastle loop reported incomplete or failed work, or blocked issues (exit 2, named above)\", and the usage text at lines 45 and 46 says exit 2 includes a loop that reported blocked or incomplete work. git log -S finds the warning first in d7890ee, the merge of S27's PR 57 (checked by Claude Code, Opus 5.5)."
---

## Problem

S10 made a run whose only outstanding issues are blocked end with status `blocked` and exit 2.
afk reads only the exit code and warns that the loop "reported incomplete or failed work". An
operator who sees that warning after a run that only waited on blocked issues looks for a failure
that did not happen.

## Desired outcome

The afk warning for exit 2 covers blocked issues as well as incomplete or failed work.

## Next step

None. S27 changed the lines in PR 57 (d7890ee), so this item is closed.
