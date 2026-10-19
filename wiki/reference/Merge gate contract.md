---
type: reference
title: Merge gate contract
summary: "The merge gate is GitHub: the protect-main ruleset, the required check and guards workflows, the local backstops, and the read-only landing audit."
tags: [area/git, area/github, kind/convention]
created: 2026-09-20
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[Land a change]]", "[[ADR-0025 Agents use a machine account and the owner approves]]"]
---

The merge gate is GitHub: every change lands as a pull request that only the owner approves and
merges ([[ADR-0025 Agents use a machine account and the owner approves]]). Agents push branches
and open pull requests as the machine account `zimmybot`, which has write access and cannot
approve the pull requests it authors. The ruleset requires one approving review from a code
owner, and `.github/CODEOWNERS` names the owner alone, so only the owner's approval counts. No
credential for the owner's account is on the machine agents use: `gh` is logged in as the
machine account only, and the owner's account has no SSH key registered (both checked
2026-10-10; re-check with `gh auth status` and `gh api users/<owner>/keys`). `npm run pr`
refuses to run when `gh` is logged in as the repository owner. The Claude Code deny rules and
hook below remain as defence in depth.

## Ruleset `protect-main` (default branch)

| Rule | Setting |
|---|---|
| Pull request required | Yes, with 1 approving review; stale approvals are dismissed on new commits, and the most recent push must be approved, by a code owner (`.github/CODEOWNERS`: the owner). The rule also has `require_extra_approval_for_unattributed_changes: true` (read with `gh api repos/<owner>/<repo>/rulesets/<id>` on 2026-10-10 and 2026-10-11) |
| Required status checks | `check` and `guards` |
| Merge methods | Merge commit and squash; rebase merging is off so the audit can match each commit to its PR |
| Force-push, deletion | Blocked |
| Bypass actors | None (read with the owner's token before the machine-account switch, and confirmed by the owner on 2026-10-10; the machine account cannot see the list) |

## Required checks

| Check | Workflow | What it runs |
|---|---|---|
| `check` | `.github/workflows/check.yml`, on `pull_request` and pushes to main | The branch's own `npm run check`, with a read-only token. |
| `guards` | `.github/workflows/guards.yml`, on `pull_request_target` | Main's copy of `wiki-lint`, `skill-lint`, `governance-guard`, `ecc-rules` (`rules:check`), `wiki-compliance`, `changelog-guard` and `repo-memory-guard`, run against the PR's merge ref checked out as data. |

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
| `.githooks/pre-merge-commit` (`branch-guard.ts commit`) | A merge commit on main or a detached HEAD; `git merge` runs this hook instead of pre-commit. A fast-forward makes no commit and runs neither, so `git pull --ff-only` on main still works |
| `.githooks/pre-push` (`branch-guard.ts push`) | Pushes to main and deletion of a branch not contained in `origin/main` (a rewrite of another branch is allowed, for ECC's `--force-with-lease` workflow, owner decision 2026-10-19); then runs `npm run check` and refuses if the check changed HEAD, the branch, `core.bare`, local or per-worktree git config, refs, the index or the working tree (`git-state.ts`) |
| `.claude/settings.json` deny rules | `git push origin main`, plain force pushes (`--force`, `-f`; `--force-with-lease` is allowed), `gh pr merge`, any `gh pr review` (agents post findings as comments, owner decision 2026-10-19) and `gh api -X PUT` to the REST merge endpoint, each matched against the command text as written: an exact command, a prefix (`:*`), or for the REST endpoint a `*` wildcard for the PR number (so `gh pr review 12 --approve` and `gh api --method PUT` pass them; the hook below catches those). `scripts/git/hooks.test.ts` refuses a rule that mixes a `*` with the trailing `:*` form, which Claude Code reads as a literal prefix that never matches |
| `scripts/claude/block-pr-merge.ts` (PreToolUse hook) | Bash commands that push to main in the common refspec forms (`HEAD:main`, `+x:main`, `refs/heads/main`, `:main`, `--all`, `--mirror`, after `-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, quoted or not; not a destination built from a variable), and that merge or approve a PR in other spellings: `gh pr merge` behind wrappers or flags, a PUT to `pulls/<n>/merge` through `gh api`, `curl` or `wget`, the GraphQL merge and auto-merge mutations, `gh pr review --approve`, and an `APPROVE` review through the REST or GraphQL API. It joins backslash-newline continuations as bash does (with nothing between, and not inside a heredoc with a quoted delimiter; it also joins a backslash before CRLF, which bash does not, so it refuses more than bash would run), drops backslash escapes outside quotes (`gh pr me\rge`), and reads as commands a heredoc or here-string a shell reads (`bash`, `sh`, `zsh`, `dash` or `ksh`, also after `NAME=value` words or behind the wrappers the hook already knows, such as `sudo -u root`, `env FOO=1`, `nice -n 5` or `timeout 5`), what `echo` or `printf` pipes into one, and both bodies of a line with two heredocs. It does not follow process substitution, decoded input (`base64 -d \| bash`), other interpreters or a script written first and run later |

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
- `npm run audit` (`scripts/git/landing-audit.ts`) fetches origin's main itself, so a stale
  local ref cannot hide a direct push, and changes nothing else; a failed fetch is an error. It
  walks main's first-parent history after the `since` commit in `config/landing-audit.json`,
  and asks GitHub whether each commit's PR (from its merge or squash subject) merged as that
  exact commit. Anything else is reported; a `gh` failure is an error, never a verdict.

Only the owner merges. Agents prepare, check, push the branch and open the pull request.
