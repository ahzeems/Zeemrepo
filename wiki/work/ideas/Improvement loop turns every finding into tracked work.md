---
type: idea
title: Improvement loop turns every finding into tracked work
summary: Every gap a review or a branch uncovers becomes an idea, then an owner-approved plan, then tickets, instead of a note inside a closed ticket.
tags: [area/planning, area/wiki, kind/convention]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: The owner approves this records pull request; then a plan groups these ideas and names the rule and skill changes the loop needs.
related: []
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner said: \"yes follow up tickets always, there needs to be a  Improvement loop /level-up ideas, then plans, then tickets --- and everything in the repo should align to this thinking\"."
  - "VERIFIED: on 2026-10-18 no level-up command or skill exists in .claude/skills/ or in the installed ECC commands (searched with grep)."
---

## Problem

Review rounds and branches keep finding real gaps that sit outside the ticket in hand. Until now they were
recorded in a ticket's Observations or a PR description, which close with the ticket and leave no open work
item. The change-records rule says discovered work "gets a work-record entry", but it does not say which
record, or how it reaches a plan.

## Desired outcome

A standing improvement loop:

1. Each discovered gap becomes an idea note in `wiki/work/ideas/`, in a records pull request.
2. The owner groups related ideas into a plan through `write-plan`, and approves it by merging.
3. `plan-tickets` cuts the approved plan into tickets.

The rules and skills say so, so every agent follows the same loop. The owner calls the loop `/level-up`.

## Next step

Plan the loop itself. The plan covers:

- the wording in `.claude/rules/zeem/change-records.md`, where it names how discovered work is recorded;
- whether a user-only `level-up` skill runs the loop;
- how the ideas below are grouped into plans.
