---
type: runbook
title: Resume software factory planning
summary: Start a fresh agent session on the software factory from committed records, check which planning PRs the owner merged, and work one map decision at a time without building anything.
tags: [area/planning, area/agents]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
idea: "[[Software factory runs ideas to completion]]"
related: ["[[Software factory map]]", "[[Software factory functions, gaps and build inventory]]", "[[Idea to execution]]", "[[2026-10-19 Software factory planning]]"]
---

## When to use

Use this to continue planning the software factory in a new terminal or with another agent or
provider. Everything needed is in the repository; the original chat is not required. The owner
asked on 2026-10-19 for planning and tickets only: no build work until a plan is owner-merged.

## Prerequisites

- Read `AGENTS.md`, `CLAUDE.md` and the applicable rules, then load `wiki-memory`.
- Identify the checkout, branch, HEAD, local changes and other worktrees. Other sessions work in
  parallel on remediation; never touch their worktrees or uncommitted work. Start your own worktree
  from fresh `origin/main` (ADR-0021).
- Know the records, in reading order:
  1. [[Software factory runs ideas to completion]]: the requirement and the owner's twelve
     interview answers. Settled; do not reopen them.
  2. [[Software factory functions, gaps and build inventory]]: Hermes Agent as the functional
     reference, the gap table against `main`, the twelve-part build inventory, governance changes
     and unknowns.
  3. [[Software factory map]]: the open decision and research tickets the plan needs.
- Planning PRs as of 2026-10-19, both opened by the agent and not merged:
  - [PR 64](https://github.com/Zimfra/software_testing/pull/64), branch
    `docs/software-factory-requirements`: the idea and research.
  - [PR 65](https://github.com/Zimfra/software_testing/pull/65), branch
    `docs/software-factory-map`: the map, twelve tickets, this runbook and the session note.
    It is stacked on PR 64, so PR 64 merges first.

## Steps

1. **Check what landed.** Run `gh pr view 64 --json state,mergedBy` and the same for 65. If either
   is open, these notes exist only on its branch: read them there (`git show origin/<branch>:<path>`)
   and tell the owner that the PR waits on their merge. Do not treat an open PR as approval.
2. **Refresh the facts.** Remediation moves fast. Compare the gap table with current `main`
   (`ls scripts/sandcastle/`, ticket statuses of S18 and later, `command -v docker`). Record
   changed facts with dated `VERIFIED:` evidence on a new branch.
3. **Work the map.** Use `wayfinder` in work-through mode: one decision ticket per session, with the
   owner, one question per turn, with evidence and a recommendation. Start with
   [[Choose the first factory plan's scope]] unless the owner names another. Record the owner's
   words as `OWNER DECISION:` in the ticket's Resolution, set it done, and add a one-line gist to the
   map's Decisions so far. Never answer an owner decision yourself; ticket recommendations are not
   decisions.
4. **Research tickets** may be resolved by an agent alone, several per session, with cited sources.
   Start with [[Check whether the Sandcastle custom tracker accepts wiki ticket ids]], which gates the
   issue-key decision.
5. **Write the plan only when allowed.** When the map's decisions are resolved (or, if the owner
   chose the board-and-picker plan first, when the picker decision is resolved), use `write-plan` for
   a `proposed` plan with `job_specs: required`. Agree the test seams with the owner first.
6. **Tickets after the merge.** Use `plan-tickets` only after the owner merges the plan PR and its
   `approval_ref` is verified on GitHub. Agree the breakdown with the owner before creating tickets.
7. **Land each step** on its own branch with a changelog fragment, wiki commits alone with a
   `docs(wiki): ` subject, `npm run check`, then `npm run pr`. Only the owner merges.

## Known blockers outside the map

- Docker is not installed on the owner's machine (`command -v docker` empty on 2026-10-19). The
  dispatcher needs it; planning does not.
- S18 (public-command cutover) is proposed and waits on the owner's decision on how a scoped model
  credential reaches the isolated guest. The factory's subscription login depends on that answer.
- `npm run pr` can refuse with "npm run check changed this repository's git state" while other
  sessions commit; see [[Pre-push state check misfires when agents share a repository]]. Rerun when
  they are idle. Right after a push it can also report the PR head as stale until GitHub catches up;
  rerunning reuses the open PR.

## Verify

- A fresh session finds the idea, research, map and the next ticket from this note alone.
- No plan exists while the map has open decisions it depends on, and no build ticket exists without
  an owner-merged plan.
- `npm run wiki:lint` and `npm run check` pass on every branch you publish.

## Starter instruction

Paste this into a fresh session opened at the repository checkout:

```text
Read AGENTS.md and CLAUDE.md, then load wiki-memory. Follow
wiki/runbooks/Resume software factory planning.md (if it is not on main yet, read it from
origin/docs/software-factory-map). Check whether PRs 64 and 65 are merged, refresh the gap facts
against main, then work one decision on the Software factory map with me using wayfinder,
starting with "Choose the first factory plan's scope". Planning and tickets only: no build work.
```
