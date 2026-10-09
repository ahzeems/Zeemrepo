---
type: runbook
title: Verify a repository change
summary: Run npm run check and the hooks, review read-only with separate reviewer subagents, and record evidence before opening a pull request.
tags: [area/git, area/agents, area/typescript, tool/ecc]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Land a change]]", "[[Change records]]", "[[ADR-0022 Independent review means a separate reviewer context]]"]
---

## When to use

After every meaningful code, tooling, configuration or documentation slice, and before
committing or opening a pull request.

## Prerequisites

- `npm ci` in the checkout root, with Node from `.nvmrc`.
- Hooks installed once per checkout. Inspect any existing hook path first, so a custom one is
  not silently replaced, then install:

  ```sh
  git config --get core.hooksPath
  npm run hooks:install
  ```

  `hooks:install` sets this checkout's `core.hooksPath` to `.githooks`. The hooks are early
  feedback, not enforcement: a clone without them is unguarded and `--no-verify` skips them.
  Enforcement is GitHub's required checks, described in [[Merge gate contract]].

## Steps

1. State the acceptance criteria from the request or approved ticket as observable results.
   Build test-first (ECC testing rule): write the failing test, then the code.
2. Update affected guidance and the owning work record, and add a `CHANGELOG.md` entry. See
   [[Change records]].
3. Run `npm run check`. Its parts run in order and stop at the first failure:

   | Part | What it proves |
   |---|---|
   | `npm run lint` | Type-aware ESLint over `scripts/**/*.ts`: no `any`, casts, non-null assertions, ts-comment suppressions or floating promises; the ECC size and nesting limits (`eslint.config.ts`). |
   | `npm run typecheck` | `tsc` with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. |
   | `npm test` | `node:test` over `scripts/**/*.test.ts` with the coverage thresholds set in `package.json`. A test also fails if any script lacks a sibling `.test.ts`, since coverage cannot see an untested file. |
   | `npm run wiki:lint` | Note schema, links, tags, agents, evidence labels, and a redaction sweep over every tracked file. |
   | `npm run skills:lint` | Skill structure and provenance; see [[Skill standards]]. |
   | `npm run governance:check` | No text, code or config file asserts a replaced rule. |
   | `npm run wiki:compliance` | No commit mixes `wiki/` with other files; wiki-only commits start `docs(wiki): `. |
   | `npm run changelog:guard` | The branch has a dated `CHANGELOG.md` entry. |
   | `npm run memory:guard` | The branch updates a work record with evidence, and an operating document when workflow-critical files change. |

4. Confirm each checker still fails when it should. `wiki:lint`, `skills:lint` and
   `governance:check` each run in their tests against a valid and a broken fixture under
   `scripts/fixtures/valid/` and `scripts/fixtures/broken/`. A new checker gets the same pair;
   a checker that never sees a counterexample proves nothing
   ([[Documentation checkers need counterexamples]]).
5. Review in a separate context, as
   [[ADR-0022 Independent review means a separate reviewer context]] defines it. Use the ECC
   reviewers (`ecc:code-reviewer`, `ecc:typescript-reviewer` for TypeScript, and
   `ecc:security-reviewer` for hooks, git, file system or credential code), and the repository's
   `.claude/agents/verifier.md` (read-only, one verdict per acceptance criterion) and
   `.claude/agents/finder.md` (findings on pinned base and head SHAs). A changed head needs a
   new review.
6. Fix findings, rerun `npm run check`, and record the reviewed SHA, the commands and their
   results, and each criterion's verdict in the work record as labelled evidence.
7. Stage only intended files, keeping wiki files in their own `docs(wiki): ` commit. The git
   hooks refuse what [[Merge gate contract]] lists, and pre-push reruns `npm run check`.

## Verify

- `npm run check` exits 0 on the commit you are about to push.
- On the pull request, both required checks pass: `check` runs the branch's own
  `npm run check`, and `guards` runs main's copy of the guards against the change.
- Hooks check the working tree, not an isolated copy of the staged files, so inspect the staged
  diff when a file is partly staged. A commit that passed a hook is not proof of review.
- Automated checks do not establish owner approval or the truth of an evidence line. A
  requested behaviour with no test or inspectable observation stays unverified.

Ported from Zimi `wiki/runbooks/Verify a repository change.md` at 9fb36b2. Rewritten for
Zeemrepo's checks, hooks, fixtures and reviewer subagents; landing is by pull request instead
of a local gate.
