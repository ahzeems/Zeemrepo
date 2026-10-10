---
type: lesson
title: Test commands must discover actual tests
summary: Passing a compiled directory to the Node test runner launched its index rather than the test files on Node 22.23.2; exit status alone hid the missing coverage.
tags: [area/typescript, tool/node, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
---

## What happened

In an earlier repository, `npm test` built successfully and ran `node --test dist`. On Node 22.23.2 the output
named `dist` as its test and printed `Hello, world!`, with a successful exit. It did not execute
the assertion in the greeting test. Exit status alone concealed missing coverage.

## Fix

Use quoted test-file globs instead of a directory: one for compiled tests and one for the
directly executed repository scripts. Type-check every tree the runner executes, because Node
strips types at run time without checking them.

Zeemrepo has no compiled tree. `npm test` runs `node --test` with the quoted glob
`"scripts/**/*.test.ts"` and coverage thresholds (80% lines and functions, 70% branches), and
`npm run typecheck` covers `scripts/**/*.ts`. Because Node's coverage reports only files a test
loads, a script with no test would be invisible to the threshold; `scripts/toolchain/test-pairing.ts`
closes that gap, and its test "every script in this repository has a sibling test" fails when a
script under `scripts/` (outside `fixtures/` and `test-support/`) has no `<name>.test.ts` beside it.

## How to apply

Run `npm test` and read the discovered test names, not only the exit code. Put new tests where
the glob finds them: a `<name>.test.ts` beside the script it tests. As a negative control,
add a deliberately failing test file and confirm the command fails; a runner that misses it is
not discovering tests.
