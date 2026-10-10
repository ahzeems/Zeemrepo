---
type: lesson
title: Redaction checks must cover code, not only notes
summary: The vault linter scanned notes, skills and three root documents, so a username or hostname committed in a script passed; the scan must cover everything the repository publishes.
tags: [area/agents, area/typescript, area/docs, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[A rule built from the environment needs testing in that environment]]"]
---

## What happened

In an earlier repository, the repository instructions forbade committing secrets, email addresses, machine
hostnames, and paths containing usernames. The wiki linter enforced that only over `wiki/`, the
skills folder, `docs/`, and three root instruction documents.

`scripts/` and `src/` were never scanned. Appending the machine's real home path to a script and
running `npm run wiki:lint` reported 82 notes OK. The same line in any wiki note would have
failed. The rule was repository-wide; the check was not.

The directory walker also matched only `.md` and `.base` files, so pointing it at a code
directory would have returned nothing even if the target list had included one.

## Fix

In that repository the walker gained a file pattern and the scan was extended to `scripts/` and `src/`
(`.ts`, `.js`, `.sh`) and the root `CHANGELOG.md`. The widened scan immediately failed on a test
that used a literal home path as fixture data; fixture paths now use the `/home/<user>`
placeholder the redaction rule exempts.

Zeemrepo goes further and drops the hand-picked list. `redactionTargets` in
`scripts/wiki/redaction.ts` scans every file git tracks or would add (ignored files excluded),
of any extension, skipping only binary files and the vendored ECC rules under
`.claude/rules/ecc/`. It also scans the staged copy of a file when it differs from the working
copy, so a commit cannot publish text the working tree no longer shows. `npm run wiki:lint` runs
it, and therefore pre-commit, pre-push and CI.

## How to apply

When a rule says "never commit X", check what the enforcing tool actually reads. Prove the gap
before fixing it: plant a real offending value, run the check, and confirm it passes. Then fix it
and confirm the same value now fails. Prefer a scope defined by what the repository publishes
over a list of folders and extensions, which misses whatever nobody thought to list. A rule
enforced over part of a repository holds only where someone happened to look.
