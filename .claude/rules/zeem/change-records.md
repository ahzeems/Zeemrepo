# Change records

What a branch must carry before it lands. The guards and how to satisfy them are listed once, in
`wiki/reference/Change records.md`; `npm run check` enforces them.

## Every branch

- Records itself: a new changelog fragment, `changelog/<YYYY-MM-DD>-<slug>.md`, an updated work record under `wiki/work/` with labelled evidence,
  and, when it touches a workflow-critical path, an operating doc (decision, reference or runbook) or a
  `[no-doc-change: <reason>]` note. Changelog entries describe the change, never facts that only exist after
  the merge. A fragment on `main` and `CHANGELOG.md` are history; a correction is a new fragment
  (`wiki/decisions/ADR-0027 Changelog entries are per-branch fragment files.md`).
- Definition of done: the code, its dependency declarations (manifest and lockfile in the same commit), the
  documentation beside the behavior, and the work record land in the same PR. Work that cannot carry all
  four is too big; split it.
- A new dependency carries a one-line justification in the commit that adds it. Prefer battle-tested
  libraries over hand-rolled code, as ECC's development workflow says.
- A new or replaced rule, skill or script retires what it replaces in the same PR and repoints every live
  reference. Historical records (changelog, decisions, migration docs) stay as written.
- A rule lives in one file. Changing a rule means editing that file, not restating it elsewhere; the
  governance guard (`config/governance-alignment.json`) refuses text that still asserts a replaced rule.
- A new source file extension updates every place that names extensions: `eslint.config.ts`,
  `tsconfig.json` and the globs in `package.json` scripts.

## Scope discipline

- Discovered work gets a work-record entry, not an inline fix, unless it blocks the current task; then fix
  it and say so in the commit.
- Drive-by fixes are limited to mechanical issues in lines this change already touches. Report anything else
  as an observation.
- A cleanup or refactor adds no behavior. If it would, stop and raise it as separate work.
- Every open work item names a concrete blocker or next action. A pending decision is a work item.
- A completed item cites the PR that completed it, never only the implementer's summary. A branch may mark
  its own work item `done` with evidence (the memory guard expects the record to move), but it is done only
  when the owner merges; never close an item outside its PR.

## ECC

ECC wins where this file and ECC disagree (`CLAUDE.md`), including its preference for battle-tested
libraries and Zod for validation in TypeScript.
