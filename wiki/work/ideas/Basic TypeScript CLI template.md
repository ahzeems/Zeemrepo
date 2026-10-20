---
type: idea
title: Basic TypeScript CLI template
summary: A minimal, tested TypeScript CLI under scripts/app/ to copy when starting a new script application, with an npm run ci script for type checking and tests.
tags: [area/typescript, tool/node]
created: 2026-10-12
updated: 2026-10-13
agent: claude-code
status: in-progress
owner: claude-code
priority: P2
next_action: Owner decides whether the tests stay on node:test or move to Vitest, then reviews and merges the pull request for issue #1.
related: []
evidence:
  - "INFERRED: scripts/app/greet.test.ts was written before scripts/app/greet.ts by the Sandcastle implementer, from its own account; the code and test arrived in one commit, so history shows no red run."
  - "VERIFIED: on this branch the three new main cases (--help, an argument starting with a dash, a whitespace-only name) failed against the scaffold's main (4 failures counting their suite) and pass after the change: scripts/app/greet.test.ts has 3 tests with 10 subtests, 13 of 13 pass, lint and typecheck are clean (2026-10-13)."
  - "VERIFIED: node scripts/app/greet.ts printed 'Hello, world!' with no argument, 'Hello, Ada!' for one name, and 'usage: greet [name]' with exit 2 for two arguments."
  - "VERIFIED: on this branch, npm run check exits 0 with 594 tests passing, and npm run ci (tsc then node --test with coverage) runs the same type check and tests (2026-10-13). An earlier head failed repository test fixture-env.test.ts because the spawned-process tests did not pass env: cleanGitEnv; the full suite caught it, and a run of only greet.test.ts had not."
  - "UNKNOWN: whether the owner wants the tests in Vitest. The issue text says \"uses VI test\"; the scaffold uses node:test, which every other test here uses, and Vitest would add a dependency and a second runner."
---

Delivers GitHub issue #1: scaffold a basic TypeScript template with a very simple CLI, tests
with type checking, and a CI script that type-checks and runs the tests.

## Problem

A newcomer starting a new script application here has no minimal, working example to copy. The
existing scripts are governance guards, which mix the CLI shape with their own logic.

## Desired outcome

A tiny CLI under `scripts/app/` that follows the repository's `main`/`isEntryPoint` convention
from `scripts/lib/cli.ts`, has a sibling `node:test` test, type-checks, and is runnable with
`node scripts/app/greet.ts`; `--help` prints usage. A single `npm run ci` command runs the type
check and the tests, the two steps that `npm run check` (which the `check` workflow runs) also
includes. It is not the workflow's own command, and `npm ci` is a different, built-in npm command.

## Next step

Owner reviews and merges the pull request. The work is done only when the owner merges.

## Observations

- The CLI reuses `scripts/lib/cli.ts`; the only uncovered function is the entry-point lambda,
  which in-process tests cannot reach, as with every other script here.
- [no-doc-change: the template is an example that adds no rule, guard or workflow step; the
  change-record reference and runbooks are unaffected]
