---
type: ticket
title: Choose where factory run records and the usage ledger live
summary: Decide where the authoritative record of each run and its usage is kept, given the wiki reaches main only by owner-merged PR.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: The owner chooses an option; it may refine interview answer 7.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose that every run is logged to a usage ledger in the wiki (interview answer 7)."
  - "VERIFIED: S17's run state is one JSON file per issue in a host-only directory that no container mounts (scripts/sandcastle/run-state.ts, read 2026-10-19)."
  - "INFERRED: a wiki ledger written on every run would need a PR per run, or would live on unmerged branches the board must read."
---

Use evidence and owner decisions; do not invent approval.

## Question

Where is the authoritative per-run record (log, retries, usage) kept, and how does it reach the board and the wiki?

## Evidence

Answer 7 puts the ledger in the wiki; answer 10 shows run history on the board. Nothing reaches `main` without your merge, and a failed run's branch may never merge. S17 already keeps trusted per-issue state on the host, out of reach of guests.

## Options

1. **Host-only ledger.** Run records sit beside `run-state.ts`'s store; the board reads them; each landing PR adds a short evidence line to its ticket. Trusted and continuous; refines answer 7, since the wiki holds summaries only.
2. **Records on the ticket branch.** Each run commits its record to `factory/<slug>`. Lands with the PR, but failed and blocked runs never reach `main`, and guests could write their own records.
3. **A `factory/ledger` branch.** One long-lived branch the dispatcher appends to. Versioned, but a second state store in git with no merge gate.

## Recommendation

Option 1. Records stay where a worker cannot forge them, and the wiki keeps only what you merge.

## Resolution

Unresolved.
