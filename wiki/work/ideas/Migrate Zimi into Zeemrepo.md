---
type: idea
title: Migrate Zimi into Zeemrepo
summary: Bring Zimi's governance, wiki and skills into a Claude-Code-only repo, reviewed and improved with ECC.
tags: [area/planning, tool/ecc]
created: 2026-10-09
updated: 2026-10-10
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: "Finish the owner steps tracked in the Zimi migration project."
evidence:
  - "VERIFIED: delivered by the Zimi migration project (wiki/work/projects/Zimi migration.md), through owner-merged pull requests #1 to #20 (except #17, closed unmerged) and the machine-account branch."
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
