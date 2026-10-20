---
type: idea
title: Containment guest report has two untested paths
summary: Two mutants of the containment guest survive its unit tests, reporting a hard-coded Node version, and reading the wrong os-release path in report().
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan tests that kill mutants O3 and O4 in scripts/sandcastle/containment-smoke-guest.test.ts.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S12 Reproducible runtime and real containment control]]"]
evidence:
  - "INFERRED: the independent verifier of PR 40 at e425a3d reported that O3 (node reported as the literal v24.22.0) and O4 (report() reading /etc/hostname) each pass 59 of 59 unit tests (2026-10-18)."
  - "VERIFIED: scripts/sandcastle/containment-smoke-guest.ts on main calls toolchainIdentity(\"/etc/os-release\") inside report(), which no unit test runs, and the test of toolchainIdentity compares node with process.version."
---

## Problem

The S12 guest reports the toolchain it runs. Its tests compare the Node version with the test host's own, so a
hard-coded version passes on a host running that version, and `report()` itself is never called by a unit test.
The CI smoke would likely refuse O4, because the OS would read `unknown unknown`, but that was not run.

## Desired outcome

Each mutant fails a unit test, without needing Docker.

## Next step

Write the two failing tests first: one where the reported Node version cannot equal a literal, and one that
drives `report()` with an injected os-release path.
