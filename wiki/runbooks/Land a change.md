---
type: runbook
title: Land a change
summary: Take work from a feature branch to an owner-merged pull request; nothing is ever pushed to main.
tags: [area/git, area/github, kind/convention]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Change records]]"]
---

## When to use

Every change to this repository. Nothing is pushed to `main`, and only the owner merges pull
requests on GitHub (owner decision, 2026-10-09).

## Prerequisites

- Node from `.nvmrc`, `npm ci` done, `gh auth status` logged in.
- Hooks installed once per checkout: inspect `git config --get core.hooksPath` first, then
  `npm run hooks:install`.

## Steps

1. Branch from current main: `git switch main && git pull --ff-only && git switch -c feat/<topic>`.
   For parallel sessions, use a worktree under `.worktrees/` instead.
2. Work test-first. Commit with conventional subjects. Wiki files go in their own
   `docs(wiki): ` commits. The pre-commit hook refuses commits on main and mixed wiki staging,
   and runs lint, types, wiki:lint and skills:lint.
3. Record the change: a `CHANGELOG.md` entry, the owning work record under `wiki/work/`
   (status or next action, plus `VERIFIED:` evidence), and an operating document when
   workflow-critical files change. See [[Change records]].
4. If main moved, merge it in: `git fetch origin && git merge origin/main`. Never rebase or
   force-push a published branch.
5. Run `npm run pr`. It refuses unless the tree is clean, the branch contains `origin/main`
   and `npm run check` passes; then it pushes the branch and opens or reports the pull
   request. It never merges. `npm run pr -- --dry-run` checks without pushing.
6. Wait for the `check` workflow. It runs the change's lint, types and tests, and the
   repository guards from main's copy, so a branch cannot weaken the guards that judge it.
7. The owner reviews and merges on GitHub. Agents never merge or approve.
8. After the merge: `git switch main && git pull --ff-only`, then delete the branch. Before
   removing a worktree, run `npm run worktree:guard`.

## Verify

- `gh pr view <n> --json state,mergedBy` shows `MERGED` by the owner.
- `npm run audit` (after `git fetch origin`) reports every commit on main since the PR-only
  rule as a merged pull request.
- The pre-push hook refuses `git push origin main`; the GitHub ruleset refuses it too.
