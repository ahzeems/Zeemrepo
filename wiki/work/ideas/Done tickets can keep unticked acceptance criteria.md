---
type: idea
title: Done tickets can keep unticked acceptance criteria
summary: wiki:lint accepts a ticket marked done while an acceptance criterion is still unticked, so a closed ticket can hide an unmet criterion.
tags: [area/wiki, area/compliance, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan a work-tracking rule so a done ticket either ticks every criterion or names the owner decision that waived one.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: an independent verifier planted status done with an unticked criterion in a scratch copy of the S12 ticket on 2026-10-18 and reported wiki:lint exiting 0."
---

## Problem

On 2026-10-18, on S12's branch for PR 34, the S12 ticket was marked done while its own evidence said the reproducibility criterion
awaited the owner. Only an independent review caught it. `npm run wiki:lint` exits 0 for a ticket with
`status: done` and an unticked box.

## Desired outcome

`wiki:lint` refuses a done ticket with an unticked acceptance criterion unless an owner decision covers it.

## Next step

Write the refusing test in `scripts/wiki/work-tracking.test.ts` first, as the write-guard skill describes.
