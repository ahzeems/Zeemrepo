---
type: idea
title: afk's record check has an untested lstat failure path
summary: removable() in afk.ts refuses when lstat fails with anything but ENOENT, and no test reaches that branch.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a test that makes lstat on the record path fail with an error other than ENOENT (for example a record path under a file) and kill the mutant that treats every lstat error as absent.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]"]
evidence:
  - "INFERRED: relayed coordinator message (2026-10-19): the independent verifier of PR 57 listed it as LOW C. The path fails safe: afk refuses and exits 2."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/afk.ts removable() (line 392) returns true from its lstat catch only for ENOENT and false for any other error; afk.test.ts covers a directory at the record path and a record in a directory afk may not write, but no lstat failure other than ENOENT (checked by Claude Code, Opus 5.5)."
---

## Problem

afk checks before the loop that it can remove the coordinator's record of handed branches. When `lstat` on the record path fails with an error other than ENOENT (for example ENOTDIR or EACCES on a parent), `removable()` returns false and afk refuses. No test reaches that branch, so a change that counted every `lstat` error as "no record" would pass the suite.

## Desired outcome

A test pins the refusal for a non-ENOENT `lstat` error.

## Next step

Add the test in a small branch that owns `afk.test.ts`.
