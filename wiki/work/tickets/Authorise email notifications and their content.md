---
type: ticket
title: Authorise email notifications and their content
summary: Decide the sending account, recipient, events and allowed content for factory email, as the one-time outbound authorisation.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Resolve the Gmail sending research first; then the owner decides.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: ["[[Compare Gmail sending paths for a headless dispatcher]]"]
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose email through Gmail for PR ready, blocked, decision needed, cap hit and a daily summary (interview answer 8)."
  - "VERIFIED: owner-authority.md requires a redaction pass before content leaves the workspace (read 2026-10-18)."
  - "VERIFIED: S17 delivers notices as issue comments with a dedupe marker and never assumes delivery (scripts/sandcastle/notifications.ts, read 2026-10-19)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Which account sends factory email, to whom, for which events, and what may a message contain?

## Evidence

Email is a new outbound destination, so it needs a recorded decision. S17's delivery pattern (record the attempt, reconcile before resending) carries over.

## Options

1. **Minimal content.** Ticket title, state, PR link and a one-line reason; no logs, diffs or paths. Sent by the machine account to the owner's address.
2. **Rich content.** Adds the reviewer's findings and log excerpts. More useful away from the desk, more to redact.

## Recommendation

Option 1. Anything longer is one click away in the PR or the board.

## Resolution

Unresolved.
