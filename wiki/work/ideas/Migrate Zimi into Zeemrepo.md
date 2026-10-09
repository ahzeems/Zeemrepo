---
type: idea
title: Migrate Zimi into Zeemrepo
summary: Bring Zimi's governance, wiki and skills into a Claude-Code-only repo, reviewed and improved with ECC.
tags: [area/planning, tool/ecc]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: Deliver the phases tracked in the Zimi migration project.
project: "[[Zimi migration]]"
---

## Problem

Zimi grew around three agent harnesses and drifted: oversized instructions, contradictory
guards, copy-pasted code and a self-merge gate the owner no longer wants. Its rules, wiki
and evaluations are worth keeping for compliance work.

## Desired outcome

A Claude-Code-only repository where every kept rule is enforced by a check, work lands only
by pull requests the owner merges, and ECC reviews each part as it moves.

## Next step

Follow the phased plan; the audit is `docs/migration/zimi-audit.md`.
