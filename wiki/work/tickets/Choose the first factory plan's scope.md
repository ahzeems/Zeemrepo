---
type: ticket
title: Choose the first factory plan's scope
summary: Decide whether the first plan covers the whole factory or only the read-only board and picker.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: The owner chooses an option; the answer decides which plan write-plan drafts first.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "VERIFIED: write-plan stops while the plan's map has open decisions (.claude/skills/write-plan/SKILL.md, read 2026-10-19)."
  - "VERIFIED: the board and picker need no Docker, model, connector or governance change (research note, build inventory parts 1 and 2)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Should the first plan cover the whole factory, or only the read-only board and picker while the rest of this map is decided?

## Evidence

The build inventory in [[Software factory functions, gaps and build inventory]] orders twelve parts. Parts 1 and 2 (board reader, picker) depend on nothing else on this map except [[Define how the picker reads approval and open checkpoints]]. The rest wait on Docker, S18 and the decisions below. A whole-factory plan cannot be written until every ticket here is resolved.

## Options

1. **Board and picker first.** A small plan from [[Repository tickets drive parallel agent work on a kanban board]] and [[Smallest slice of a repository ticket board and its evals]], written as soon as the picker ticket is resolved. The factory plan follows when this map is done. Useful early, and it helps run the remaining remediation by hand.
2. **One factory plan.** Wait for every decision, then one plan with dependency-linked slices. One approval, but nothing is buildable until the slowest decision lands.

## Recommendation

Option 1. It gives a working board without waiting on Docker, S18 or governance PRs, and its evals (E1-E6, R1) are already designed.

## Resolution

Unresolved.
