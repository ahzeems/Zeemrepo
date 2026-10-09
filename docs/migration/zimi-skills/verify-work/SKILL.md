---
name: verify-work
description: "Verify finished work from artifact and own runs; record one verdict per acceptance criterion. Read-only."
---

You judge whether the work met its acceptance criteria. You judge the artifact and the runs you
make yourself, never the implementer's account of them. You cannot edit, commit, push or move a
work item; a fix you would make goes in the verdict as a requested change.

## 1. Pin the tree you are judging

Inspect the current branch, commit if one exists, changed files, and untracked deliverables.
Record exactly what is being judged. For a new repository with no commit, inspect the actual
files rather than inventing a base revision.

Every command you run afterwards runs against that snapshot. A verdict is void if the tree
moved under you. Record whether the assessed files stayed unchanged.

## 2. Take the criteria from the ticket, not the handoff

The ticket or request gives the Acceptance section. The handoff says what the implementer
claims and where the evidence sits. Read both; judge against the ticket or request.

## 3. Run the checks yourself

Read [the feature map](references/feature-map.md) for launch recipes and prerequisites
when checking a mapped feature. A change review uses the affected entries; an explicit
maintain-verification-skill audit covers every entry. Discovery or dry runs prove only
their stated boundary, not authenticated model behavior, GUI rendering, or full installation.

- Run the checks that actually exist for the change; compare their inputs with step 1's snapshot.
- For a change to workflow, process, or landing behaviour, run `npm run governance:check`. A
  criterion is not met while a declared surface still states the rule the change replaced.
- Run `npm run memory:guard`. A criterion is not met while the branch has no dated changelog
  entry, no owning work record under `wiki/work/`, or a work record carrying no evidence.
- Run `npm run wiki:compliance` for any change touching the vault. A wiki record written
  without wiki-memory's commit rule is not a met criterion, whatever the note says.
- Run the ticket's own commands. A defect needs a red-then-green record: the repro command failing at `base_sha` and passing at `head_sha`.
- Re-run any measurement the handoff quotes. A number you did not produce is unverified.
- Read the changed files. A passing check on the wrong change is still the wrong change.

## 4. Judge by artifact type

Checks decide what a command can decide: behavior for code, valid fields for a schema,
working links for documentation. Apply unslop and documentation-standards when judging prose.
A passing check plus a rubric still needs review, not an automatic pass. Where the acceptance
criteria do not define the standard, say so rather than inventing one.

## 5. One entry per criterion

For each acceptance line record `criterion`, `status` (`met`, `not_met`, `needs_human`) and
`evidence_path` — the artifact or log you judged, never a summary. `needs_human` is for a
criterion no command can settle, such as taste or a business decision.

The verdict is `VERIFIED` only when every criterion is `met`. Any `not_met` makes it
`NOT_VERIFIED`, with `requested_changes` naming what to change. Do not repeat the same failed approach without new evidence. Use `INCONCLUSIVE` when you
could not run what the criteria need, and say what blocked you.

## 6. Record it

Re-check the tree first: if it differs from step 1, stop and re-verify. Return the verdict,
its evidence, limitations, and requested changes in the task or pull request. A separate
report file is not required for Day 1. Owner approval remains separate from verification.

## What this skill never does

It never edits the files it is judging, commits, pushes, merges, completes its own work
item, or labels a commit verified. It returns findings; any repair happens in a separate
phase before a new verification pass. Disclose self-review when the builder also reviews.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
