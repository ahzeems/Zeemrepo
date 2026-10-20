---
type: idea
title: Receipts validate from any store a caller names
summary: validateReceipt accepts a forged receipt in any private directory the caller passes; only the documented rule that consumers pass the configured store prevents it.
tags: [area/agents]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: When S16 or S17 adds the first production consumer, add a test that it passes defaultStore() and never a path from an artifact or guest.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the independent verifier of PR 49 at 54f7215 and 1654e5c reported that a forged receipt in a directory the caller chooses validates (probe P2), accepted it as documented and within the owner's no-key limit, and noted that no production consumer exists yet (2026-10-18)."
  - "VERIFIED: on main at caa99e3, the comment above validateReceipt in scripts/sandcastle/verification-receipt.ts says dir must be the host's configured store (defaultStore()), never a path taken from an artifact or a guest."
---

## Problem

Receipts carry no signature, by the owner's decision, so their authority comes from where they are stored. The validator refuses stores inside the trusted source or artifacts, but any other directory the caller names is accepted. A consumer that took the store path from untrusted input would accept a forged receipt.

## Desired outcome

Every production consumer is shown by a test to pass the configured store.

## Next step

Add the consumer test in the ticket that adds the first consumer.
