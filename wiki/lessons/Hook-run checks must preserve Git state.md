---
type: lesson
title: Hook-run checks must preserve Git state
summary: A test fixture run inside a git hook moved Zimi's real branch and set core.bare; pre-push now refuses when the check changes HEAD, the branch, core.bare or local config.
tags: [area/git, area/typescript, kind/pitfall]
created: 2026-10-08
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Git hooks route child Git commands to the hooked repository]]", "[[Merge gate contract]]"]
---

## What happened

In Zimi on 2026-10-08, a test created a disposable git fixture while the pre-commit hook ran
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
With `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` aimed at a decoy clone, all 511 tests passed
and the decoy's HEAD, refs, index, status and config were unchanged, so no current test leaks.

## Fix

Fixtures scrub the environment: `cleanGitEnv` in `scripts/test-support/repo-fixture.ts` drops
every `GIT_*` variable, and `scripts/lib/git.ts` does the same whenever a caller passes `cwd`.

The backstop is `scripts/git/git-state.ts`. `.githooks/pre-push` snapshots `HEAD`, the checked-out
branch, `core.bare` and the local config before `npm run check` and verifies them afterwards,
even when the check failed, refusing the push if anything moved. It names changed config keys,
never their values. `scripts/git/git-state.test.ts` covers each kind of change, and an
end-to-end run from a linked worktree, with a check that leaked a commit, was refused before
anything reached the remote.

## How to apply

- Spawn git in tests only through `createRepo` or `scripts/lib/git.ts` with an explicit `cwd`.
  A raw `execFileSync("git", ...)` in a test must pass `env: cleanGitEnv`.
- A test that passes on its own proves nothing about running under a hook. To check, run
  `npm test` with `GIT_DIR` aimed at a throwaway clone and compare the clone before and after.
- If `git-state` refuses a push, stop. Inspect the branch tip, `git config --local --list` and
  `core.bare` in this checkout and the main one, restore them, and find the test that escaped
  before pushing again. The check detects; it cannot undo, and it does not see every possible
  git change (other refs, the index, global config).
- `npm run pr` runs the check outside any hook, so the snapshot matters only for pushes that run
  the hook's own check.

Ported from Zimi `wiki/lessons/Pre-commit checks must preserve Git state.md` (Zimi main at f600680,
after the audited 9fb36b2), retitled because Zeemrepo's exposure is the pre-push hook.
