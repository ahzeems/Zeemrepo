---
type: idea
title: Outcome checks miss a guard run through a shell wrapper
summary: S24's outcome checks count a guard as run only when node, tsx or its own path starts the command, so bash -c or sh around it is not seen as a run.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan whether invokes() unwraps bash -c and sh before matching, with a broken control for each wrapper, under a new rubric version if scores change.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes at 3d7cdf5 (PR 52) records that a guard run through another interpreter or wrapper (bash -c, sh) is not recognised as a run (2026-10-19)."
  - "VERIFIED: at 3d7cdf5, outcome_validation.py invokes() (line 327) counts a segment as a guard run only when GUARD_RUNNER (line 49) matches, which allows optional variable assignments followed by node, tsx or npx tsx, or when the segment starts with the guard's own path."
---

## Problem

A session that runs its new guard as `bash -c "node scripts/x/guard.ts"` or `sh scripts/x/guard.sh`
did run it, but the refusal-observed outcome reports that the guard never ran. The check is stricter
than the behaviour it measures, so a compliant session can score as non-compliant.

## Desired outcome

The outcome checks recognise a guard run through the common shell wrappers, and still do not count
reading, linting or diffing the file as a run.

## Next step

Plan after S24 lands; check how often real sessions use a wrapper before widening the match.
