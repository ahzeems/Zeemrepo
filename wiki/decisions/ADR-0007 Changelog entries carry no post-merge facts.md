---
type: decision
title: ADR-0007 Changelog entries carry no post-merge facts
summary: Entries record the change in their own PR and never cite a merge commit, removing the closeout PR.
tags: [area/docs, area/git, area/agents, kind/architecture]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0008 Owner merges pull requests on GitHub]]", "[[Change records]]"]
---

## Context

When the owner merges a pull request on GitHub ([[ADR-0008 Owner merges pull requests on GitHub]]),
the agent that prepared it is no longer in the loop. In Zimi the dated changelog format cited
a PR number and a merge commit. A merge commit does not exist until the merge, so the entry
could never be written in the PR that made the change; every change owed a closeout PR
afterwards.

Zimi recorded the resulting drift for PRs 6 and 7 and made reconciliation mandatory. The debt
recurred anyway: PR 8 created the rule, PR 9 was its closeout, and PR 10 merged unrecorded.
`wiki:lint` cannot catch this, because it validates note structure and never queries GitHub.

A guard on the closeout step would only report the debt. The ordering itself creates it.

## Decision

A changelog entry states what changed and goes in the same PR, in `CHANGELOG.md` at the
repository root, under a dated heading from the day the branch started to today. It may link
the PR, whose number exists as soon as the PR is opened. It must not cite a merge commit, a
merged-in phrase, or a cherry-pick, because those are knowable only after the merge.

`scripts/changes/changelog-guard.ts` (`npm run changelog:guard`) runs inside `npm run check`,
so the pre-push hook and the required `guards` status check both run it. It refuses a branch
that changes non-exempt files without adding its own entry, or that adds an entry citing a
post-merge fact. [[Change records]] states the exact rule.

## Consequences

No closeout PR is owed, so no reconciliation can be forgotten. The changelog stops recording
merge commits; Git history and the linked PR already carry that. Dated entries written before
this rule keep their merge commits as history and are not rewritten.

The guard reads only the local checkout and needs no GitHub credentials, so it works offline
and in a fresh clone. Locally, Git hooks can be bypassed with `--no-verify`; the `guards`
check runs main's copy of the guard on every pull request, so a bypassed branch is still
refused before the owner can merge it.

Ported from Zimi `wiki/decisions/ADR-0007 Changelog entries carry no post-merge facts.md` at 9fb36b2. Changed: script path, changelog location, the date window for entries, and the CI `guards` check now match Zeemrepo; the closeout history is told as Zimi history.
