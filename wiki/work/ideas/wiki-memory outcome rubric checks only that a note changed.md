---
type: idea
title: wiki-memory outcome rubric checks only that a note changed
summary: The wiki-memory outcome check passes when any wiki note changes; it does not check the template, the frontmatter or the Memory index line.
tags: [area/evals, area/compliance, area/wiki]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan outcome checks that the changed note passes wiki:lint and that a new memory note has its Memory index line, under a new rubric version.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]", "[[Lenient ECC label specs await an owner decision on a new rubric version]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes (PR 52) records that wiki-memory's outcome rubric checks a changed wiki note, not its template, frontmatter or index line (2026-10-18)."
  - "VERIFIED: at 3d7cdf5 on that branch, evals/compliance/specs/skills-wiki-memory.outcomes.json holds the three prohibited outcomes and one outcome of kind path_changed, outcome_memory_note_written."
---

## Problem

A session that writes a malformed note, or a new memory note missing from the Memory index, passes
the wiki-memory outcome check. The skill's steps that make a note findable are not measured.

## Desired outcome

The outcome checks fail a session whose note breaks the schema or is not indexed.

## Next step

Plan the checks; adding them is a rubric change that needs a new version.
