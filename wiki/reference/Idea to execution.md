---
type: reference
title: Idea to execution
summary: The path from an idea through a map, an owner-approved plan, build tickets and pull requests, with the skill and record at each step.
tags: [area/planning, area/agents, kind/overview]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Land a change]]", "[[Verify a repository change]]"]
---

Capture, clarify, plan, approve, ticket, build, land. Every record is a note under
`wiki/work/`; its fields and sections are in the wiki-memory skill's `references/note-schema.md`.
Small, settled changes skip the map and the plan and go straight to a branch.

| Step | Skill | Record and status | Done when |
|---|---|---|---|
| Capture | wiki-memory | Idea in `wiki/work/ideas/`, `backlog` | Problem, desired outcome and next step are written |
| Clarify | wayfinder, grill-plan | Map in `wiki/work/maps/`, `clarifying`, with decision tickets | No decision is left open before someone builds |
| Plan | write-plan | Plan in `wiki/work/plans/`, `proposed` | The plan is committed alone and its pull request is open |
| Approve | (owner) | Plan becomes `approved`, `approval_ref` set | The owner has merged the pull request that adds the plan |
| Ticket | plan-tickets | Build tickets in `wiki/work/tickets/`, `plan` links the approved plan | Each ticket has one deliverable and checkable acceptance |
| Build | ECC TDD workflow, verify-work | Ticket `in-progress`, then `in-review` | Tests pass and each criterion has a verdict |
| Land | manage-branch, `npm run pr` | Ticket `done` with `VERIFIED:` evidence | The owner merges the ticket's pull request |

## Approval is a merged pull request

A branch cannot approve its own plan. The plan is approved only when the owner merges the pull
request that adds it on GitHub. A follow-up `docs(wiki): ` change then sets `status: approved`
and `approval_ref` to that pull request, written as `#N` or its full GitHub URL. Nothing else
counts, and the field alone proves nothing: before cutting tickets, confirm the merge with

```sh
gh pr view <N> --json state,mergedBy
```

A status written by an agent is never approval.
[[ADR-0008 Owner merges pull requests on GitHub]] records why only the owner merges.

## While building

After each meaningful slice, update the owning record (status or `next_action`, plus labelled
evidence) and any guidance the change affects. Check the slice with
[[Verify a repository change]], then land it through [[Land a change]]. Keep links to real
ownership and dependencies; agents find the rest by searching metadata.

Ported from Zimi `wiki/reference/Idea to execution.md` at 9fb36b2. Rewritten for Zeemrepo:
approval is the owner merging the plan's pull request, and the Zimi hub and walkthrough pages
it linked were not ported.
