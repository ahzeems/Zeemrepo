---
type: idea
title: Correct the sandbox home privacy idea's evidence
summary: The idea note on the sandbox home exemption says its tests covered a climb out of the home, but that test used a personal login, which hid the gap S19 fixed.
tags: [area/wiki, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Correct that idea note's evidence in a records pull request once S19 lands.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Wiki privacy scan allows the sandbox home path]]"]
evidence:
  - "INFERRED: an independent verifier of PR 41 reported on 2026-10-18 that scripts/wiki/redaction.test.ts on main runs the climb-out case under a personal user name, and that on main a climb from the role home to another user gets no finding under a neutral identity."
---

## Problem

[[Wiki privacy scan allows the sandbox home path]] records that its tests covered a path climbing out of the
sandbox home. Audit finding A15 showed the test ran under a personal login, where the exemption never
applied, so the escape went unnoticed until S19.

## Desired outcome

The idea note's evidence says what its test actually proved and points to S19 for the fix.

## Next step

After S19 merges, edit that note's evidence and status.
