---
type: reference
title: Merge gate contract
summary: "The merge gate is GitHub: the protect-main ruleset, the required check and guards workflows, the local backstops, and the read-only landing audit."
tags: [area/git, area/github, kind/convention]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Land a change]]", "[[ADR-0008 Owner merges pull requests on GitHub]]"]
---

The merge gate is GitHub: every change lands as a pull request that only the owner merges.
Local hooks and Claude Code settings refuse mistakes early but are bypassable; the ruleset
enforces.

## Ruleset `protect-main` (default branch)

| Rule | Setting |
|---|---|
| Pull request required | Yes, with 0 approving reviews required (the owner's merge is the approval) |
| Required status checks | `check` and `guards` |
| Merge methods | Merge commit and squash; rebase merging is off so the audit can match each commit to its PR |
| Force-push, deletion | Blocked |
| Bypass actors | None |

## Required checks

| Check | Workflow | What it runs |
|---|---|---|
| `check` | `.github/workflows/check.yml`, on `pull_request` and pushes to main | The branch's own `npm run check`, with a read-only token. |
| `guards` | `.github/workflows/guards.yml`, on `pull_request_target` | Main's copy of `wiki-lint`, `skill-lint`, `governance-guard`, `wiki-compliance`, `changelog-guard` and `repo-memory-guard`, run against the PR's merge ref checked out as data. |

A pull request cannot weaken `guards`: the workflow and scripts come from main, dependencies
install with `--ignore-scripts`, the token is read-only, and no PR code executes. For
`dependabot[bot]` pull requests both workflows skip only the two change-record guards. If
`guards` fails at once with "couldn't find remote ref", GitHub had not built the merge ref
yet: re-run it.

## Local backstops

| Backstop | Refuses |
|---|---|
| `.githooks/pre-commit` (`branch-guard.ts commit`, `wiki-compliance.ts --staged`) | Commits on main or a detached HEAD, and a staged mix of wiki and other files |
| `.githooks/pre-push` (`branch-guard.ts push`) | Pushes to main, rewrites of a published branch, deletion of a branch not contained in `origin/main`; then runs `npm run check` |
| `.claude/settings.json` deny rules | `git push origin main`, force pushes, `gh pr merge`, and the REST merge endpoint |
| `scripts/claude/block-pr-merge.ts` (PreToolUse hook) | Bash commands that merge a PR in other spellings: `gh pr merge` behind wrappers or flags, a PUT to `pulls/<n>/merge` through `gh api`, `curl` or `wget`, the GraphQL merge and auto-merge mutations |

The hook is a heuristic, not a sandbox; the owner's review is the control.

## Commands

- `npm run pr` (`scripts/git/pr-ready.ts`) refuses unless the branch is a named feature
  branch, clean, contains `origin/main`, has commits of its own and passes `npm run check`.
  It then checks `gh auth status`, pushes the branch and opens or reports its pull request. It
  never merges. `--dry-run` stops before pushing.
- `npm run audit` (`scripts/git/landing-audit.ts`) is read-only. After `git fetch origin`, it
  walks main's first-parent history after the `since` commit in `config/landing-audit.json`,
  and asks GitHub whether each commit's PR (from its merge or squash subject) merged as that
  exact commit. Anything else is reported; a `gh` failure is an error, never a verdict.

Only the owner merges. Agents prepare, check, push the branch and open the pull request.

Ported from Zimi `wiki/reference/Merge gate contract.md` at 9fb36b2. Zimi's gate was a local
script that merged and pushed main itself; the owner replaced it on 2026-10-09 with pull
requests only the owner merges.
