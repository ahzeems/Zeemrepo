---
name: manage-branch
description: "Manage branch lifecycle: clean published start, main updates, traced merges, and post-merge closure."
---

Every edit happens on a published feature branch. Record the checkout, branch, base SHA, and existing changes in the task. This skill is how to name and run a branch deliberately.

## Start

Inspect `git status --short`, `git worktree list --porcelain`, and the remote first. From a clean checkout:

```bash
git fetch origin
git switch -c feat/<short-description> origin/main
git push -u origin feat/<short-description>
```

Use the conventional-commit type as the prefix (`feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`).

For concurrent work use a worktree under the checkout's canonical `.worktrees/` directory:

```bash
git worktree add -b feat/<short-description> .worktrees/<session> origin/main
```

Publish that branch from its selected checkout.

Never restart setup in a dirty mid-session checkout, and never discard or absorb another
session's work. Run branch setup alone, not in parallel with a change.

## Keep it current

When `main` moves under an active branch, merge it in (this repository merges; it does not rebase
published history). If the merge stops on conflicts, load [resolve-conflicts](../resolve-conflicts/SKILL.md): it resolves each
hunk from both sides' intent, not by taking whichever side is longer.

Resolve, run `npm run check`, then commit the merge.

## Commit and push

Conventional commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Stage explicitly;
`git add -A` from a dirty tree is how unrelated work joins a PR. Never commit or push to `main`, and never rewrite published history. Run `npm run check` on the exact tree you are pushing.

## Open the pull request

`npm run pr` refuses on main or a detached HEAD, a dirty tree, or a branch that lacks `origin/main`
or its own commits; then it runs `npm run check`, checks that `gh` is logged in, pushes the
branch, and opens the PR (title and body from the commits) or reports the one already open. Then
set the title and body:

```bash
npm run pr
gh pr edit <n> --title "<type>(<scope>): <summary>" --body-file <file>
```

Run [branch-review](../branch-review/SKILL.md) and [verify-work](../verify-work/SKILL.md) on the committed head before handoff, in a separate session or subagent; if the builder reviews
its own work, say in the PR body that it is a self-review. The body says
what changed, why, and how it was verified: the same evidence a reviewer would otherwise have to
reconstruct.

## Close it

The owner merges the pull request on GitHub. Confirm what landed:

```bash
gh pr view <n> --json state,mergeCommit
git fetch origin
```

The state must be `MERGED` with a merge commit on `origin/main`. Until then the branch has not landed.

After confirming the branch landed, remove only this session's clean
inactive worktree, fast-forward an available main checkout, and delete the landed branches.
Inspect the result with `git status --short`, `git branch -a`, and
`git worktree list --porcelain`. Do not force cleanup when ancestry, ownership, or state is unclear.

## What this skill never does

It never merges to `main`, by hand or on GitHub: merging is the owner's act. It never approves
a pull request, never force-pushes, and never deletes a branch that has not landed.
