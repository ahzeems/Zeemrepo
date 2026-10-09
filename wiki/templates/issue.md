---
type: issue
title: "{{title}}"
summary: Describe one observed failure.
tags: [area/planning]
created: "{{date}}"
updated: "{{date}}"
agent: human
status: backlog
owner: human
priority: P2
issue_kind: bug
idea: "[[REPLACE with originating idea title]]"
next_action: Reproduce the reported failure.
---

## Reproduction

State environment, revision, minimal input or command, and observed failure frequency.

## Expected and actual

Name the expected behavior and the actual observation separately.

## Root cause

Unknown until tested. Record hypotheses and the check that distinguishes them.

## Fix

Link the authorized change or an approved build ticket if needed. Do not invent approval.

## Verification

Record the original failure, corrected result, revision, commands, and review verdict.
Before done, add root_cause, fix_ref, regression_evidence, and prevention properties
containing actual results, and an evidence list whose items start with VERIFIED:,
INFERRED:, UNKNOWN: or OWNER DECISION: (at least one VERIFIED: or OWNER DECISION:).

## Prevention

Name an existing check and its runner, or none with a reason and the manual control.
