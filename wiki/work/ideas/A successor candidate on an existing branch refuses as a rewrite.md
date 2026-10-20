---
type: idea
title: A successor candidate on an existing branch refuses as a rewrite
summary: Isolated publication refuses a second verified candidate for a branch that already holds an earlier one, because the fresh quarantine cannot confirm the old tip is an ancestor.
tags: [area/agents, area/git]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan whether publication fetches the branch's current tip into quarantine before the ancestry check, or requires a new branch name for a successor.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S16 Trusted publication of verified candidate refs]]"]
evidence:
  - "INFERRED: the S16 ticket's Discovered work on origin/feat/s16-trusted-publication (PR 53) records that a second verified candidate for a branch already holding an earlier candidate refuses as a rewrite, because the fresh quarantine does not hold the old tip; publishing a successor needs a new branch name or fetching the old tip into quarantine first (2026-10-18)."
  - "VERIFIED: at 33cc404 on that branch, scripts/sandcastle/isolated-publication.ts judges push refusals with git merge-base --is-ancestor run in the candidate's quarantine (line 146)."
---

## Problem

When review asks for changes and a second candidate is verified, the natural move is to publish it to
the same branch so the open pull request updates. S16 refuses that as a history rewrite even when the
new candidate does descend from the old tip. The refusal is safe but blocks the ordinary fix-and-resubmit
loop.

## Desired outcome

A successor that descends from the published tip publishes to the same branch, and a real rewrite is
still refused.

## Next step

Plan after S16 lands; the fetch must not bring candidate-controlled hooks or config into quarantine.
