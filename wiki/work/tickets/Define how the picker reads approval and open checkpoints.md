---
type: ticket
title: Define how the picker reads approval and open checkpoints
summary: Decide which existing fields tell the picker that a ticket is approved and has no open human checkpoint.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: The owner chooses an option; the answer becomes the picker's eligibility rule in the first plan.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner set eligibility as ready, owner agent, parents done, plan approved and no open human checkpoint (interview answer 4 in the idea)."
  - "VERIFIED: wiki:lint requires approval_ref on approved plans and refuses ready tickets with unfinished dependencies; job specs carry a Human checkpoints section, and plan-tickets says the owner approves each job spec before implementation (note-schema.md, plan-tickets SKILL.md, read 2026-10-19)."
  - "VERIFIED: S18's job spec still records job-spec approval as UNKNOWN, so the repository has no field that records it (S18 ticket evidence, read 2026-10-19)."
---

Use evidence and owner decisions; do not invent approval.

## Question

How does a deterministic script tell that a ticket's job spec is owner-approved and that no human checkpoint is open, using what the schema records?

## Evidence

Answer 4 in [[Software factory runs ideas to completion]] fixes the rule but not its fields. A plan's approval is its owner-merged PR (`approval_ref`). A job spec's own approval and a checkpoint being open are written only in prose today.

## Options

1. **Status carries it.** Only an owner-merged PR may set a ticket to `ready`; that merge approves its job spec. An open checkpoint sets the ticket `blocked` with a `blocker` naming the owner. No schema change.
2. **New fields.** Add `job_spec_approval_ref` and a `checkpoint` field. Explicit, but needs a schema change and lint rules.
3. **Plan-level approval.** The plan's merge approves every job spec under it. Simplest, but the owner loses the per-ticket review plan-tickets describes.

## Recommendation

Option 1. It reuses lint-enforced fields, and a ticket can only reach `main` as `ready` through your merge.

## Resolution

Unresolved.
