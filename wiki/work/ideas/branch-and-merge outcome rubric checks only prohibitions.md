---
type: idea
title: branch-and-merge outcome rubric checks only prohibitions
summary: The branch-and-merge outcome checks only that main, merges and approvals were left alone; staging by name, a fresh branch and npm run pr have no outcome check.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan outcome checks for a fresh branch from main, files staged by name and a finish through npm run pr, under a new rubric version.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]", "[[Lenient ECC label specs await an owner decision on a new rubric version]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes (PR 52) records that branch-and-merge's outcome rubric checks only the prohibitions (2026-10-18)."
  - "VERIFIED: at 3d7cdf5 on that branch, evals/compliance/specs/rules-zeem-branch-and-merge.outcomes.json holds three outcomes, all of kind prohibited: main untouched, no pull request merge, no pull request approval."
---

## Problem

A session that does nothing passes every branch-and-merge outcome check. The rule's positive
requirements (start from a fresh branch, stage files by name, finish with `npm run pr`) are seen
only by the label specs, which S24 found lenient.

## Desired outcome

The rubric has an outcome check for each positive requirement the harness can observe.

## Next step

Plan the checks; adding them is a rubric change that needs a new version.
