---
type: idea
title: No test pins the receipt store's default refusal label
summary: storeRefusals in verification-receipt.ts names the store "receipt store" by default, and changing that default passes every test that imports it.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Add an assertion on a default-label refusal (for example an unprivate receipt store) in verification-receipt.test.ts.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: relayed coordinator message (2026-10-19): the independent verifier of PR 59 listed it as N1 (verification-receipt.ts:77)."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/verification-receipt.ts line 77 declares storeRefusals(dir, forbidden, label = \"receipt store\"). With the default planted as \"state store\", verification-receipt, verifier-driver, isolated-publication, run-state and recovery tests each passed (10, 23, 22, 6 and 11 tests, 0 failures), run one file at a time; the file was restored (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on main at 2a69b17, prepareStore at line 98 of scripts/sandcastle/verification-receipt.ts has its own default label = \"receipt store\" and passes it to storeRefusals explicitly; the verifier-driver test matching /receipt store/ goes through prepareStore, so it pins prepareStore's default, not the one at line 77 (checked by Claude Code, Opus 5.5)."
---

## Problem

S17 added the `label` parameter so run-state refusals name their own store. Some receipt-store callers rely on `storeRefusals`' default at line 77. The one test that matches `/receipt store/` (verifier-driver) goes through `prepareStore`, which has its own default at line 98 and passes it on, so that test pins line 98 only. A refusal from a line 77 caller could name the wrong store unnoticed; a mutant for this gap belongs on line 77.

## Desired outcome

A test fails when the receipt store's refusals stop naming the receipt store.

## Next step

Add the assertion in a small branch.
