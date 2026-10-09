---
name: manage-branch
description: "Manage branch lifecycle: clean published start, main updates, traced merges, and post-merge closure."
---

Every edit happens on a published feature branch. Record the checkout, branch, base SHA, and existing changes in the task. This skill is how to name and run a branch deliberately.

## Start

Inspect `git status --short`, `git worktree list --porcelain`, and the remote first. From a clean checkout:

```bash
git fetch origin
git switch -c codex/<short-description> origin/main
git push -u origin codex/<short-description>
```

For concurrent work use a worktree under the checkout's canonical `.worktrees/` directory:

```bash
git worktree add -b codex/<short-description> .worktrees/<session> origin/main
```

Publish that branch from its selected checkout. Inspect core.hooksPath before installing the local hooks with `npm run hooks:install`.

Never restart setup in a dirty mid-session checkout, and never discard or absorb another
session's work. Run branch setup alone, not in parallel with a change.

For a controlled edit-capable run, the coordinator creates or revalidates the worktree before
the editing client starts. Create admission publishes the exact feature branch; retry requires
the controller's matching admission record and rechecks the execution HEAD, current-main
ancestry, pinned remote identity, and tracking branch. If create records a valid worktree but
publication or later
verification fails, an exact unchanged retry may finish publication; an unrecorded path is never
adopted. Create requires the remote ref to remain absent through an atomic create-only push.
The empty-ref lease may create that absent ref; it never authorizes updating or rewriting one.
Admission accepts exactly one pinned fetch URL and one pinned push URL, and rechecks them before
publication and launch. It requires a real, non-symlink `.worktrees` root and refuses inherited
Git configuration overrides before running Git. An admission or setup failure ends that run; never fall back to
`main`, the canonical checkout, or another client. The shared admission action currently proves
this create/retry decision only with fake launchers. It does not prove that OpenCode, Claude Code
or Codex confines a real editing process.

## Keep it current

When `main` moves under an active branch, merge it in (this repository merges; it does not rebase
published history). If the merge stops on conflicts, load `resolve-conflicts`: it resolves each
hunk from both sides' intent, not by taking whichever side is longer.

```bash
node scripts/branch-guard.ts commit     # the edit gate while a merge is in progress
```

Resolve, run `npm run check`, then commit the merge.

## Commit and push

Conventional commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Stage explicitly;
`git add -A` from a dirty tree is how unrelated work joins a PR. The local hooks reject main commits/pushes and published-history rewrites. Run `npm run check` on the exact tree you are pushing; `npm run gate` reruns it on the merge result and records the evidence.

## Open the pull request

```bash
gh pr create --base main --head <feature-branch> --title "<type>(<scope>): <summary>" --body-file <file>
```

Run branch-review and verify-work on the committed head before handoff. The body says
what changed, why, and how it was verified — the same evidence a reviewer would otherwise have to
reconstruct.

## Close it

Land with `npm run gate`. It verifies the merge result, refuses a Blocker finding, records
evidence bound to the landed tree, and pushes `main` itself, so there is no pull request to
inspect afterwards. Confirm what landed:

```bash
git fetch origin && git fetch origin refs/notes/checks:refs/notes/checks && npm run audit
```

Before branch cleanup, confirm the landed tree contains the changelog entry, reviewed work
state, and evidence prepared on the feature branch. Follow the wiki runbook
[Maintain the repository wiki](../../../wiki/runbooks/Maintain%20the%20repository%20wiki.md).
ADR-0007 removes routine closeout PRs: do not rewrite the changelog with facts that only exist
after landing. If a record was missed, treat that as a documentation defect; its repair follows
the same changelog, work-record, review, and gate requirements as any other change.

After confirming the branch landed, remove only this session's clean
inactive worktree, fast-forward an available main checkout, and delete the landed branches.
Inspect the result with `git status --short`, `git branch -a`, and
`git worktree list --porcelain`. Do not force cleanup when ancestry, ownership, or state is unclear.

## What this skill never does

It never merges to `main` by hand: landing is the gate's act, and local guards report rather
than enforce. It never force-pushes and never deletes a branch that has not landed.
