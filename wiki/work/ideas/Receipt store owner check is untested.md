---
type: idea
title: Receipt store owner check is untested
summary: The receipt store refuses a directory owned by another user, but no test exercises that check, because it needs a second uid.
tags: [area/agents, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a test seam (an injected stat result) or a CI step with a second user that kills the owner-check mutant.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the independent verifier of PR 49 reported mutant M8 (store owner unchecked) as surviving at bdea98a and still unexercised at 54f7215 (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/sandcastle/verification-receipt.ts lines 87 and 129 compare the store's uid with process.getuid(), and grep finds neither refusal message in any test file."
---

## Problem

A store another user can write to could hold forged receipts. The code refuses such a store, but removing that refusal fails no test, so a later change could drop it unnoticed.

## Desired outcome

A test fails when the owner check is removed.

## Next step

Inject the stat call so a test can present a foreign uid.
