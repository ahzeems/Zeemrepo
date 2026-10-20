---
type: ticket
title: Choose how wiki tickets replace issue keys in the Sandcastle pipeline
summary: Decide how the landed issue-keyed pipeline moves to wiki ticket ids, now that S10 and S14 are done and cannot be re-scoped.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: Resolve the custom-tracker research first; then the owner chooses an option.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: ["[[Check whether the Sandcastle custom tracker accepts wiki ticket ids]]"]
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner dropped GitHub issues and asked for S10 and S14 to be re-scoped by a plan amendment (interview answer 11)."
  - "VERIFIED: on 2026-10-19 S10 and S14 are done and S18 is proposed; plan-prompt.md, plan-schema.ts, afk.ts, run-state.ts, recovery.ts and notifications.ts all key work by issue (ticket front matter, read)."
  - "VERIFIED: S18 switches the public sandcastle commands to the isolated path and is the last remediation slice (S18 ticket, read 2026-10-19)."
---

Use evidence and owner decisions; do not invent approval.

## Question

With S10 and S14 already landed, how should the issue keys across the Sandcastle pipeline be replaced by wiki ticket ids, and when?

## Evidence

Answer 11's plan amendment has nothing left to amend. The coupling now spans planning, branch names, run state, recovery and notifications. See [[Software factory functions, gaps and build inventory]].

## Options

1. **Expand, migrate, contract after S18.** Add a task identity beside the issue number, move each module to it in its own ticket, then remove the issue form. One switch, on the isolated path.
2. **Parallel factory path.** Keep the issue pipeline for remediation and build a wiki-fed path beside it; retire issues once the factory works. Two paths for a while.
3. **Migrate now, before S18.** Fewer moving parts later, but it reworks S18's inputs while it is being built.

## Recommendation

Option 1, in the factory plan, once S18 lands. It follows the wide-refactor rule in plan-tickets and touches each module once.

## Resolution

Unresolved.
