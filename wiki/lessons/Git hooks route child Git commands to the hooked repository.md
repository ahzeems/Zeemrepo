---
type: lesson
title: Git hooks route child Git commands to the hooked repository
summary: Tests that spawn git inherit a hook's GIT_DIR and GIT_INDEX_FILE, so under a hook their fixture commands act on the real repository.
tags: [area/git, area/typescript, kind/pitfall]
created: 2026-10-06
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[A refused commit leaves its staging behind]]"]
---

## What happened

In Zimi on 2026-10-06, two new skill-lint command tests built a disposable Git repository and
passed `process.env` to every `git` call. Run directly, `npm run check` passed. Run by the
pre-commit hook, which exports the hooked repository's `GIT_DIR` and `GIT_INDEX_FILE`, the
fixture's `git init`, `git add .` and `git commit -m landed` acted on the feature worktree
instead: they replaced its index with the fixture tree and committed `bd0c0d8 landed` onto the
feature branch. A later fixture command failed, so the hook failed and the intended commit did
not happen. Nothing was published, and `main`, the other branches and the remote were unchanged.
The reinitialization rewrote the shared repository config; afterwards it held the expected keys,
but its earlier contents were not recorded, so an unchanged value cannot be proven.

The cause was not the one test. A child process inherits the hook's routing variables, and a
`cwd` does not override them. Some older tests already stripped a named list of them; the new
tests did not, and running the suite outside a hook cannot show the difference.

## Fix

The branch was moved back to its published head with `git reset --mixed`, which kept every
working file; the stray commit stayed in the reflog. A first correction reused the existing
filter, but review found that its named list omitted some routing variables (such as
`GIT_NAMESPACE` and `GIT_CEILING_DIRECTORIES`). The tests were changed to drop every `GIT_*`
variable, and a decoy test with its own filter proved a hook-like environment no longer leaked.

## How to apply

Any test or script that spawns `git` for a fixture drops every `GIT_*` variable first, not a
chosen few.

In Zeemrepo this is built into the shared helpers:

- `scripts/test-support/repo-fixture.ts` exports `cleanGitEnv`, which removes every `GIT_*`
  variable, ignores user and system config, and sets `GIT_CEILING_DIRECTORIES` to the temp
  directory. `createRepo()` runs every fixture `git` call with it. Use these helpers rather
  than passing `process.env` to `git`.
- `scripts/lib/git.ts` drops every `GIT_*` variable whenever the caller passes an explicit
  `cwd`. Without a `cwd` it keeps the hook's repository on purpose and drops only the variables
  that inject config or rewrite history. `scripts/lib/git.test.ts` covers this in "an explicit
  cwd wins over an inherited GIT_DIR (hook environment)".

`scripts/toolchain/fixture-env.test.ts` now reads the syntax tree of all test code and fails any
`child_process` call that does not pass `env: cleanGitEnv`, and the pre-push hook refuses a push
whose check changed the repository's git state
([[Hook-run checks must preserve Git state]]).

Ported from Zimi `wiki/lessons/Git hooks route child Git commands to the hooked repository.md` at 9fb36b2.
