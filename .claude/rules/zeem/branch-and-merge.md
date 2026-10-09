# Branch and merge

How work reaches `main`. Decisions: `wiki/decisions/ADR-0008 Owner merges pull requests on GitHub.md` and
`wiki/decisions/ADR-0021 Authority comes from an identified checkout.md`. Steps: `wiki/runbooks/Land a change.md`.

## Landing (OWNER DECISION, 2026-10-09)

- Never push to `main`, never merge a pull request, never approve one. Every change lands by a GitHub pull
  request that only the owner merges. A GitHub ruleset, a pre-push hook, `.claude/settings.json` deny rules
  and `scripts/claude/block-pr-merge.ts` back this up; none of them is a reason to probe for gaps.
- Finish with `npm run pr`: it refuses unless the branch contains `origin/main`, runs `npm run check`,
  pushes the branch and opens or updates the PR. Report the branch as ready for the owner's review, never
  as approved.
- Reviews report findings; they never approve or merge.

## Branches and checkouts

- Before acting, identify the checkout: path, worktree, branch, `HEAD`, and whether the tree is clean.
- Start each piece of work on a fresh branch from current `main`. One writer per checkout; a parallel session
  gets its own worktree under `.worktrees/`. Run `npm run worktree:guard` before removing one.
- Keep a published branch current by merging `main` into it. Never rebase or force-push published history.
- Stage files by name. Never `git add -A` or `git add .` from a tree you have not fully inspected.
- Never discard, absorb or clean up another session's uncommitted work or worktree. Without asking, you may
  delete only your own branch once its PR is merged into `origin/main`, and remove your own clean worktree
  after `npm run worktree:guard` passes; anything else needs the owner (`owner-authority.md`).
- Do not work as root. Inspect `git config --get core.hooksPath` before `npm run hooks:install`.
- Regenerate a generated file (such as `package-lock.json`) from its source; never hand-merge it.

## Overrides of ECC

These win over the vendored ECC rules and skills where they disagree:

- **Push and PR.** ECC's development workflow goes "Commit & Push", then pre-review checks. Here the
  last step is `npm run pr`, which runs the checks before pushing, and the owner merges. Pushing means pushing your branch, never `main`.
- **Rebase and force-push.** ECC's `git-workflow` skill updates a branch with
  `git rebase origin/main` and then `--force-with-lease`. Do not do that to a branch that has been pushed; merge
  `main` into it instead.
- **Commit subjects.** ECC's `<type>: <description>` format applies, and scopes are allowed. Wiki-only commits
  use `docs(wiki): ...` and contain only wiki files. A merge of `main` may resolve conflicts in wiki and
  other files together by keeping lines from the two sides, and nothing else (OWNER DECISION,
  2026-10-09); a line written during the merge goes in its own commit afterwards.
- **Attribution.** ECC notes that its installs turn commit co-author trailers off. This repository keeps the
  attribution trailers that Claude Code adds to commits and PR bodies.
- **Approval.** ECC's code-review rule says "Approve" when no CRITICAL or HIGH issue remains. Here that
  verdict means "ready for the owner", and no agent records an approval.
