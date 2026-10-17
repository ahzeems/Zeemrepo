---
type: decision
title: ADR-0027 Changelog entries are per-branch fragment files
summary: Each branch records its change in its own dated file under changelog/, and CHANGELOG.md keeps the history before the switch, so concurrent branches never edit the same lines.
tags: [area/git, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: active
related: ["[[Changelog entries cannot conflict between branches]]", "[[ADR-0007 Changelog entries carry no post-merge facts]]"]
---
## Context

The change-records rule requires every branch to record itself with a `CHANGELOG.md` entry, and
`npm run changelog:guard` enforces it by reading the lines the branch added under a date heading.
Every branch writes at the top of the same section, so any two open pull requests conflict there.
That happened with PR 22 and PR 23 on 2026-10-17; the second could not merge until `main` was
merged into it, re-checked, re-reviewed and approved again.

Three ways out were considered: open only one changelog-touching pull request at a time, which is
a habit and not a check; a git `merge=union` attribute, which helps local merges but may not
change what GitHub reports; and per-branch fragment files, which remove the shared edit.

## Decision

OWNER DECISION, 2026-10-17: "Folder is the changelog (Recommended)".

- A branch records its change in a new file `changelog/<YYYY-MM-DD>-<slug>.md`, dated between the
  day the branch started and today (UTC), holding one or more `- ` entries.
- The folder is the changelog from then on. Nothing folds fragments back into one file.
- `CHANGELOG.md` keeps every entry written before the switch, unchanged, and gains one line
  pointing to the folder. Branches no longer edit it.
- A fragment describes the change and never a fact that exists only after the merge. This
  restates ADR-0007's rule for the new location; the pull request that switches the guard marks
  ADR-0007 superseded by this decision and sets this one active.
- One transition: the switching pull request itself still adds a dated `CHANGELOG.md` entry,
  because the required `guards` check runs main's old guard against it, and also adds its own
  fragment, which closes the transition for every later branch. After that, no branch
  edits `CHANGELOG.md`, and a branch opened before the switch moves its entry into a fragment
  when it merges `main`.
- A fragment is changed only on the branch that adds it; a correction after merge is a new
  fragment.

## Consequences

- Two branches can no longer conflict on the changelog, because each adds a different file.
- Reading the history means listing `changelog/` in name order rather than reading one file.
- Every live text that requires a `CHANGELOG.md` entry (rules, `CLAUDE.md`, `README.md`,
  runbooks, the Change records reference, the Sandcastle prompts and
  `config/governance-alignment.json`; the plan lists them) changes in the same pull request as
  the guard, so no live text asserts the old rule.
- Two branches that pick the same date and slug would still conflict; the slug names the branch's
  topic, which makes that rare and visible.
