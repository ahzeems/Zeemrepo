---
type: runbook
title: Land a change
summary: Take work from a feature branch to an owner-merged pull request; nothing is ever pushed to main.
tags: [area/git, area/github, kind/convention]
created: 2026-10-09
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Change records]]"]
---

## When to use

Every change to this repository. Nothing is pushed to `main`, and only the owner merges pull
requests on GitHub (owner decision, 2026-10-09).

## Prerequisites

- Node from `.nvmrc`, `npm ci` done, `gh auth status` logged in as the machine account (never the owner).
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
6. Wait for both required checks. `check` runs the change's own `npm run check`. `guards`
   runs main's copy of the repository guards on `pull_request_target`, so the pull request
   can neither edit that workflow nor run its own code in it (it does read the PR's `config/`;
   see [[Merge gate contract]]). If `guards` fails right after
   the PR opens with "couldn't find remote ref", GitHub had not built the merge ref yet:
   re-run it. A PR that conflicts with main has no merge ref at all; merge main in first.
7. The owner reviews, approves and merges on GitHub: **Files changed**, **Review changes**,
   **Approve**, then **Merge pull request** (merge commit or squash; rebase merging is off so
   the landing audit can match each commit to its PR). Agents push and open the pull request as
   the machine account, which cannot approve it, so it cannot merge until the owner approves
   ([[ADR-0025 Agents use a machine account and the owner approves]]). Agents never merge or
   approve; a Claude Code hook also refuses commands that would.
8. After the merge: `git switch main && git pull --ff-only`, then delete your own merged
   branch and, once `npm run worktree:guard` passes, your own clean worktree. Deleting anything
   else needs the owner's go-ahead.

## Verify

- `gh pr view <n> --json state,mergedBy` shows `MERGED` by the owner.
- `npm run audit` (after `git fetch origin`) reports every commit on main since the PR-only
  rule as a merged pull request.
- The pre-push hook refuses `git push origin main`; the GitHub ruleset refuses it too.
- Dependabot opens weekly pull requests for the pinned GitHub Actions and all npm
  dependencies (development ones grouped). A bot cannot write a
  changelog entry or work record, so for pull requests GitHub reports as authored by
  `dependabot[bot]` the change-record guards are skipped; every other check still applies and
  the owner still reviews and merges. TypeScript minor and major updates and `@types/node` major
  updates are not proposed (`.github/dependabot.yml`): `typescript-eslint` must support a
  TypeScript release first, and the Node types follow `.nvmrc`. Upgrade those on a branch of their own.
