---
type: idea
title: Migrate Zimi into Zeemrepo
summary: Bring Zimi's governance, wiki and skills into a Claude-Code-only repo, reviewed and improved with ECC.
tags: [area/planning, tool/ecc]
created: 2026-10-09
updated: 2026-10-10
agent: claude-code
status: done
owner: human
priority: P1
evidence:
  - "VERIFIED: delivered through owner-merged pull requests #1 to #20 (except #17, closed unmerged), tracked in wiki/work/projects/Zimi migration.md; at that point the machine-account branch and its owner steps remained (done since; next item)."
  - "VERIFIED: PR #21 (machine account and code-owner review) merged by the owner; code-owner review is on and the owner's account has no SSH key registered. The empty bypass list and two-factor authentication on the machine account are owner-reported (see wiki/work/projects/Zimi migration.md)."
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
