---
type: ticket
title: Find how subscription usage limits reach a running worker
summary: Find out how a worker learns it has hit the subscription's usage limit, so the dispatcher can stop cleanly.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: agent
priority: P1
next_action: An agent reads the harness documentation and existing eval logs and records the signal.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: research
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose subscription login with a stop when usage limits are hit (interview answer 7)."
  - "UNKNOWN: how the limit surfaces to a running worker (research note, Unknowns)."
---

Use evidence and owner decisions; do not invent approval.

## Question

When a worker using the owner's subscription login reaches a usage limit, what does it see (exit code, message, reset time), and can the dispatcher read it before starting the next run?

## Evidence

The stop rule in answer 7 depends on a signal the dispatcher can detect. The compliance evals already run on the subscription login.

## Options

1. A detectable signal exists: the dispatcher stops and records the reset time.
2. No reliable signal: the dispatcher relies on its own daily run cap and treats failures as possible limits.

## Recommendation

Check the harness documentation and the compliance eval logs, and record the observed signal with its source.

## Resolution

Unresolved.
