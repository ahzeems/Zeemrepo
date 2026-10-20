---
type: idea
title: Coordinator concurrency test misses reverse-order runs
summary: The coordinator test proves issue pipelines overlap only in one direction, so running issues one at a time in reverse plan order passes.
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: After S08 (PR 39) merges, plan a two-way overlap check in scripts/sandcastle/coordinator.test.ts.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: the S08 verifier at 28872e1 reported the reverse-order mutant passing 18 of 18 tests (2026-10-18)."
---

## Problem

S08's overlap test (in `scripts/sandcastle/coordinator.test.ts`, on S08's open branch, PR 39) makes issue 1's implementer wait for issue 2's to start, but not the reverse. A sequential
loop over the issues in reverse plan order still passes all tests.

## Desired outcome

Each implementer waits for the other to start, so a sequential run in any order fails.

## Next step

Add the reverse-order sequential mutant as a failing case, then a two-way barrier.
