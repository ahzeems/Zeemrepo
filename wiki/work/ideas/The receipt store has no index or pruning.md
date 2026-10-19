---
type: idea
title: The receipt store has no index or pruning
summary: storedReceipts reads every receipt in the store on each reuse lookup, and nothing removes old receipts.
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Measure lookup time against store size once real receipts exist, then plan an index or pruning if it matters.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the S15 builder recorded in the ticket's Discovered work that the store has no index or pruning (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/sandcastle/verifier-driver.ts line 152 calls storedReceipts(request.store).find(...), and storedReceipts in verification-receipt.ts reads the store directory."
---

## Problem

Every verification looks for a reusable receipt by reading and validating every file in the store. The store only grows. With few receipts this costs nothing; after many runs each lookup slows down.

## Desired outcome

Lookup cost is measured, and an index or a pruning rule is added only if the numbers call for it.

## Next step

Wait for real receipts, then measure.
