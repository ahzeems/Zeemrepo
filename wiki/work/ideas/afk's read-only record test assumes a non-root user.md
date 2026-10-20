---
type: idea
title: afk's read-only record test assumes a non-root user
summary: The afk.test.ts case for a record in a directory afk may not write relies on chmod 0o555 stopping writes and restores the mode outside a finally block.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Skip the case when the tests run as root, and restore the .git mode in a finally block or t.after.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S27 Afk lands only issues handed to the merger]]"]
evidence:
  - "INFERRED: relayed coordinator message (2026-10-19): the independent verifier of PR 57 listed it as LOW D."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/afk.test.ts line 752 makes .git mode 0o555 for the case \"a record in a directory afk may not write\", and line 760 restores 0o755 after go() returns, not in a finally block or t.after; nothing in the file checks the user id (checked by Claude Code, Opus 5.5)."
---

## Problem

The case depends on mode 0o555 stopping writes, which is false for root, so a root run fails the test while afk behaves correctly. If `go()` throws, the mode is never restored, and the temporary fixture keeps a read-only `.git` that cleanup may not remove.

## Desired outcome

The case is skipped for root and always restores the mode.

## Next step

Fix it in a small branch that owns `afk.test.ts`; the repository rule says not to work as root, so the skip is a guard, not a supported mode.
