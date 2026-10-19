---
type: idea
title: Live reviewer for verification receipts awaits owner authorization
summary: npm run sandbox:verify cannot issue a real receipt until the owner authorizes a live reviewer, which is a paid model call.
tags: [area/agents]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether and when to authorize a first live reviewer run; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the S15 builder recorded in the ticket's Discovered work that the real npm run sandbox:verify needs the owner to authorize a live reviewer, a pending owner decision (2026-10-18)."
---

## Problem

S15 proves receipts with a fake reviewer only, as the owner decided. The real command cannot issue a receipt for a real candidate until a live reviewer runs, and that costs money, so only the owner can start it.

## Desired outcome

The owner's decision is recorded, and if authorized, the first live run checks the receipt path end to end.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
