---
type: idea
title: The noSandbox provider writes the host's global git config
summary: Sandcastle's noSandbox provider runs git config --global on the host, so any use outside a test with its own GIT_CONFIG_GLOBAL changes the user's git config.
tags: [area/agents, area/git, kind/pitfall]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a guard that refuses a noSandbox run unless GIT_CONFIG_GLOBAL points into a temporary directory, or decide that the current callers need none.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S11 Non-executable branch inputs]]", "[[Shared git config changes while agents work]]"]
evidence:
  - "INFERRED: the S11 ticket's Discovered work on origin/fix/s11-branch-inputs (PR 50) records that with the noSandbox provider the SDK runs git config --global on the host, that its new test isolates this with a temporary GIT_CONFIG_GLOBAL, and that any other noSandbox use needs the same care (2026-10-18)."
  - "VERIFIED: on 2026-10-19 Sandcastle 0.12.0's dist/index.js runs git config --global --add safe.directory with ${sandboxRepoDir} (line 1950) and ${sandboxRepoDir2} (line 2078); on main at caa99e3, scripts/sandcastle/containment-smoke-guest.ts sets GIT_CONFIG_GLOBAL before its noSandbox run (line 86), and on origin/fix/s11-branch-inputs at aff82d8 review-input.test.ts does the same (line 62)."
---

## Problem

The two current noSandbox callers each set `GIT_CONFIG_GLOBAL` by hand before the SDK runs. A new
caller that forgets would add `safe.directory` entries to the user's global git config, as a probe
did once on 2026-10-18 (see [[Shared git config changes while agents work]]). Nothing checks it.

## Desired outcome

A noSandbox run outside an isolated global config fails a check, or every caller goes through one
helper that sets it.

## Next step

Plan the helper or guard; list the callers first.
