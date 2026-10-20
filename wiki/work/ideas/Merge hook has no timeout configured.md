---
type: idea
title: Merge hook has no timeout configured
summary: The merge-blocking PreToolUse hook runs without a timeout in .claude/settings.json, and what Claude Code does when a hook overruns is unknown.
tags: [area/agents, tool/claude-code]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Read Claude Code's hook documentation on timeouts and decide whether the hook needs one.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: the S25 verifier at 4cc84ef reported that .claude/settings.json sets no timeout for the hook (2026-10-18)."
---

## Problem

A long hostile command once made the hook quadratically slow; S25 bounds it. `.claude/settings.json`
sets no timeout for the hook, and whether Claude Code then allows or blocks the command is not recorded.

## Desired outcome

The hook's timeout behaviour is documented from a primary source, and a timeout is set if it fails open.

## Next step

Cite the Claude Code hooks documentation with its read date, then decide.
