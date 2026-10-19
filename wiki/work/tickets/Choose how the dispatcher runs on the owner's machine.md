---
type: ticket
title: Choose how the dispatcher runs on the owner's machine
summary: Decide how the dispatcher is started, scheduled and stopped on the owner's machine.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: The owner chooses an option once Docker is installed.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose to run the factory on this machine, which needs Docker (interview answer 6)."
  - "VERIFIED: on 2026-10-19 this machine has no docker command (command -v docker)."
  - "VERIFIED: Hermes's dispatcher ticks every 60 seconds inside its gateway (Hermes kanban docs, read 2026-10-18)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Is the dispatcher a command you start, a user service that starts at login, or a scheduled job, and what stops it?

## Evidence

Answer 6 runs the factory only while the machine is on. Answer 7 adds caps and a stop on usage limits.

## Options

1. **Foreground command.** `npm run factory` loops until stopped or a cap is hit. Simple and visible.
2. **systemd user service.** Starts at login and survives terminals; needs a stop switch and logs.
3. **Timer per tick.** A scheduled one-shot run each interval; no long-lived process, more start-up cost.

## Recommendation

Option 1 for the first runs, then Option 2 once the caps have held for a week.

## Resolution

Unresolved.
