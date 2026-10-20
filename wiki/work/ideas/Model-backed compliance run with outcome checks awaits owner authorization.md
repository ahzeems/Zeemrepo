---
type: idea
title: Model-backed compliance run with outcome checks awaits owner authorization
summary: S24's outcome checks have never read a real session stream, and the run that would test them is a paid model call only the owner can authorize.
tags: [area/evals, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether and when to authorize a model-backed compliance run with the outcome checks; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S24 Outcome-based compliance requirements]]"]
evidence:
  - "INFERRED: the S24 ticket on origin/fix/s24-compliance-outcomes (PR 52) records that its controls use synthetic stream-json sessions, that no real session stream was replayed against the new checks, and that the first authorized run should confirm the stream assumptions before its counts are trusted (2026-10-18)."
  - "INFERRED: the same ticket records the assumption that a failed Bash call's result starts with 'Exit code N' and a denied one has is_error true without it, a format run_comply.py already relied on."
  - "INFERRED: its next_action says a model-backed measurement with the outcome checks needs separate owner authorization."
---

## Problem

The outcome checks read Claude Code's stream format to tell a failed tool call from a denied one.
They were tested only against streams written by hand. If the real format differs, the counts from
the first live run would be wrong without any test failing. A live run costs money, so only the
owner can start it.

## Desired outcome

The owner's decision is recorded. If authorized, the first run checks the stream assumptions before
anyone reads its counts.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
