---
type: ticket
title: Check whether the Sandcastle custom tracker accepts wiki ticket ids
summary: Find out whether @ai-hero/sandcastle 0.12.0's custom tracker accepts non-numeric ids and arbitrary branch names.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: agent
priority: P1
next_action: An agent reads the installed package and its docs and records the answer.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: research
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "UNKNOWN: the kanban research found the custom tracker option but did not build one (research note, Unknowns)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Can the custom tracker in `@ai-hero/sandcastle` 0.12.0 carry a wiki ticket's file name as its id and use `factory/<slug>` branches without changes to the library?

## Evidence

`plan-schema.ts` accepts only numeric ids and `sandcastle/issue-<n>` branches, but that is this repository's code, not the library's.

## Options

1. The library accepts string ids: only this repository's code changes.
2. It assumes numbers: map slugs to numbers, or patch the library.

## Recommendation

Read `node_modules/@ai-hero/sandcastle` and its documentation, and record the answer with file citations.

## Resolution

Unresolved.
