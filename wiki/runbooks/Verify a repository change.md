---
type: runbook
title: Verify a repository change
summary: Run npm run check and the hooks, commit, review the pinned commit read-only in separate reviewer subagents, and record evidence before handing the branch to the owner.
tags: [area/git, area/agents, area/typescript, tool/ecc]
created: 2026-09-20
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[Land a change]]", "[[Change records]]", "[[ADR-0022 Independent review means a separate reviewer context]]"]
---

## When to use

After every meaningful code, tooling, configuration or documentation slice. Steps 1 to 4 run
before committing; the review in step 6 runs on the pinned commit, before the branch is reported
ready for the owner.

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

1. Take the acceptance criteria stated at task entry (`.claude/rules/zeem/design-principles.md`,
   "Before writing") from the request or approved ticket. Build test-first (ECC testing rule):
   write the failing test, then the code.
2. Update affected guidance and the owning work record, and add a `CHANGELOG.md` entry. See
   [[Change records]].
3. Run `npm run check`. Its parts run in order and stop at the first failure:

   | Part | What it proves |
   |---|---|
   | `npm run lint` | Type-aware ESLint over `scripts/**/*.ts` and `eslint.config.ts`: no `any`, casts, non-null assertions, ts-comment suppressions or floating promises; the ECC size and nesting limits (`eslint.config.ts`). |
   | `npm run typecheck` | `tsc` with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. |
   | `npm test` | `node:test` over `scripts/**/*.test.ts` with the coverage thresholds set in `package.json`. A test also fails if any script lacks a sibling `.test.ts`, since coverage cannot see an untested file. |
   | `npm run evals:test` | The compliance-eval wrapper (`evals/compliance/run_comply.py`) confines every process a compliance run starts (bubblewrap allowlist, Anthropic-only network); standard-library `unittest`, no model calls. |
   | `npm run wiki:lint` | Note schema, links, tags, agents, evidence labels, and a redaction sweep over every tracked file. |
   | `npm run skills:lint` | Skill structure and provenance; see [[Skill standards]]. |
   | `npm run governance:check` | No text, code or config file asserts a replaced rule. |
   | `npm run rules:check` | The vendored ECC rules match `config/ecc-rules.json` and the plugin pin, and the sets that load match its `loaded` list ([[Context loading]]). |
   | `npm run wiki:compliance` | No commit mixes `wiki/` with other files; wiki-only commits start `docs(wiki): `. |
   | `npm run changelog:guard` | The branch has a dated `CHANGELOG.md` entry. |
   | `npm run memory:guard` | The branch updates a work record with evidence, and an operating document when workflow-critical files change. |

4. Confirm each checker still fails when it should. `wiki:lint`, `skills:lint` and
   `governance:check` each run in their tests against a valid and a broken fixture under
   `scripts/fixtures/valid/` and `scripts/fixtures/broken/`. A new checker gets the same pair;
   a checker that never sees a counterexample proves nothing
   ([[Documentation checkers need counterexamples]]).
   To add or change a checker, follow the `write-guard` skill
   (`.claude/skills/write-guard/SKILL.md`).
5. Stage only intended files, keeping wiki files in their own `docs(wiki): ` commit, and commit.
   The git hooks refuse what [[Merge gate contract]] lists.
6. Review the committed head SHA in a separate context, as
   [[ADR-0022 Independent review means a separate reviewer context]] defines it. Use the ECC
   reviewers (`ecc:code-reviewer`, `ecc:typescript-reviewer` for TypeScript, and
   `ecc:security-reviewer` for hooks, git, file system or credential code), and the repository's
   `.claude/agents/verifier.md` (read-only, one verdict per acceptance criterion) and
   `.claude/agents/finder.md` (findings on pinned base and head SHAs). A changed head needs a
   new review.
7. Fix findings on the branch, rerun `npm run check`, and record the reviewed SHA, the commands
   and their results, and each criterion's verdict in the work record as labelled evidence.
   Pre-push reruns `npm run check`, except for the commit `npm run pr` has just checked.

## Verify

- `npm run check` exits 0 on the commit you are about to push.
- On the pull request, both required checks pass: `check` runs the branch's own
  `npm run check`, and `guards` runs main's copy of the guards against the change.
- Hooks check the working tree, not an isolated copy of the staged files, so inspect the staged
  diff when a file is partly staged. A commit that passed a hook is not proof of review.
- Automated checks do not establish owner approval or the truth of an evidence line. A
  requested behaviour with no test or inspectable observation stays unverified.
