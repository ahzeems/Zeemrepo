---
type: idea
title: Provenance for the Zimi-origin skills awaits an owner decision
summary: Five skills migrated from Zimi have no provenance baseline, and only the owner can say whether they are imported text that needs one.
tags: [area/agents, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether grill-plan, unslop, verify-work, wiki-memory and write-guard need provenance baselines; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S21 Complete imported-skill provenance]]", "[[Migrate Zimi into Zeemrepo]]"]
evidence:
  - "INFERRED: the S21 ticket's Discovered work and UNKNOWN evidence on main (PR 58) record that grill-plan, unslop, verify-work (with references/feature-map.md) and wiki-memory (with three files under references/) arrived in e87d871 or ec99d63, and write-guard in 5166704, with no baseline entry."
---

## Problem

S21 hashes every file of the 12 skills in the import baseline. These five came over in the Zimi migration but were never listed as imported, so a change to them is not checked against an approved inventory.

## Desired outcome

The owner's answer is recorded. If any are imported, a build ticket adds their inventory with the owner's approval.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
