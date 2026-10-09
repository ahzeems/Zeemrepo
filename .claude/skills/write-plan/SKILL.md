---
name: write-plan
description: "Write the plan note for a project from what is already decided: a wiki plan in wiki/work/plans/, status proposed."
---

Adapted 2026-09-18 from mattpocock/skills@3cca18b `skills/engineering/to-spec` (MIT, Copyright (c)
2026 Matt Pocock).

This skill writes down what the conversation, the wayfinder map and the code already settled. It
does **not** interview. If a decision is still open, stop and say which: that is
[grill-plan](../grill-plan/SKILL.md) or a decision ticket on the [wayfinder](../wayfinder/SKILL.md)
map, not a sentence in a plan.

## Before writing

1. Load [wiki-memory](../wiki-memory/SKILL.md) and recall: the originating idea, the accepted
   decisions in `wiki/decisions/`, and the repository rules in `.claude/rules/`. Use the plan
   sections from the [note schema](../wiki-memory/references/note-schema.md#work-notes): Problem,
   Destination, Constraints, Decisions, Test seams, Implementation slices, Acceptance criteria,
   and Out of scope.
2. Load the map, if one charted this project. Its Destination becomes the plan's Destination,
   its Decisions so far become Decisions, its Out of scope carries over. An open map means the
   plan is early: say so and stop.
3. Read the code the plan touches. Use the terms in the domain glossary (`CONTEXT.md`, kept by
   [domain-modeling](../domain-modeling/SKILL.md)) where one exists, and respect the accepted
   decisions in the area. A plan that contradicts a decision must make the proposed change explicit.

## Find the seams, then confirm them

Sketch where the behaviour will be tested before writing a slice.

- Prefer an existing seam to a new one.
- Use the highest seam that exercises the behaviour.
- The fewer seams the better. One is ideal.
- Name the prior art: an existing test of the same kind, and where the new tests run.
  If this is the first implementation, state that the runner is created later in that change.

Show the owner the seams and wait for agreement unless that agreement already exists. A wrong seam is cheap to fix now and expensive
after the first slice.

## Write it

- One note, `wiki/work/plans/<Plan title>.md`, written through wiki-memory from
  [the plan template](../../../wiki/templates/plan.md), linked to its idea (and map, if any).
- `status: proposed`. A branch cannot approve its own plan: the plan is approved only when the
  owner merges the pull request that adds it.
- **Decisions:** one line each, the gist plus a link to the decision note or resolved ticket.
  Record nothing here that is not recorded there.
- **Implementation slices:** describe the behaviour each slice makes work, its acceptance and
  what blocks it. Cut them by the [Slicing rules in plan-tickets](../plan-tickets/SKILL.md#slicing).
  Cite `file:line` only as evidence for a fact, never as the instruction. A snippet is allowed
  when a prototype produced one that states a decision more exactly than prose: a schema, a state
  machine, a type. Trim it to the decision and say it came from a prototype.
- **Out of Scope:** each item with a one-line reason.
- Mark each claim `VERIFIED:` (with a citation), `INFERRED:` (and from what) or `UNKNOWN:`.
  `OWNER DECISION:` may refine `VERIFIED:` when the evidence is the owner's recorded words. Work
  the plan proposes is not evidence: state it in plain prose, for example "Recommendation: ...".

## After writing

Run `npm run wiki:lint`. Inspect the plan's references and acceptance criteria. Commit the plan
alone with a `docs(wiki): ` subject and open the pull request with the plan as `proposed`.
Tickets come later, from [plan-tickets](../plan-tickets/SKILL.md), and only after the owner merges
that pull request; the follow-up wiki change then sets `status: approved` and `approval_ref` to
that PR (`#N` or its URL).

## What this skill never does

It never invents a decision to fill a gap, never creates a ticket, and never marks its own plan
approved.
