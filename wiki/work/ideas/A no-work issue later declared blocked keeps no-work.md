---
type: idea
title: A no-work issue later declared blocked keeps no-work
summary: When a later plan declares a no-work issue blocked, the coordinator keeps no-work and the run can complete; whether blocked should replace no-work is undecided and untested.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Decide whether a blocked declaration should replace an earlier no-work outcome, then pin the chosen behaviour with a coordinator-queue test that kills the worked-ignores-no-work mutant.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S10 Blocked-queue planning contract]]"]
evidence:
  - "INFERRED: the S10 ticket's Discovered work and its evidence line for 8c22601 (PR 54) record that dropping no-work from the coordinator's worked check fails 0 of 76 tests, so a no-work issue a later plan declares blocked keeps no-work and the run can complete (2026-10-19)."
  - "VERIFIED: on main at 4c56101, scripts/sandcastle/coordinator.ts line 220 counts every outcome except blocked as worked, so record keeps an earlier no-work outcome when a later round declares the issue blocked (checked by Claude Code, Opus 5.5)."
  - "UNKNOWN: no test asserts either behaviour, so the current choice survives a planted change to it."
---

## Problem

S10 lets a blocked declaration replace only an earlier blocked outcome, so issues with work on
their branch keep outcomes the partial-failure policy must report. `no-work` falls under the same
rule, but it carries no branch work. An issue whose implementer committed nothing in round 1 and
that the round-2 plan declares blocked stays `no-work`, and the run can end complete with exit 0
even though the latest plan says the issue is blocked.

## Desired outcome

The coordinator either reports such an issue as blocked (run status blocked, exit 2) or keeps
`no-work` for a stated reason, and a test fails if the behaviour changes.

## Next step

Choose the behaviour, then write the coordinator-queue test first.
