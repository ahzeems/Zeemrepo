---
type: ticket
title: S20 Real Markdown section validation
summary: Require actual visible Markdown headings so comments and fenced examples cannot satisfy note or job-spec sections.
tags: [area/wiki, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify approval and S01 completion, then exercise hidden-heading controls through the real validators.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S20, finding A19 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make required-section validation recognize real Markdown headings instead of matching raw lines in examples or comments.

## Inputs

- Plan S20, audit A19, `scripts/wiki/schema.ts`, work-tracking and wiki-validation callers.
- Inspect `scripts/skills/markdown-references.ts` and the installed Markdown parser before adding a parser or abstraction.

## Approach

1. Reproduce commented and fenced required headings being accepted by the actual validators.
2. Use parsed Markdown heading tokens with explicit level/text semantics.
3. Retain valid documents and verify both memory-note and required job-spec paths through their CLI fixtures.

## Acceptance criteria

- [ ] Required headings hidden in HTML comments or fences do not satisfy a section requirement.
- [ ] Valid visible headings still pass, with heading level/inline formatting behavior documented by controls.
- [ ] Memory notes and required job specs both use the corrected boundary.
- [ ] Existing links, heading-anchor behavior and frontmatter handling remain correct if shared parsing is extracted.
- [ ] Valid/broken wiki CLI fixtures and full checks pass with no new parsing dependency.

## Out of scope

Rendering, editorial judgment, approval inference and broad Markdown normalization.

## Allowed files

- `scripts/wiki/schema.ts`, `scripts/wiki/schema.test.ts`, `scripts/wiki/work-tracking*.ts`, `scripts/wiki/wiki-validation*.ts`, `scripts/wiki/wiki-lint.test.ts`, `scripts/fixtures/valid/wiki-lint/**`, `scripts/fixtures/broken/wiki-lint/**`.
- `scripts/skills/markdown-references.ts`, its test and a paired `scripts/lib/markdown*.ts` helper only if real callers share parsing.
- `.claude/skills/wiki-memory/references/note-schema.md`, `wiki/runbooks/Verify a repository change.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; do not rewrite live notes to make the test pass or weaken required sections.

## Human checkpoints

Verify approval and S01 landing. Seek agreement if a legitimate existing document would become invalid under a changed section convention.

## Secrets needed

None.

## Tests and evals

- `node --test "scripts/wiki/*.test.ts" scripts/skills/markdown-references.test.ts`; `npm run wiki:lint`; `npm run check`.
- Positive: real required headings and valid current notes/job specs.
- Broken: all required headings hidden in comments, fenced code, or the wrong heading level. Assert failure through `validateWork`/`validateWiki` and the real CLI, not only a parser helper.

## Rollback and recovery

Keep counterexamples in fixtures. If parsing compatibility fails, repair the parser boundary with valid controls; never delete or hide required sections to achieve green output.

## Evidence

Record parsed-heading controls, CLI refusal messages/exits, compatibility results and independent verification.

## Wiki and doc updates

State what constitutes a required section in the schema guidance and keep this ticket's evidence tied to actual validators.
