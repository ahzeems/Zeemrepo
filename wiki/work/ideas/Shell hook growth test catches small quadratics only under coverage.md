---
type: idea
title: Shell hook growth test catches small quadratics only under coverage
summary: The merge hook's growth test catches the sorted.find quadratic only under coverage, as npm test runs it; a plain node --test run lets it pass.
tags: [area/shell, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan whether the growth test's input grows or its threshold changes, so a plain run catches the mutant too.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S25 Shell-backstop refusal controls]]"]
evidence:
  - "INFERRED: the independent verifier of PR 36 at 0f32592 reported that the sorted.find mutant passed 6 of 6 plain node --test runs at ratios of 7.1 to 7.6 against the threshold of 8, and failed 2 of 2 coverage runs (2026-10-18)."
---

## Problem

`scripts/claude/block-pr-merge.test.ts` times the hook on growing input and fails when time grows much faster
than the input. A small-constant quadratic stays under the threshold in a plain run and crosses it only with
coverage. CI catches it; a developer running the ticket's own test command does not.

## Desired outcome

The growth test fails on that mutant in a plain run and under coverage, and still passes under load.

## Next step

Reproduce the plain-run pass, then try a larger input before changing the threshold.
