---
type: idea
title: Snapshot leak check matches patterns only
summary: The S23 snapshot boundary finds leaks by line patterns, so restated results, recased or split ids, ids used as file names and marker lines with other text pass.
tags: [area/evals]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide with the owner which of the documented forms matter for S24 scenarios, then plan tests for those forms.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S23 Benchmark-clean evaluation snapshots]]"]
evidence:
  - "INFERRED: the independent verifier of PR 47 at d9c2cc9 probed these forms (P3a to P3c, P5d, P8) and at 98826a0 listed detection by pattern only as a remaining limit, with each gap documented in the README (2026-10-18)."
  - "VERIFIED: on main at caa99e3, evals/compliance/README.md (What stays visible) lists these forms as not found."
---

## Problem

A benchmark-clean snapshot should not let a later agent see graded results or pinned ids. The boundary is a set of line patterns. It catches literal ids, scores next to evaluation words and private-region markers, and the README names the forms it misses. Those forms stay possible leaks.

## Desired outcome

Each documented form is either detected under test or kept as a limit the owner accepted.

## Next step

Rank the forms by how likely an agent is to write them, starting with recased ids and ids split across lines.
