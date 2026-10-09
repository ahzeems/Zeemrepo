---
name: write-plan
description: "Write the plan document for a project from what is already decided: a local plan file, status proposed."
---

Adapted 2026-09-18 from mattpocock/skills@3cca18b `skills/engineering/to-spec` (MIT, Copyright (c)
2026 Matt Pocock).

This skill is the procedure and
  does not repeat them.

This skill writes down what the conversation, the wayfinder map and the code already settled. It
does **not** interview. If a decision is still open, stop and say which: that is `grill-plan` or
a decision ticket in the map, not a sentence in a plan.

## Before writing

1. Read `INTENT.md` and `AGENTS.md`. Use the sections: Problem, Destination, Constraints,
   Decisions, Test seams, Implementation slices, Acceptance criteria, and Out of scope.
2. Load the map, if one charted this project. Its Destination becomes the plan's Destination,
   its Decisions so far become Decisions, its Out of scope carries over. An open map means the
   plan is early: say so and stop.
3. Read the code the plan touches. Use the terms in `INTENT.md` and respect the accepted decisions in
   the area. A plan that contradicts a decision must make the proposed change explicit.

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

- One file, `docs/plans/<project-slug>.md` — created later when the work needs a plan.
- `**Status:** proposed`. A branch cannot approve its own plan.
- **Decisions:** one line each, the gist plus a link. Record nothing here that is not recorded
  there.
- **Implementation slices:** describe the behaviour each slice makes work, its acceptance and
  what blocks it. Cut them by the Slicing rules in `plan-tickets`. Cite `file:line` only as
  evidence for a fact, never as the instruction. A snippet is allowed when a prototype produced
  one that states a decision more exactly than prose: a schema, a state machine, a type. Trim
  it to the decision and say it came from a prototype.
- **Out of Scope:** each item with a one-line reason.
- Mark each claim VERIFIED (with a citation), INFERRED (and from what), RECOMMENDED or UNKNOWN.
  OWNER DECISION may refine VERIFIED when the evidence is the owner's recorded words, and PLANNED
  may refine RECOMMENDED for work the plan commits to once approved.

## After writing

Inspect the plan's references and acceptance criteria. Open the pull request with the plan as `proposed`. Tickets come later, from
`plan-tickets`, and only after the owner merges the plan as `approved`.

## What this skill never does

It never invents a decision to fill a gap, never creates a ticket, and never marks its own plan
approved.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
