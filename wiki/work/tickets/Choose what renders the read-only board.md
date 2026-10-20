---
type: ticket
title: Choose what renders the read-only board
summary: Decide what renders the read-only board and run history.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: The owner chooses an option before the board slice's acceptance is written.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose a read-only front end showing the board and run history (interview answer 10)."
  - "UNKNOWN: question 5 of the kanban idea, what renders the board, has no owner answer."
---

Use evidence and owner decisions; do not invent approval.

## Question

What shows the board and run history: terminal output, a local web page, or an Obsidian view?

## Evidence

Answer 10 fixes what is shown, not how. The board reader already emits data a renderer can use.

## Options

1. **Terminal, then a static page.** `npm run board` prints text and JSON; a later slice writes one local HTML page from that JSON.
2. **Obsidian Bases view.** No code, but it sees only the wiki, not branches or run records.
3. **A local web app.** Closest to Hermes's dashboard; the most to build.

## Recommendation

Option 1. Every option reads the same JSON, so it can grow later.

## Resolution

Unresolved.
