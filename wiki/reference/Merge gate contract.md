---
type: reference
title: Merge gate contract
summary: "The merge gate is GitHub: the protect-main ruleset, the required check and guards workflows, the local backstops, and the read-only landing audit."
tags: [area/git, area/github, kind/convention]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Land a change]]", "[[ADR-0025 Agents use a machine account and the owner approves]]"]
---

The merge gate is GitHub: every change lands as a pull request that only the owner approves and
merges ([[ADR-0025 Agents use a machine account and the owner approves]]). Agents push branches
and open pull requests as the machine account `zimmybot`, which has write access and cannot
approve the pull requests it authors. The ruleset requires one approving review, and
`npm run pr` refuses to run when `gh` is logged in as the repository owner. Two further
conditions make the owner's approval the only one that counts; both are owner steps, pending
until done: code-owner review on in the ruleset (`.github/CODEOWNERS` names the owner alone), and
no SSH key registered to the owner's account on the machine agents use. Until then, an approval
from any account with write access still counts. The Claude Code deny rules and hook below remain as defence in depth.

## Ruleset `protect-main` (default branch)

| Rule | Setting |
|---|---|
| Pull request required | Yes, with 1 approving review; stale approvals are dismissed on new commits, and the most recent push must be approved. Code-owner review (`.github/CODEOWNERS`: the owner) is to be turned on by the owner |
| Required status checks | `check` and `guards` |
| Merge methods | Merge commit and squash; rebase merging is off so the audit can match each commit to its PR |
| Force-push, deletion | Blocked |
| Bypass actors | None (read with the owner's token before the machine-account switch; the owner reconfirms it, since the machine account cannot see it) |

## Required checks

| Check | Workflow | What it runs |
|---|---|---|
| `check` | `.github/workflows/check.yml`, on `pull_request` and pushes to main | The branch's own `npm run check`, with a read-only token. |
| `guards` | `.github/workflows/guards.yml`, on `pull_request_target` | Main's copy of `wiki-lint`, `skill-lint`, `governance-guard`, `wiki-compliance`, `changelog-guard` and `repo-memory-guard`, run against the PR's merge ref checked out as data. |

A pull request cannot change how `guards` runs: the workflow and scripts come from main,
dependencies install with `--ignore-scripts`, the token is read-only, and no PR code executes.
The guards do read the PR's own configuration (`config/`, the note schema's allowlists), so a
PR that loosens an exclusion or drops a stale claim is judged by its loosened config. Those
files are workflow-critical, and the owner's review is what catches such a change. For
`dependabot[bot]` pull requests both workflows skip only the two change-record guards: `check`
runs `npm run check:base`, which is `npm run check` without them, so the list lives once in
`package.json`. If `guards` fails at once with "couldn't find remote ref", GitHub had not
built the merge ref yet: re-run it.

## Local backstops

| Backstop | Refuses |
|---|---|
| `.githooks/pre-commit` (`branch-guard.ts commit`, `wiki-compliance.ts --staged`, then lint, typecheck, `wiki:lint` and `skills:lint`) | Commits on main or a detached HEAD, a staged mix of wiki and other files, and a tree that fails those checks. It does not run the tests: `npm run check` before committing does, and pre-push runs it. |
| `.githooks/pre-push` (`branch-guard.ts push`) | Pushes to main, rewrites of a published branch, deletion of a branch not contained in `origin/main`; then runs `npm run check` and refuses if the check changed HEAD, the branch, `core.bare`, local or per-worktree git config, refs, the index or the working tree (`git-state.ts`) |
| `.claude/settings.json` deny rules | `git push origin main`, force pushes, `gh pr merge`, `gh pr review --approve` and the REST merge endpoint, each matched as a command prefix (so `gh pr review 12 --approve` passes them; the hook below catches it) |
| `scripts/claude/block-pr-merge.ts` (PreToolUse hook) | Bash commands that push to main in the common refspec forms (`HEAD:main`, `+x:main`, `refs/heads/main`, `:main`, `--all`, `--mirror`, after `-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, quoted or not; not a destination built from a variable), and that merge or approve a PR in other spellings: `gh pr merge` behind wrappers or flags, a PUT to `pulls/<n>/merge` through `gh api`, `curl` or `wget`, the GraphQL merge and auto-merge mutations, `gh pr review --approve`, and an `APPROVE` review through the REST or GraphQL API |

The hook is a heuristic, not a sandbox; the `protect-main` ruleset (no bypass actors) and the
owner's review are the control. `npm run audit` asks `gh` with a 60-second timeout, so a hung `gh`
is an error, not a stall. Pre-push skips its `npm run check` when `PR_READY_CHECKED` names the
commit being pushed, which `npm run pr` sets after running the check itself; anyone can set it, so
CI is what enforces the check. ECC's own plugin hooks also run in this repository (the hook
profile is set in the owner's user settings, not here): GateGuard asks for facts before a first edit or command and before destructive commands,
and config-protection refuses agent edits to `eslint.config.ts`, so the owner makes an edit there
that `change-records.md` requires (GateGuard observed in agent sessions on 2026-10-10;
config-protection read from the plugin's `scripts/hooks/config-protection.js`, v2.2.3).

## Commands

- `npm run pr` (`scripts/git/pr-ready.ts`) refuses unless the branch is a named feature
  branch, clean, contains `origin/main`, has commits of its own and passes `npm run check`.
  It then checks `gh auth status`, refuses if `gh` is logged in as the repository owner, pushes the branch and opens or reports its pull request. It
  never merges. `--dry-run` stops before pushing.
- `npm run audit` (`scripts/git/landing-audit.ts`) is read-only. After `git fetch origin`, it
  walks main's first-parent history after the `since` commit in `config/landing-audit.json`,
  and asks GitHub whether each commit's PR (from its merge or squash subject) merged as that
  exact commit. Anything else is reported; a `gh` failure is an error, never a verdict.

Only the owner merges. Agents prepare, check, push the branch and open the pull request.
