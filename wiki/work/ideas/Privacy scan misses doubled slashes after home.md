---
type: idea
title: Privacy scan misses doubled slashes after home
summary: The redaction scan does not flag a home path written with a doubled slash after /home, for any user.
tags: [area/wiki, area/compliance, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a redaction change that treats repeated slashes after /home as one, with refusing tests.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: the S19 verifier at 60643e0 reported both forms passing on base and on the branch (2026-10-18)."
---

## Problem

`scripts/wiki/redaction.ts` matches a home path only with a single slash after `/home`. A doubled slash
(`/home//<user>`) is not flagged, and neither is a climb out of the role home written that way. This predates
S19 and applies to every home.

## Desired outcome

Repeated slashes after `/home` read as one, so those forms are flagged like their single-slash versions.

## Next step

Add the doubled-slash forms as failing cases in `scripts/wiki/redaction.test.ts`, then fix.
