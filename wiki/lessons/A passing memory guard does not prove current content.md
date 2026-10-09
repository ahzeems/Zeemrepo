---
type: lesson
title: A passing memory guard does not prove current content
summary: memory:guard proves a branch updated a work record and an operating document; it does not prove the wiki is accurate, current, or read from the right checkout.
tags: [area/wiki, area/agents, kind/pitfall]
created: 2026-09-21
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Change records]]", "[[Maintain the repository wiki]]"]
---

## What happened

In Zimi, an agent described the wiki workflow from an old worktree on another machine. That
account was already obsolete: the canonical main branch had moved on and passed its checks, while
an older idea note and two active workflow documents were still stale. The record-presence guard
passed throughout. Comparing files between checkouts did not settle which one was authoritative,
or whether a later repair had changed a note.

The guard was never designed to answer those questions. In Zeemrepo the same kind of check is
`npm run memory:guard` (`scripts/changes/repo-memory-guard.ts`, rules in
`scripts/changes/repo-memory-validation.ts`). Read from the code, it proves only this, for the
diff between the branch and its base:

- At least one work record under `wiki/work/` changed, and one record both gained a new
  `VERIFIED:` or `OWNER DECISION:` evidence item and changed its `status` or `next_action`.
  Evidence that says the check did not happen (pending, TBD, not run, n/a) does not count.
- When workflow-critical files changed, an operating document gained content, or the work
  record newly carries `[no-doc-change: <reason>]` with a reason of ten or more characters.
- Changes that touch only `CHANGELOG.md` or exempt paths need nothing.

It does not prove:

- that the evidence item is true; it matches a label and a few negative phrases, not a result;
- that any other note is accurate, or that existing notes still match the code;
- that parent ideas, projects, issues or tickets agree with the record that changed;
- that the checkout being read is the authoritative one, or that a viewer serves the latest
  revision.

## Fix

Read current intent from an identified checkout: fetch the remote and pin the revision before
diagnosing missing or stale documentation. Repair stale notes from existing evidence, and keep
maintenance guidance in one runbook that links writing, review, landing and reader verification
without claiming that anything synchronizes automatically.

## How to apply

- Treat a passing `memory:guard` as "the branch recorded itself", never as "the wiki is right".
- Check required-record presence and factual accuracy as two separate questions. The second one
  is a review task: read the affected notes against the code they describe.
- Review the parent idea and project, and their issues or tickets, when a work record changes.
  Never mark them done because a child is done.
- Before saying content is current, name the revision you read (the commit, or the source a
  viewer actually serves).

Ported from Zimi `wiki/lessons/A passing memory guard does not prove current content.md` at 9fb36b2.
