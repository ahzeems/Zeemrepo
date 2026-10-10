---
name: write-guard
description: "Add or change a repository check or guard, test first, so it can actually fail."
---

A check that cannot fail protects nothing, and each step below comes from a check that passed
while the rule it stood for was being broken. The steps are in order, and the tests come before
the guard, as the test-first rule requires. The proof rules live in
[evidence-and-review](../../rules/zeem/evidence-and-review.md); the CLI conventions in
[design-principles](../../rules/zeem/design-principles.md). This skill links them rather than
restating them.

## 1. Prove the gap

Plant the violation and run the existing checks. If something already catches it, stop: the work
is elsewhere. If nothing does, the planted case becomes the first test. A rule written only in
prose is the usual gap ([Prose rules do not enforce themselves](<../../../wiki/lessons/Prose rules do not enforce themselves.md>)).

## 2. Write the failing tests first

- A sibling `*.test.ts`. `npm test` finds it through its quoted glob, and
  `scripts/toolchain/test-pairing.test.ts` fails a script without one
  ([Test commands must discover actual tests](<../../../wiki/lessons/Test commands must discover actual tests.md>)).
- A refusing case for each rule. For a document checker, also a valid and a broken tree under
  `scripts/fixtures/valid/` and `scripts/fixtures/broken/`
  ([Documentation checkers need counterexamples](<../../../wiki/lessons/Documentation checkers need counterexamples.md>)).
- Git fixtures through `createRepo` (`scripts/test-support/repo-fixture.ts`) or `scripts/lib/git.ts`
  with an explicit `cwd`. Any other child process in test code passes `env: cleanGitEnv`.
  `scripts/toolchain/fixture-env.test.ts` enforces it for direct calls, renamed or destructured
  spawners and namespace imports. It does not follow a spawner passed to another function, stored
  in an object, assigned after its declaration or read through a computed property (`cp["spawn"]`),
  so keep spawning inside the test-support helpers. It matters because the pre-push hook runs the tests
  with `GIT_DIR` set when pushed from a worktree
  ([Hook-run checks must preserve Git state](<../../../wiki/lessons/Hook-run checks must preserve Git state.md>)).

Run them and watch them fail for the reason you expect.

## 3. Build the guard to pass them

- A CLI under `scripts/<area>/` shaped like `scripts/git/branch-guard.ts`: `main(args, options)`,
  `isEntryPoint` and `runCli` from `scripts/lib/cli.ts`, which defines the exit codes. Never print a
  finding and exit 0 ([An advisory check cannot stop a commit](<../../../wiki/lessons/An advisory check cannot stop a commit.md>)).
- Git that cannot run, or unreadable input, is an error. Git that runs and answers "no" is an
  answer: `tryGit` and `isAncestor` in `scripts/lib/git.ts` return null or false for it, and the
  guard refuses rather than erroring.

## 4. Read inputs the way they really are

- Parse, do not grep: frontmatter through `scripts/lib/frontmatter.ts` (it also normalizes CRLF and
  a byte-order mark), git paths through `gitPaths`, which adds `-z`
  ([Wiki validation needs parsed metadata](<../../../wiki/lessons/Wiki validation needs parsed metadata.md>),
  [Wiki frontmatter must accept Windows line endings](<../../../wiki/lessons/Wiki frontmatter must accept Windows line endings.md>)).
- Take anything derived from the environment (account names, hosts, paths) as a parameter and test
  the values the real environment has
  ([A rule built from the environment needs testing in that environment](<../../../wiki/lessons/A rule built from the environment needs testing in that environment.md>)).
- Scan everything the rule covers, code and config included
  ([Redaction checks must cover code, not only notes](<../../../wiki/lessons/Redaction checks must cover code, not only notes.md>)).

## 5. Wire it into every list

- `package.json`: an npm script, added to `check:base`, which CI also runs for Dependabot pull
  requests. Only a guard a bot cannot satisfy (like the change-record guards) goes in `check` instead.
- `.github/workflows/guards.yml`, if it judges pull requests. That workflow comes from main
  (`pull_request_target`), installs main's dependencies and runs with `--root .` against the PR as
  data, so the new guard runs there only after this PR merges, and its dependencies must already be
  on main.
- `CLAUDE.md` ("Working here") and the table in `wiki/runbooks/Verify a repository change.md`.
- The reference page that owns the area: what the guard enforces and what it does not prove
  ([A passing memory guard does not prove current content](<../../../wiki/lessons/A passing memory guard does not prove current content.md>)).

Then the usual change records: changelog entry and work record.
