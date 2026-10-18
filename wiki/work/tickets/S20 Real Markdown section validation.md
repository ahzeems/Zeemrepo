---
type: ticket
title: S20 Real Markdown section validation
summary: Require actual visible Markdown headings so comments and fenced examples cannot satisfy note or job-spec sections.
tags: [area/wiki, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P2
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S20, finding A19 and its S01 prerequisite."
  - "VERIFIED: the parent plan note reads status approved, approval_ref #15 and job_specs required, and the S01 ticket reads status done (read 2026-10-18)."
  - "VERIFIED: red commit 2517f25 failed 7 of 23 schema.test.ts cases, 1 wiki-validation.test.ts case, 1 work-tracking.test.ts case and 1 wiki-lint.test.ts case; the old regex accepted headings in multi-line comments and fences through validateWiki, validateWork and the wiki-lint CLI."
  - "VERIFIED: after the fix, node --test over scripts/wiki/*.test.ts, markdown-references.test.ts and scripts/lib/markdown.test.ts passed 226 of 226, and npm run check ran 1122 tests with 0 failures."
  - "VERIFIED: the broken wiki-lint fixture CLI exits 1 and names every hidden lesson and job-spec section; the valid fixture exits 0 with 4 notes."
  - "VERIFIED: npm run wiki:lint on the repository wiki passed 125 notes after the change, so no existing note relied on a hidden heading."
  - "VERIFIED: 6 planted mutants (drop top-level check, drop h2 check, parser html off, prefix match, strip emphasis, match any non-fence token) ran against the schema, markdown and wiki-lint tests; 5 failed 2 to 5 cases each and the last survived as equivalent for real section names (it can add the text of a heading_close's next token, such as an empty string, a code_block's text with its trailing newline or an html_block's text, none of which equals a section name)."
  - "INFERRED: markdown-references behavior is unchanged because only its parser construction moved; its existing link, image, comment and slug tests pass."
  - "INFERRED: relayed verifier report, review round one on 1ca4664: PASS with three LOWs (an untested unclosed fence after a heading, docs that understated the accepted heading forms and the equivalent-mutant wording, and the Obsidian %% comment gap)."
  - "VERIFIED: after adding the unclosed-fence control in 45e47da, the mutant that drops the heading_open check fails 2 tests (31 run) where it previously survived; the unmutated suite passes 31 of 31."
  - "VERIFIED: ran missingSections directly: '##  Fix', '##<tab>Fix' and '   ## Fix' count; '    ## Fix' and '<div>' then '## Fix' with no blank line do not."
  - "UNKNOWN: independent verification of the round-one fixes is pending."
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

- [x] Required headings hidden in HTML comments or fences do not satisfy a section requirement.
- [x] Valid visible headings still pass, with heading level/inline formatting behavior documented by controls.
- [x] Memory notes and required job specs both use the corrected boundary.
- [x] Existing links, heading-anchor behavior and frontmatter handling remain correct if shared parsing is extracted.
- [x] Valid/broken wiki CLI fixtures and full checks pass with no new parsing dependency.

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

## Outcome

`missingSections` in `scripts/wiki/schema.ts` reads the body through the installed markdown-it parser and counts only top-level `h2` headings whose source text equals the section name. The parser configuration moved to `scripts/lib/markdown.ts`, shared with `scripts/skills/markdown-references.ts`. `note-schema.md` states the rule. Behavior change on valid input: other CommonMark ATX forms now count as `Fix` that the old regex refused (`## Fix ##`, extra spaces or a tab after `##`, one to three spaces of indent), and so does a setext `Fix` over `---`. In the other direction, `## Fix` directly inside an HTML block such as `<div>` with no blank line before it no longer counts.

[no-doc-change: note-schema.md is itself the operating reference for required sections and now states the rule; no decision, reference or runbook describes section matching.]

## Discovered work

- `withoutCode` in `scripts/wiki/wiki-validation.ts` still strips code and comments with regular expressions to find wikilinks. Indented code blocks and fences inside lists are not stripped, so a `[[link]]` example there still counts as a link. It could reuse `markdownTokens`; outside this ticket's acceptance.
- An Obsidian comment (`%%` on the lines before and after `## Fix`) still satisfies a section, because CommonMark does not know `%%` comments. The verifier also named untested hidden forms that still count: a `$$` math block around the heading, and `<div hidden>` followed by a blank line. Pre-existing and outside this ticket; not fixed here.
