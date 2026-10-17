---
type: idea
title: First real Sandcastle run and the wrapper probe fix
summary: The first real Sandcastle and AFK runs worked end to end and confirmed the reflog premise; they exposed a noisy git probe, an owner-token problem and an issue-writing trap, recorded here.
tags: [area/agents, area/github, tool/claude-code]
created: 2026-10-15
updated: 2026-10-17
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews and merges the pull request, then replaces the sandbox GH_TOKEN with a fine-grained token of the machine account.
related: ["[[Run Sandcastle on GitHub issues]]", "[[Sandcastle runs unattended and lands by pull request]]"]
evidence:
  - "VERIFIED: on 2026-10-15 npm run sandcastle planned, implemented, reviewed and merged issue 8 on a trial branch; git reflog show sandcastle/issue-8 listed a commit: entry and a branch: Created entry, the merge onto the trial branch logged Fast-forward, and round 2 reported issue 8 as already merged."
  - "VERIFIED: npm run sandcastle:afk on the same branch exited 2 with 'work merged by an earlier run ... not pushed' when the planner found nothing new, then, with issue 9 made independent, merged issue 9 locally and stopped at the landing step because changelog-guard refused a branch without a CHANGELOG.md entry; nothing was pushed and the wrapper commented nothing."
  - "VERIFIED: the planner log for the first wrapper run says issue 9 'is blocked by Issue #8' because its text said 'after the sentence added for the first trial'; issues stay open until the owner closes them, so a dependent issue waits."
  - "VERIFIED: the comments the loop posted on issues 8 and 9 and the commit author were the repository owner's account, not the machine account, so the sandbox GH_TOKEN is the owner's personal token (inferred from the comment authors; the file was not read)."
  - "VERIFIED: the new case in scripts/sandcastle/afk.test.ts failed before the change (1 of 53) and the sandcastle test files pass after it (145 of 145); npm run check on this branch is recorded in the pull request."
  - "UNKNOWN: the behaviour under another Sandcastle version, another host or a sandbox provider other than Docker."
---

## Problem

The wrapper ran `git merge-base --is-ancestor` against `refs/remotes/origin/<branch>` before the
branch had ever been pushed, which printed a raw `fatal:` line next to an otherwise correct
message.

## Desired outcome

A quiet probe: ask whether the remote ref exists first, and treat a missing ref as "not pushed".
The runbook records the facts the first real run established.

## Next step

Owner review. Then replace the sandbox token: a fine-grained token of the machine account,
limited to this repository, with Issues read and write and Metadata read.

## Observations

- [no-doc-change: the runbook is updated in this branch with what the first run showed; the
  guards, the wrapper's behaviour and its exit codes are unchanged]
- Every Sandcastle issue must let the agent write the changelog record (a fragment since ADR-0027)
  and the work record, or the change-record guard blocks the landing, as it did here.
