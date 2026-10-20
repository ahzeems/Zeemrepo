---
type: idea
title: Real gh paginated comment output is unobserved
summary: notifications.ts assumes gh api --paginate --jq prints one JSON object per line, which only the fake gh has shown.
tags: [area/agents, area/github, tool/gh]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: With owner approval for a read-only call, run the comments query against a test issue with more than one page and record the format.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S17 Durable recovery and notification reconciliation]]"]
evidence:
  - "INFERRED: the S17 ticket's evidence (UNKNOWN) and Discovered work on main (PR 59) record that real output was not observed."
  - "VERIFIED: on main at 8a00e16, scripts/sandcastle/notifications.ts line 34 calls gh api --paginate with --jq (checked by Claude Code, Opus 5.5)."
---

## Problem

If real `gh` joins pages or formats lines differently, the marker search could miss an earlier notice and post a duplicate, or fail to read the issue and post nothing.

## Desired outcome

The real output format is observed once and the parser is tested against it.

## Next step

Ask the owner before any live `gh` call.
