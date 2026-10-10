---
type: lesson
title: Hook-run checks must preserve Git state
summary: A test fixture run inside a git hook moved the real branch and set core.bare; pre-push now refuses when its check changes the repository's git state.
tags: [area/git, area/typescript, kind/pitfall]
created: 2026-10-08
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Git hooks route child Git commands to the hooked repository]]", "[[Merge gate contract]]"]
---

## What happened

In an earlier repository on 2026-10-08, a test created a disposable git fixture while the pre-commit hook ran
the full check. Its child git process inherited the hook's routing variables, so the fixture
commit landed on the real review branch and its `git init` set the shared repository's
`core.bare` to `true`. The same class of escape recurred twice that day from new test helpers,
and one run also replaced the repository's local author identity with the fixture's values. Each
focused test had passed outside the hook, where nothing was inherited. This is the trap in
[[Git hooks route child Git commands to the hooked repository]], repeated by tests written after
the first fix.

Measured in Zeemrepo on 2026-10-09 (git 2.53): a pre-push hook in the main checkout gets no
`GIT_DIR`, but a push from a linked worktree under `.worktrees/` exports
`GIT_DIR=<repo>/.git/worktrees/<name>`, and `.githooks/pre-push` runs `npm run check`, which
creates hundreds of fixture repositories. Pre-commit exports `GIT_INDEX_FILE` but runs no tests.
With `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` aimed at a decoy clone, every test passed
(511 then, 538 after this fix)
and the decoy's HEAD, refs, index, status and config were unchanged, so no current test leaks.

## Fix

Fixtures scrub the environment: `cleanGitEnv` in `scripts/test-support/repo-fixture.ts` drops
every `GIT_*` variable, and `scripts/lib/git.ts` does the same whenever a caller passes `cwd`.

The backstop is `scripts/git/git-state.ts`. `.githooks/pre-push` snapshots `HEAD`, the checked-out
branch, `core.bare`, local and per-worktree config, every ref, the index and the working tree
before `npm run check`, and verifies them afterwards, even when the check failed, refusing the
push if anything moved. The snapshot holds hashes, and messages name config keys with their
subsections redacted, so no value or embedded token is printed. `scripts/git/git-state.test.ts`
covers each kind of change, `scripts/git/hooks.test.ts` runs the hook itself with stub checks,
and an end-to-end push from a linked worktree, with a check that leaked a commit, was refused
before anything reached the remote.

A toolchain test, `scripts/toolchain/fixture-env.test.ts`, reads the syntax tree of all test code
and fails any `child_process` call that does not pass `env: cleanGitEnv`, whatever the command,
including spawners renamed, destructured or taken from a namespace import. A spawner passed to
another function, stored in an object, assigned later or read through a computed property is not
followed.

## How to apply

- Spawn git in tests only through `createRepo` or `scripts/lib/git.ts` with an explicit `cwd`.
  Any other child process in test code passes `env: cleanGitEnv`; the toolchain test enforces it.
- A test that passes on its own proves nothing about running under a hook. To check, run
  `npm test` with `GIT_DIR` aimed at a throwaway clone and compare the clone before and after.
- If `git-state` refuses a push, stop. Inspect the branch tip, `git config --local --list` and
  `core.bare` in this checkout and the main one, restore them, and find the test that escaped
  before pushing again. The check detects; it cannot undo, and it does not see global config,
  hooks or the object store.
- `npm run pr` runs the check outside any hook, so the snapshot matters only for pushes that run
  the hook's own check.
