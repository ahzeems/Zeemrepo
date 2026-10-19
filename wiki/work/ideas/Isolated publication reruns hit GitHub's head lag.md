---
type: idea
title: Isolated publication reruns hit GitHub's head lag
summary: Right after a push GitHub can still report the previous head, so a rerun of S16's isolated publication refuses as a stale head, as npm run pr does.
tags: [area/agents, area/git, area/github]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan the bounded head re-read once for both npm run pr and isolated publication, since both hand off through handoff in scripts/git/pr-ready.ts.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S16 Trusted publication of verified candidate refs]]", "[[npm run pr waits briefly for GitHub to show the pushed head]]"]
evidence:
  - "INFERRED: the S16 ticket's Discovered work on origin/feat/s16-trusted-publication (PR 53) records that GitHub can report the previous head just after a push (S06's head lag), and that a rerun of publication then refuses as a stale head in the same way as npm run pr (2026-10-18)."
  - "VERIFIED: PR 53 changes scripts/git/pr-ready.ts and adds scripts/sandcastle/isolated-publication.ts (git diff --name-only origin/main...33cc404 on 2026-10-19)."
  - "VERIFIED: at 33cc404 on that branch, isolated-publication.ts imports handoff from scripts/git/pr-ready.ts and calls it after its push (line 192); pr-ready.ts refuses when the pull request's headRefOid is not the checked commit (line 178)."
---

## Problem

[[npm run pr waits briefly for GitHub to show the pushed head]] covers the lag for `npm run pr`. S16
adds a second command that pushes and then reads the pull request head, so it meets the same lag. If
only one path gets the bounded wait, the other keeps refusing on the first try.

## Desired outcome

Both commands re-read the head over a short fixed budget when it is the only mismatch, and stay strict
on every other identity field.

## Next step

Fold this into the plan for the npm run pr note rather than planning it separately.
