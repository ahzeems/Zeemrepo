---
type: decision
title: ADR-0008 Owner merges pull requests on GitHub
summary: Nothing is pushed to main; every change lands by pull request, agents push a branch and open the PR, and only the owner merges on GitHub.
tags: [area/git, area/github, area/agents, kind/architecture]
created: 2026-10-09
updated: 2026-10-10
agent: claude-code
status: superseded
superseded_by: "[[ADR-0025 Agents use a machine account and the owner approves]]"
related: ["[[Land a change]]", "[[ADR-0022 Independent review means a separate reviewer context]]", "[[Merge gate contract]]"]
---

## Context

Zimi went through two landing models before this one.

First, Zimi's ADR-0006 (2026-09-20) made the owner the only one who merges, on GitHub, even
when a request to an agent says "merge". Agents isolated feature work, reviewed pinned commits,
resolved conflicts on the feature branch and handed over the PR. Local hooks rejected commits
and pushes on main, but nothing on the server enforced it.

Then Zimi's ADR-0008, "Agents merge through an audited gate", replaced it the same day. Agents
merged locally through a gate script that checked the merge result, recorded evidence in git
notes and pushed main itself. No pull request was opened and no server-side protection
existed; an audit could only detect a landing that skipped the gate, after the fact. The
evidence notes also did not travel with an ordinary fetch, so a fresh clone could not run the
audit at all.

On 2026-10-09, while migrating to Zeemrepo, the owner reversed that:

> I never want anything to be pushed to `main` directly. That should never happen. We should
> always go to a branch and work from that branch, and then have a pull request.

Neither Zimi ADR-0006 nor Zimi ADR-0008 was migrated. This note carries the rule forward.

## Decision

OWNER DECISION, 2026-10-09: nothing is pushed to `main`. Every change starts on a branch and
lands by a GitHub pull request, and only the owner merges it on GitHub. Agents never merge or
approve.

- **GitHub ruleset `protect-main`** on `main`, enforcement active: a pull request is required;
  the status checks `check` and `guards` must pass; force-push (non-fast-forward) and deletion
  are refused; the bypass list is empty; the allowed merge methods are merge and squash.
- **Agents** push their branch and open or update the PR with `npm run pr`
  (`scripts/git/pr-ready.ts`). It refuses a dirty tree, a branch that does not contain
  `origin/main`, or a failing `npm run check`, and it never merges.
- **Agent merge commands are blocked** in Claude Code: a PreToolUse hook
  (`scripts/claude/block-pr-merge.ts`) refuses Bash commands that would merge a pull request,
  and deny rules in `.claude/settings.json` refuse pushes to main, force-pushes and `gh pr merge`.
- **Detection**: `npm run audit` (`scripts/git/landing-audit.ts`) asks GitHub whether every
  commit on main's first-parent history since the PR-only rule began landed by a merged pull
  request, and flags any that did not.

Review is a pull request review (for example from `/ecc:review-pr` or a reviewer subagent, see
[[ADR-0022 Independent review means a separate reviewer context]]) plus the two required
checks. [[Land a change]] gives the steps.

## Consequences

Prevention now lives on the server, where an agent cannot skip it: a direct push to main is
refused by GitHub, not only by a local hook that `--no-verify` bypasses or that a fresh clone
lacks (`core.hooksPath` is per clone, so hooks run only after `npm run hooks:install`; `npm run pr`
warns when they are missing). The owner makes a
decision on every change again, which is the cost Zimi's ADR-0008 tried to remove; the owner
has chosen to pay it.

The Claude Code hook and deny rules are a backstop, not a sandbox. They match command text, so
a spelling they do not recognise can slip past; the ruleset and the owner's review are the
controls. The ruleset requires no approving review count, because the owner cannot approve
their own pull request; the owner's merge is the approval.

Rebase merging is off so the audit can match each main commit to its pull request by subject.
The audit needs network access and GitHub credentials, unlike Zimi's offline evidence audit.
Commits on main from before the PR-only rule are outside its window.

Built from Zimi `wiki/decisions/ADR-0006 Owner merges pull requests on GitHub.md` at 9fb36b2, updated for Zeemrepo after the owner reversed Zimi's ADR-0008 on 2026-10-09. Server-side and agent-side controls are new; the ruleset was read from the GitHub API on 2026-10-09.
