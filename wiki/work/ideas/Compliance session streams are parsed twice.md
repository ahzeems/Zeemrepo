---
type: idea
title: Compliance session streams are parsed twice
summary: run_comply.successful_calls and outcome_validation.tool_calls each parse the stream-json session separately; one parser would serve both.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan one stream parser that both callers use, keeping ECC's call numbering, as its own refactor with no behavior change.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes (PR 52) records that both functions parse the stream and that changing chain splitting was outside that ticket (2026-10-18)."
  - "VERIFIED: at 3d7cdf5 on that branch, run_comply.py successful_calls (line 362) and outcome_validation.py tool_calls (line 119) each loop over the stream's JSON lines and pair tool_use blocks with their results."
---

## Problem

Two functions decide, each in its own code, which tool calls in a session succeeded. If Claude Code's
stream format changes, one could be fixed and the other missed, and the label score and the outcome
checks would then disagree about the same session.

## Desired outcome

One parser decides call results for both, with the existing tests of each caller still passing.

## Next step

Plan the refactor after S24 lands.
