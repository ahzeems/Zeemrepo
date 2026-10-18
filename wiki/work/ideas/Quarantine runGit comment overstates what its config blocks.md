---
type: idea
title: Quarantine runGit comment overstates what its config blocks
summary: A comment in the S13 quarantine says its trusted config allows neither aliases nor hooks, but runGit still runs an alias passed as a -c argument.
tags: [area/git, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Correct the comment above runGit in scripts/sandcastle/quarantine.ts so it names the real guarantee.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S13 Candidate artifact contract and quarantine]]"]
evidence:
  - "INFERRED: the independent verifier of PR 37 at 4622b1e reported that runGit runs an alias given as a -c argument, as the S13 tests show (2026-10-18)."
  - "VERIFIED: scripts/sandcastle/quarantine.ts on main ends the comment above runGit with \"Only aliases or hooks could start one, and the trusted config allows neither.\""
---

## Problem

The comment explains why the deadline need not bound a process that outlives Git. The real reason no alias runs is
that quarantine passes only fixed argument lists; the trusted config alone would not stop a `-c` alias.

## Desired outcome

The comment states the actual guarantee, so a later caller of `runGit` does not rely on the config.

## Next step

Edit the comment in a small branch; no behaviour changes.
