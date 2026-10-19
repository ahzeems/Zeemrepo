---
type: idea
title: A later inventory revision can reuse the S21 approval
summary: skills:lint accepts any inventory revision that quotes the S21 owner approval and names the skill, so one approval can cover a later change.
tags: [area/agents, area/compliance]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan binding each approval record to one revision (for example the hashes it approves) in scripts/skills/provenance.ts.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S21 Complete imported-skill provenance]]", "[[Skill standards]]"]
evidence:
  - "INFERRED: the S21 ticket's Discovered work on main (PR 58) records that a later revision can cite the ticket and quote again, that the linter only checks the record holds the quote and names the skill, and that legacy revisions had the same gap."
---

## Problem

An approval is meant to cover one change. Because the linter cannot tell a reused quote from a fresh one, a reviewer has to compare every quote with the owner's words.

## Desired outcome

An approval record covers only the revision it was given for.

## Next step

Plan it as a small provenance ticket.
