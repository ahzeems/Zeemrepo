---
type: idea
title: npm run pr waits briefly for GitHub to show the pushed head
summary: npm run pr pushes, then refuses because GitHub still reports the pull request's previous head; a short bounded wait would remove the rerun.
tags: [area/git, area/github]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan a bounded re-read in scripts/git/pr-ready.ts that retries only when the head is the sole mismatch.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S06 Exact PR destination and head identity]]", "[[Merge gate contract]]"]
evidence:
  - "VERIFIED: the S06 ticket records the first live reuse on 2026-10-18: npm run pr at 83e1551 pushed, then refused because PR 38's head was still ce306d8; less than a minute later gh pr view 38 and git ls-remote showed 83e1551."
  - "INFERRED: the S06 agent reported the same refusal for the two later reuses, at 5ac895f on PR 38 and at f57b955 on PR 42, so three of three live reuses lagged (2026-10-18)."
---

## Problem

S06 made `npm run pr` refuse to hand off a pull request whose head is not the commit it checked and pushed.
That is right, but GitHub updates the head a little after the push. On 2026-10-18 the two live runs on PR 38
each refused once (the S06 ticket and the PR 38 body record them), and the S06 agent reported the same for a
third run on PR 42. Each rerun repeats `npm run check`, which takes minutes and loads the machine.

## Desired outcome

After pushing, `npm run pr` re-reads the pull request a few times over a short, fixed budget when the head is
the only mismatch. Every other identity field stays strict, and a head that is still stale after the budget is
refused as today, with the already-pushed note.

## Next step

Write the failing test first with a faked gh that reports the old head once, then the new one; then
measure how long the lag lasts on a few real pushes before choosing the budget.
