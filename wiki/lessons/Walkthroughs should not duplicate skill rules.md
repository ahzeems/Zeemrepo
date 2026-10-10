---
type: lesson
title: Walkthroughs should not duplicate skill rules
summary: A skill walkthrough grew by copying its matrix and repeating examples; link to the files that own the rules and keep one example per route.
tags: [area/docs, area/agents, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Skill standards]]"]
---

## What happened

In an earlier repository, the owner flagged the reading cost of a 2,351-word walkthrough of the skill library. It
copied the existing 17-skill matrix and described the same scenarios twice, once in prose and once
in a second table. Review checked that the walkthrough covered every skill, but not whether it
repeated rules that already had an owning file.

## Fix

The walkthrough was cut to one diagram and one example table, linking to the matrix and the
tracking runbook instead of restating them.

## How to apply

- Keep each rule in its owning file: the skill's own `SKILL.md` under `.claude/skills/`, the
  repository instructions, or the reference note that owns it. Guidance elsewhere links to it.
- During prose review, compare new guidance with those owning files and cut anything that restates
  them. A copy drifts the first time the original changes.
- Keep one example per route. A second table of the same scenarios adds reading cost, not
  coverage.
- Prevention: none automated. Semantic duplication needs judgment, and no lint check detects it.
  Word counts show size, not correctness or model-token cost.
