---
type: idea
title: Improve the agent workflow
summary: Agents understand the task, explore what matters, change little, verify the outcome and report stops accurately, delivered in five owner-gated phases.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews the Phase 3 pull request; later phases wait for its merge.
project: "[[Agent workflow improvement]]"
related: []
---

Use evidence and owner decisions; do not invent approval.

## Problem

The owner's brief (2026-10-19) asks for agents that understand the requested outcome, scope and
acceptance criteria, find the relevant instructions, code, tests and callers, make small changes,
verify the actual outcome and report blockers, stops and recovery state accurately. It also asks for
less wasted context and tool activity, and for controlled admission and evaluation of external skills
and tools later.

## Desired outcome

Each requirement (R1 to R9 in [[Agent workflow improvement]]) has an evidence-backed coverage
assessment, and only confirmed, bounded changes land, one owner-merged pull request per phase.

## Next step

Phases 1 and 2 landed in PRs #27 and #28. Phase 3 is on `improve/phase-3-integration-admission`; Phase 4 starts from main after the owner merges it.
