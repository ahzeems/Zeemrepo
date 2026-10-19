---
type: idea
title: Plan prompt test misses reworded dependency waivers
summary: The S10 prompt test refuses known waiver phrases and requires the positive rule, so a waiver added elsewhere in the prompt in new words still passes.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide whether a review checklist item for .sandcastle/plan-prompt.md is enough, or whether a model-backed planner check is worth an owner authorization.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S10 Blocked-queue planning contract]]"]
evidence:
  - "INFERRED: the S10 ticket (PR 54) records that the re-review at f50edf0 found two waiver rewordings that survive the prompt test and accepted them as the documented limit, and its UNKNOWN line says only a prompt review or a model run catches a waiver added in new words (2026-10-19)."
  - "VERIFIED: on main at 4c56101, scripts/sandcastle/plan-schema.test.ts lines 126 to 131 refuse a fixed list of phrases (fewest, weakest, least blocked, highest-priority, 'If every issue is blocked, include') and require the 'Never move a blocked issue into issues' and empty-list sentences (checked by Claude Code, Opus 5.5)."
---

## Problem

The old prompt told the planner to pick the least-blocked issue when every issue was blocked. S10
removed that waiver and added a test that refuses known phrasings of it. A new sentence elsewhere
in the prompt, such as one telling the planner to select the least risky issue, would restore the
waiver in words the test does not list, while the required positive rule stays in place.

## Desired outcome

A prompt change that lets the planner select a blocked issue is caught before it lands, or the
limit is recorded where prompt reviewers look.

## Next step

Name where the limit is checked: a review step for prompt edits, or a planner run the owner
authorizes.
