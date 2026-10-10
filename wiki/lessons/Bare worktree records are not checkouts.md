---
type: lesson
title: Bare worktree records are not checkouts
summary: Parse git worktree porcelain as whole records and keep the bare attribute before running working-tree commands on each entry.
tags: [area/git, kind/pitfall]
created: 2026-10-06
updated: 2026-10-10
agent: claude-code
status: active
---

## What happened

In an earlier repository, `git worktree list --porcelain` included the common repository as its first record and
marked it `bare`. The worktree guard's parser kept only each `worktree` line, so the guard later
ran `git status` in that bare repository and failed:

```text
fatal: this operation must be run in a work tree
```

The parser's line filter erased the attribute needed to tell a repository record from a
checkout. Its tests contained linked worktree paths but no bare record, so they agreed with the
lossy representation.

## Fix

Parse the NUL-delimited porcelain output as complete records and keep each record's `bare`
attribute. Inspect uncommitted and unpushed work only for non-bare records. Empty, truncated or
structurally invalid output throws and follows the guard's inspection-failure path.

Zeemrepo carries the fixed parser: `parseWorktrees` in `scripts/git/worktree-validation.ts`
reads `git worktree list --porcelain -z`, returns `{ path, bare }` per record, and throws on
incomplete or inconsistent records. `scripts/git/worktree-validation.test.ts` includes a bare
record and malformed inputs, and `scripts/git/worktree-guard.test.ts` runs the guard from a
worktree of a bare repository, so dropping the bare filter fails a test. `npm run worktree:guard`
uses it.

## How to apply

When a Git porcelain format groups fields into records, keep the record boundary and every field
that controls later behavior. Give the parser's tests a record of every kind the real output can
contain, including the unusual ones (here, a bare record), so a lossy parser fails them.

The Zeemrepo root is a normal, non-bare checkout, so its first record is a checkout. A bare
record appears only in a clone whose common repository is bare, and the parser still has to
handle it.
