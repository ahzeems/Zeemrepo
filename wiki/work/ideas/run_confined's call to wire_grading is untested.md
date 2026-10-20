---
type: idea
title: run_confined's call to wire_grading is untested
summary: run_confined calls wire_grading, but no test proves it, so removing that call would leave label grading unwired without a failing test.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan an assertion in S24's fake-ECC run_confined test that wire_grading is called, and plant the removal of the call to show it fails.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]"]
evidence:
  - "INFERRED: the S24 ticket's Discovered work on origin/fix/s24-compliance-outcomes at 3d7cdf5 (PR 52) records that wire_grading's call in run_confined is still untested and that the fake-ECC test added for wire_outcomes could assert it too (2026-10-19)."
  - "VERIFIED: at 3d7cdf5, run_comply.py run_confined (line 724) calls wire_grading (line 749) and outcome_validation.wire_outcomes (line 751); test_outcome_validation.py has test_run_confined_hands_the_outcome_checks_the_confined_runner_and_disarmed_git (line 446), which calls run_comply.run_confined (line 473); test_run_comply.py calls wire_grading directly (line 683) and patches run_confined out in its one other mention (line 418)."
---

## Problem

`wire_grading` has its own test, and S24's latest head tests that `run_confined` wires the outcome
checks. Nothing proves `run_confined` calls `wire_grading`. If a change dropped that line, the
harness would stop grading labels and every test would still pass.

## Desired outcome

A test fails when the `wire_grading` call is removed from `run_confined`.

## Next step

Extend the fake-ECC test after S24 lands, then plant the removal to show it fails.
