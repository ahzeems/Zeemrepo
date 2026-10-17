---
type: ticket
title: S21 Complete imported-skill provenance
summary: Extend approved provenance to imported companion instructions and inventory changes without rewriting landed provenance.
tags: [area/agents, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify approval and S01 completion, then define and test the full imported-file inventory and obtain approval for its baseline.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]", "[[Skill standards]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S21, finding A20 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval, inventory baseline approval and implementation evidence are pending."
---

## Goal

Detect unauthorized changes, additions and deletions across the complete imported instruction bundle.

## Inputs

- Plan S21, audit A20, `scripts/skills/provenance.ts`, skill validation/history tests and `import-baseline.json`.
- Read the imported companion files and their provenance notices as artifacts; do not execute user-only skills while inspecting them.

## Approach

1. Prove that changing a companion without changing SKILL.md escapes the current provenance check.
2. Define an approved file inventory/hash revision, preserving all existing landed provenance fields and revisions.
3. Validate additions, removals, content, path boundaries and approval records through `skills:lint`.
4. Establish a truthful migration baseline; do not label hashes of current files as verified original upstream hashes.

## Acceptance criteria

- [ ] A valid approved inventory passes, including unchanged entry points and companions.
- [ ] Changed, added or deleted imported instructions without an approved revision refuse.
- [ ] Unsafe paths, symlinks, missing/unreadable files and malformed inventory cannot become a pass.
- [ ] Existing landed provenance stays append-only; an authorized later revision remains possible.
- [ ] The owner reviews the baseline inventory and the required actual approval evidence is recorded before landing it.

## Out of scope

Rewriting skill methods, inventing original-source evidence or removing owner authorization requirements.

## Allowed files

- `scripts/skills/provenance*.ts`, `scripts/skills/skill-validation*.ts`, `scripts/skills/skill-lint*.ts`, `scripts/fixtures/valid/skill-lint/**`, `scripts/fixtures/broken/skill-lint/**`.
- `.claude/skills/import-baseline.json`; `config/skill-standards.json`, `scripts/skills/skill-standards.ts` and `scripts/skills/skill-standards.test.ts` only if the schema genuinely requires them.
- `wiki/reference/Skill standards.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; imported SKILL.md/companion text and landed revision history are read-only in this slice unless separately authorized.

## Human checkpoints

Verify job approval and parent completion. Obtain the required owner authorization for the actual inventory baseline/revision; do not fabricate a quote or treat an agent-authored record as the owner's words.

## Secrets needed

None; hashes and public source references only.

## Tests and evals

- `node --test "scripts/skills/*.test.ts"`; `npm run skills:lint`; `npm run check`.
- Positive: approved complete inventory and append-only authorized revision.
- Broken: companion-only edit, added/deleted file, unsafe path, unreadable content, changed landed history and missing authorization. Exercise the real CLI and history fixtures.

## Rollback and recovery

Do not remove a landed revision as rollback. Restore content through a new authorized append-only revision or repair the validator through a PR, preserving provenance history.

## Evidence

Record the inventory/source basis, changed-file refusal controls, approval evidence and independent verification without claiming unsupported upstream equivalence.

## Wiki and doc updates

Update skill standards with inventory and migration semantics, then record the accepted baseline and implementation PR in this ticket.
