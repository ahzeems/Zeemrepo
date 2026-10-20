---
type: ticket
title: Choose where the learned-skill overlay lives
summary: Decide where learned skills live outside main, how workers load them, and how a bad one is rolled back.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: The owner chooses an option; the answer becomes the ADR and the owner-authority amendment.
idea: "[[Software factory runs ideas to completion]]"
ticket_kind: decision
map: "[[Software factory map]]"
depends_on: []
related: ["[[Software factory functions, gaps and build inventory]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner chose a versioned learned-skill overlay outside main, used at once, with promotion PRs (interview answer 3)."
  - "VERIFIED: .claude/rules/zeem/owner-authority.md approves an agent-drafted skill only when the owner merges it (read 2026-10-18)."
  - "VERIFIED: the isolated run copies only the tooling tree, a base bundle and the run spec into the container (scripts/sandcastle/isolated-run.ts, read 2026-10-19)."
---

Use evidence and owner decisions; do not invent approval.

## Question

Where is the learned-skill overlay stored, how does it reach a worker inside the isolated container, and how is a bad skill withdrawn?

## Evidence

Answer 3 needs a new ADR and an amendment to `owner-authority.md`. A learned skill is text a later worker obeys, so it is also a way for one run to steer the next.

## Options

1. **An orphan branch, `factory/skills`, in this repository.** Versioned and diffable; a bad skill is reverted there. The dispatcher copies it into the guest after `skills:lint` passes.
2. **A separate private repository.** Cleaner separation, but a second repository and credential.
3. **A host-only directory.** Like the receipt store: unforgeable by guests, but not versioned unless the dispatcher keeps history itself.

## Recommendation

Option 1, gated by `skills:lint` and the provenance check from S21 before each use, with promotion PRs into `.claude/skills/`.

## Resolution

Unresolved.
