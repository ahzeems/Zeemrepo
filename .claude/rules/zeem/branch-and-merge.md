# Branch and merge

How work reaches `main`. Decisions: `wiki/decisions/ADR-0025 Agents use a machine account and the owner approves.md` and
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
- A piece of work, however many phases, issues or tickets it holds, lives on one integration branch
  (`work/<topic>`) from current `main`. It is updated until the work is complete, and only then does it
  get its pull request (OWNER DECISION, 2026-10-19). Do not open a branch or a pull request per phase,
  issue or ticket.
- One writer per checkout. A parallel agent or terminal works in its own worktree under `.worktrees/` on a
  local branch (`work/<topic>--<name>`) from the integration branch, and merges it back into the
  integration branch locally; only the integration branch is pushed. Run `npm run worktree:guard`
  before removing a worktree.
- Keep the integration branch current by merging `main` into it: it is shared, and ECC's
  `git-workflow` skill never rebases a branch others have pushed or pulled. A local branch only you
  use may be rebased onto the integration branch. Never rewrite `main`.
- Stage files by name. Never `git add -A` or `git add .` from a tree you have not fully inspected.
- Never discard, absorb or clean up another session's uncommitted work or worktree. Without asking, you may
  delete only your own branch once its PR is merged into `origin/main`, and remove your own clean worktree
  after `npm run worktree:guard` passes; anything else needs the owner (`owner-authority.md`).
- Do not work as root. Inspect `git config --get core.hooksPath` before `npm run hooks:install`.
- Regenerate a generated file (such as `package-lock.json`) from its source; never hand-merge it.

## How ECC's workflow applies here

ECC wins where this file and ECC disagree (`CLAUDE.md`). These notes say how its steps meet this
repository's tools:

- **Push and PR.** ECC's "Commit & Push" step is `npm run pr`, which runs the checks, pushes the branch
  and opens the pull request. Pushing means pushing your branch, never `main`.
- **Commit subjects.** ECC's `<type>: <description>` format applies, and scopes are allowed. Wiki-only commits
  use `docs(wiki): ...` and contain only wiki files. A merge of `main` may resolve conflicts in wiki and
  other files together by keeping lines from the two sides, and nothing else (OWNER DECISION,
  2026-10-09); a line written during the merge goes in its own commit afterwards.
- **Attribution.** ECC notes that its installs turn commit co-author trailers off. This repository keeps the
  attribution trailers that Claude Code adds to commits and PR bodies.
- **Approval.** Reviews give ECC's code-review verdicts (Approve, Warning, Block). A review verdict is not
  a GitHub approval: on GitHub, only the owner approves and merges.
