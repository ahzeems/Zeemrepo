---
type: idea
title: The S14 image-name check refuses some valid Docker references
summary: The image pattern in S14's isolated run allows only lower-case letters, digits and a few marks, so valid references with upper-case tags, underscores or IPv6 registries are refused.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Owner decides whether S14 should accept the full Docker reference grammar or keep the narrow pattern and document it.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S14 Isolated coordinator preparation and export]]"]
evidence:
  - "INFERRED: the coordinator relayed the verifier's report at e33b1b9 (PR 62, open, not on main yet, fix/s14-guard-followups, 2026-10-19), which lists this as low finding L1: underscores, upper-case tags, upper-case registry hosts and IPv6 registries are refused."
  - "VERIFIED: at e33b1b9, scripts/sandcastle/isolated-run.ts line 57 is const IMAGE = /^[a-z0-9][a-z0-9._/:@-]{0,254}$/ (git show on 2026-10-19). This code exists only on open PR 62, not on main; recheck these lines if PR 62 changes before it merges. It has no upper case and no square brackets."
---

## Problem

`isolated-run.ts` refuses an image name that does not match its pattern before Docker runs. The
pattern is narrower than Docker's own reference grammar, so a caller with an upper-case tag or an
IPv6 registry address gets a refusal for a name Docker would accept.

## Desired outcome

The check refuses names that could read as options and accepts every reference Docker accepts, or
the narrower rule is a stated choice with a test.

## Next step

Ask the owner which of the two outcomes S14 wants, then file a build ticket.
