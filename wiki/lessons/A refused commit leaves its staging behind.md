---
type: lesson
title: A refused commit leaves its staging behind
summary: A commit refused by pre-commit kept code files staged; the retry added wiki files and committed the whole index, mixing the two. pre-commit now checks the staged paths.
tags: [area/git, area/agents, area/wiki, kind/pitfall]
created: 2026-10-07
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Prose rules do not enforce themselves]]"]
---

## What happened

In an earlier repository on 2026-10-07, two commits in a row were refused by the pre-commit hook. In the second
attempt the code files had already been staged for the planned code commit. The retry staged the
wiki files and ran `git commit` for the wiki commit, which committed the whole index:

```text
 11 files changed: 7 outside wiki/, 4 inside it
```

The next commit attempt failed with `wiki-compliance: this branch breaks the wiki-memory commit
rule`. Nothing had been pushed, so the mixed commit was undone locally and redone as two commits.

The cause was not the staging command. Each `git add` named its paths explicitly. A refused
commit leaves the index as it was, and the retry committed that index without listing it. The
rule already existed and the check already ran, but the compliance check read only the commits
on the branch, so it could refuse a mixed commit only after the commit had been made.
pre-commit runs before the commit exists, and nothing in it looked at the index.

## Fix

A `--staged` mode was added to the wiki compliance check. It reads
`git diff --cached --name-only --no-renames` and refuses a staged mix of `wiki/` with other
paths, using the history check's own path classification, so both sides of a rename count.
pre-commit runs it. Tests reproduce the incident (code left staged, wiki added) and cover
wiki-only, code-only and empty stagings and renames in each direction.

Branch review found that the first version also refused concluding a conflicted merge of
`main`, whose staged side always mixes wiki with code. The history check judges a merge only on
what it adds itself, so the staged check stands aside while `MERGE_HEAD` exists. The hook cannot
tell an amend from a new commit: an amend that adds code to a wiki-only commit passes it, and the
history check still refuses the result.

The owner then retired the old exception list. There are no exceptions: a commit that would mix
wiki with code is split into two, and a file moved across the boundary is added in one commit
and deleted in the next. The check caught a real recurrence the same day, refusing a mix of 9
wiki and 10 other files with no commit created.

In Zeemrepo the same check is `node scripts/wiki/wiki-compliance.ts --staged`, run by
`.githooks/pre-commit`. The `MERGE_HEAD` skip and the rename cases are tested in
`scripts/wiki/wiki-compliance.test.ts` ("staged check").

## How to apply

After any refused commit, list the index with `git diff --cached --name-only` before retrying.
The refusal does not unstage anything. With the hooks installed (`npm run hooks:install`),
pre-commit catches a mixed index outside a merge or an amend. Hooks are per clone, so without
them it does not; the history check in `npm run check` (run by pre-push and by CI) still refuses
the mixed commit, but only after it exists.
