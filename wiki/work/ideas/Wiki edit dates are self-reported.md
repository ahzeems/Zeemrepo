---
type: idea
title: Wiki edit dates are self-reported
summary: The wiki history guard dates edits from commit metadata the committer sets, so a single forged commit with no later parent can move a body edit onto a note's created day.
tags: [area/wiki, area/git]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Research whether the PR's push time from GitHub could date edits in CI, then plan it if it can.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S22 Historical wiki integrity]]"]
evidence:
  - "INFERRED: the independent verifier of PR 48 at 793ed0e and 0e16c04 reported the forged-date probe still passes (LOW, carried over), as the S22 ticket records under UNKNOWN (2026-10-18)."
---

## Problem

Commit author and committer dates are whatever the committer sets. S22 closed the merge and parent-order variants, but a lone commit dated on the created day still rewrites a decision body without a refusal.

## Desired outcome

Edit dates come from something the committer cannot set, or the runbook keeps this as a stated limit with the owner's agreement.

## Next step

Check what GitHub records about push time and whether `guards.yml` can read it.
