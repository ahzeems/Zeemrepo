---
type: idea
title: Lenient ECC label specs await an owner decision on a new rubric version
summary: The compliance label specs still credit weak substitutes, and fixing them needs a new rubric version that breaks comparison with earlier scores, so the owner decides.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether to revise the label specs under a new rubric version, accepting that new label scores will not compare with earlier ones.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes (PR 52) records that the label specs credit a documentation edit for wiring, one record for two, and writing a test for running it; S24 left them unchanged so label scores keep their meaning, and revising them is a rubric change that needs a new version and an owner decision (2026-10-18)."
  - "VERIFIED: the approved remediation plan on main says to version revised specs and not to compare new totals as if they used the old rubric."
---

## Problem

S24 added outcome checks beside the label specs but kept the labels as they were. The labels still
give credit for a documentation edit where wiring was required, for one record where two were
required, and for writing a test where running it was required. A label score therefore overstates
compliance. Revising the specs changes what every label score means.

## Desired outcome

The owner decides. If the specs are revised, they get a new version, and reports never compare
scores across the two versions.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
