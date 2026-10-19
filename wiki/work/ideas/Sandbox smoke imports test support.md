---
type: idea
title: Sandbox smoke imports test support
summary: verifier-driver-smoke.ts, a module run by sandbox:smoke, imports the fake reviewer and fixtures from scripts/test-support/, the first non-test module to do so.
tags: [area/agents, kind/convention]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Owner decides whether non-test modules may import scripts/test-support/; if not, plan moving the smoke's fixtures.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the independent verifier of PR 49 at bdea98a reported (LOW L5) that the smoke is the first non-test module to import test support, accepted it, and noted it for the owner; it stayed open at 1654e5c (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/sandcastle/verifier-driver-smoke.ts line 8 imports from ../test-support/verifier-fixture.ts."
---

## Problem

The CI control has to build fixture candidates and use a fake reviewer, so it imports test support. That is deliberate, but no rule says whether production modules may do this, and a later live reviewer could reuse the path by mistake.

## Desired outcome

A rule or a lint boundary says which modules may import `scripts/test-support/`, and the smoke matches it.

## Next step

Ask the owner; the S15 ticket's Discovered work gives the reason the import exists.
