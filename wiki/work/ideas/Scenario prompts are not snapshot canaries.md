---
type: idea
title: Scenario prompts are not snapshot canaries
summary: The S23 snapshot boundary matches pinned scenario ids and scores, not the scenario prompts, so a prompt copied into prose without its id would ship in an evaluation snapshot.
tags: [area/evals]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide with S24's owner whether prompt text should be a canary, then plan the test.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S23 Benchmark-clean evaluation snapshots]]"]
evidence:
  - "INFERRED: the S23 builder recorded in the ticket's Discovered work that pinned scenario prompts are not canaries and only ids are matched (2026-10-18)."
  - "INFERRED: the independent verifier of PR 47 at 98826a0 listed detection by pattern only as a remaining limit (2026-10-18)."
---

## Problem

A benchmark-clean snapshot must not carry the scenarios an agent is graded on. The boundary refuses files that contain a scenario or step id, or a score next to an evaluation word. A scenario prompt pasted into a note without its id passes.

## Desired outcome

Either prompt text is matched as a canary, or the README states that it is not and why.

## Next step

Measure how long the prompts are and whether a distinctive line from each can be matched without false refusals.
