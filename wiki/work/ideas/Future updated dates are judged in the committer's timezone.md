---
type: idea
title: Future updated dates are judged in the committer's timezone
summary: The wiki history guard compares updated with commit dates in each commit's own timezone, so an agent that writes the UTC date and commits in a negative-offset evening could be refused.
tags: [area/wiki, area/git]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Write a failing test for a UTC updated date on a commit with a negative offset, then decide the rule.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S22 Historical wiki integrity]]"]
evidence:
  - "INFERRED: the independent verifier of PR 48 at 0e16c04 reported this edge as LOW, inferred from the code and not probed (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/wiki/wiki-history.ts line 130 reads dates with git log --format=%as%n%cs, which prints each date in the commit's own timezone."
---

## Problem

S22 refuses an `updated` date later than the edit. The edit date is taken in the committer's local timezone. An agent working at, say, UTC-5 after 19:00 would write tomorrow's UTC date and be refused. The owner's +0100 offset never hits it.

## Desired outcome

The rule names one timezone, and a test pins it.

## Next step

Show the refusal in a fixture, then pick UTC or the committer's zone and document it in the schema.
