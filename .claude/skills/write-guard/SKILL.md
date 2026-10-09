---
name: write-guard
description: "Add or change a repository check or guard: prove the gap, fail closed, parse real inputs, keep a broken control, wire it into npm run check."
---

A check that cannot fail protects nothing, and Zimi learned each step below from a check that
passed while the rule it stood for was being broken. Follow them in order; ECC's TDD workflow
still governs the tests themselves.

## 1. Prove the gap first

Plant the violation and run the existing checks. If something already catches it, stop: the work
is elsewhere. If nothing does, keep the planted case; it becomes the first refusing test.
Prose alone is not a check ([Prose rules do not enforce themselves](<../../../wiki/lessons/Prose rules do not enforce themselves.md>)).

## 2. Shape it like the other guards

- A CLI under `scripts/<area>/` exporting `main(args, options)` with `isEntryPoint` and `runCli`
  from `scripts/lib/cli.ts`, so tests run it in process. Read `scripts/git/branch-guard.ts` first.
- Exit 0 pass, 1 refused, 2 the guard could not run. Never print a finding and exit 0
  ([An advisory check cannot stop a commit](<../../../wiki/lessons/An advisory check cannot stop a commit.md>)).
- Fail closed: unreadable input, a git failure or a malformed config is exit 2, never a pass.
- Validate every input and refuse before any side effect, reporting every independent refusal.

## 3. Read inputs the way they really are

- Parse, do not grep: frontmatter through `scripts/lib/frontmatter.ts`, git paths with `-z`
  through `scripts/lib/git.ts` ([Wiki validation needs parsed metadata](<../../../wiki/lessons/Wiki validation needs parsed metadata.md>)).
- Normalize CRLF and a byte-order mark before parsing text
  ([Wiki frontmatter must accept Windows line endings](<../../../wiki/lessons/Wiki frontmatter must accept Windows line endings.md>)).
- Take anything derived from the environment (account names, hosts, paths) as a parameter, and test
  the values the real environment has
  ([A rule built from the environment needs testing in that environment](<../../../wiki/lessons/A rule built from the environment needs testing in that environment.md>)).
- Scan everything the rule covers, code and config included, not a convenient subset
  ([Redaction checks must cover code, not only notes](<../../../wiki/lessons/Redaction checks must cover code, not only notes.md>)).

## 4. Keep a broken control beside it

A checker that never sees a counterexample proves nothing. Add a refusing case for each rule, and
for a document checker a valid and a broken tree under `scripts/fixtures/valid/` and
`scripts/fixtures/broken/` ([Documentation checkers need counterexamples](<../../../wiki/lessons/Documentation checkers need counterexamples.md>)).
Show the new check failing on the control before showing it pass.

## 5. Write tests that cannot touch the real repository

- A sibling `*.test.ts`; `npm test` finds it through its quoted glob and `scripts/toolchain/test-pairing.ts`
  requires it ([Test commands must discover actual tests](<../../../wiki/lessons/Test commands must discover actual tests.md>)).
- Git fixtures only through `createRepo` in `scripts/test-support/repo-fixture.ts`; any other child
  process passes `env: cleanGitEnv`, which `scripts/toolchain/fixture-env.test.ts` enforces. The
  pre-push hook runs these tests with `GIT_DIR` set when pushed from a worktree
  ([Hook-run checks must preserve Git state](<../../../wiki/lessons/Hook-run checks must preserve Git state.md>)).

## 6. Wire it in and document it

- Add an npm script and append it to `check` in `package.json`. If it judges pull requests, add it
  to `.github/workflows/guards.yml` too, which runs main's copy against the PR as data.
- Describe what it enforces in the reference page that owns that area, and say what it does not
  prove ([A passing memory guard does not prove current content](<../../../wiki/lessons/A passing memory guard does not prove current content.md>)).
- Record the change: changelog entry, work record, and any rule file it now enforces.
