---
type: ticket
title: Compare Gmail sending paths for a headless dispatcher
summary: Compare Gmail API with OAuth and SMTP with an app password for sending from a headless dispatcher.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: agent
priority: P2
next_action: An agent compares setup, credential storage and failure reporting, and records a recommendation.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: research
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose email through Gmail (interview answer 8)."
  - "UNKNOWN: which sending mechanism suits a headless dispatcher (research note, Unknowns)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Which way of sending through Gmail fits a dispatcher that runs unattended, keeps its credential out of every sandbox, and must know whether a message was delivered?

## Evidence

No mail connector is set up for the dispatcher. S17 requires a delivery to be confirmed, not assumed.

## Options

1. **Gmail API with OAuth.** Scoped to sending; tokens need refreshing.
2. **SMTP with an app password.** Simple; the password grants full mailbox access and needs two-step verification.

## Recommendation

Compare scope, credential storage on the host, and what each reports on failure; recommend one with sources.

## Resolution

Unresolved.
