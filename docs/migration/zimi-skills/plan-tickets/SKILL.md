---
name: plan-tickets
description: "Turn approved plans into focused implementation tickets: one deliverable, checkable acceptance, and named dependencies."
---

Slicing rules adapted 2026-09-18 from mattpocock/skills@3cca18b `skills/engineering/to-tickets`
(MIT, Copyright (c) 2026 Matt Pocock).

A ticket is a contract with whoever picks it up. Slice an approved plan into tickets that each
name one deliverable, state acceptance a command can settle, and cite the plan they came from.

## Before slicing

The plan must have an owner-approved merge, and its map must have every decision ticket
resolved. Until then there is nothing to slice: extend the plan instead. Verify the actual
approval; a status label written by the agent does not establish it.

## Slicing

- **Vertical slices.** Each ticket cuts a narrow but complete path through every layer it needs
  (schema, action, check, docs), and can be verified alone. A ticket that delivers one layer of
  several features is a horizontal slice: re-cut it.
- **One fresh session each.** If a ticket will not fit one context window, it is two tickets.
- **Prefactor first.** Make the change easy, then make the easy change. The prefactor is its own
  ticket and the parent of the ones it eases.
- **A wide refactor is the exception.** One mechanical change that breaks call sites everywhere
  cannot land as a vertical slice. Sequence it as expand, migrate, contract: add the new form
  beside the old; migrate callers in batches by package, each a ticket whose parent is the
  expand; then delete the old form in a ticket whose parents are every batch. If the batches
  cannot stay green alone, they share an integration branch and one final verify ticket.

**Agree the breakdown before creating anything.** Show the owner a numbered list: title, parents,
and the end-to-end behaviour each ticket delivers. Ask whether the granularity is right, whether
each parent really gates its child, and what to merge or split. Reuse an approved breakdown; otherwise wait for the owner's answer.

## One ticket

- **One deliverable.** If the acceptance list needs "and" between two unrelated outcomes, it is two tickets.
- **Acceptance a check can settle.** "The guard refuses `gh pr merge` with a reason naming the rule" beats "the guard works". Each line should map to a command, a file that must exist, or a test that must pass. A line no command can settle is a decision ticket, not a build ticket.
- **Scope, stated twice.** What is in, and an out-of-scope list. The out-of-scope list is what keeps a slice from growing into its neighbours.
- **Dependencies as parents.** A ticket that cannot start until another finishes takes it as a parent; it stays blocked until the parent is done. Never make a map the parent of its own decision tickets: the map waits on them, so it would deadlock.
- **The plan and the map cited in the body**, by path and ticket id.

## Body shape

```markdown
**Goal** — one sentence naming the deliverable.

**Approach**
- The approved plan and map this comes from.
- The steps, each naming the file or command it touches.

**Acceptance criteria**
- [ ] One per line, each settled by a named command, file or test.

**Out of scope**
- What a reader might reasonably assume is included and is not.
```

## Create them

Keep each build ticket as its own note in `wiki/work/tickets/`, linked to the approved plan.
Decision tickets stay in the map.
This skill creates only build tickets from an approved plan. Use a map when decisions need
one; do not create a second tracking system.

## Job specs

When the plan carries `job_specs: required`, each build ticket is a job spec: add the job-spec
sections that wiki-memory's `references/note-schema.md` lists for tickets. `wiki:lint` refuses a
job spec that lacks one. Its Tests and evals section lists every case with a valid and a broken
control, written before the code, and the owner approves the job spec before implementation.

## After creating

Read each ticket back. Check its acceptance, plan reference, exclusions, and dependencies.
Then list the tickets and their parents in the plan's own slice table, linking to their
notes so each work item has one canonical record.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
