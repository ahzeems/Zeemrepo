---
type: idea
title: Repository tickets drive parallel agent work on a kanban board
summary: Replace GitHub issues as Sandcastle's work source with the repository's own work notes, so several initiatives run in parallel from one kanban board of tickets whose state lands by pull request.
tags: [area/agents, area/planning, kind/architecture]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: The owner reviews [[Smallest slice of a repository ticket board and its evals]] and decides the open questions below, starting with the eligibility rule for the agent-ready lane.
related: ["[[Run Sandcastle on GitHub issues]]", "[[Choose the Sandcastle execution boundary]]", "[[Repository audit remediation]]"]
evidence:
  - "OWNER DECISION: on 2026-10-17 the owner said they prefer a defined repository ticketing system to GitHub issues, building towards a kanban board of initiatives worked in parallel; the body quotes it."
  - "VERIFIED: wiki/runbooks/Run Sandcastle on GitHub issues.md (Prerequisites) gives the sandbox GH_TOKEN only Issues read and write, for reading and commenting on issues (read 2026-10-17)."
  - "VERIFIED: scripts/wiki/work-tracking.ts makes wiki:lint refuse a ready, in-progress, in-review or done ticket whose depends_on parents are not done, while its approval check runs only for plans and specs (read 2026-10-17)."
  - "INFERRED: finding which proposed tickets could start, and confirming their job-spec approval, is done by hand, from the audit remediation tickets' next_action fields (\"Verify approval and ... completion\") and from no command listing startable tickets."
  - "VERIFIED: on 2026-10-17 .sandcastle/plan-prompt.md runs gh issue list, scripts/sandcastle/plan-schema.ts accepts only numeric ids and sandcastle/issue-<n> branches, and implement-prompt.md and merge-prompt.md read and comment on issues with gh (read with grep)."
---

## Problem

Sandcastle takes its work only from GitHub issues labelled `Sandcastle`. On 2026-10-17 the
coupling was:

- the planner prompt runs `gh issue list`, and a model infers which issues block which;
- `scripts/sandcastle/plan-schema.ts` accepts only a numeric issue id and a
  `sandcastle/issue-<n>` branch;
- the implementer reads the task with `gh issue view` and reports with `gh issue comment`, and the merger comments on each issue;
- the sandbox `GH_TOKEN` needs Issues read and write only for those reads and comments.

Meanwhile the repository already tracks its own work in `wiki/work/`:

- ideas, projects, maps, plans and tickets;
- the workflow states (backlog, ready, in-progress, in-review, done and others);
- `depends_on` between tickets;
- job specs that state Goal, Acceptance criteria, Allowed files and Human checkpoints.

Work in progress is therefore described in two places. GitHub issues carry the task text
Sandcastle reads, while the repository's tickets carry the contract the owner approved. `wiki:lint`
refuses a ticket marked ready or started before its parents are done, but nothing lists which
tickets could start next, so finding them and confirming their approval is done by hand.

OWNER DECISION: on 2026-10-17 the owner said: "Yea I want thia to be building towards a kanban
board whereby I have multiple initiatives and they cna be worked on in parallel. I actuslly
prefer not using github issues but I like the idea of using it with a defined own ticketing
system. Lets commit the idea to wiki and I can deep research how this will interconnect with
current repo standards"

## Desired outcome

- **One source.** The owner sees every initiative and its tickets on one board built from the
  repository's own work notes. The board's columns are the existing workflow states, and its
  initiatives are projects.
- **Agents take work from the board.** Sandcastle picks tickets that are approved, not done,
  free of uncleared human checkpoints, and whose `depends_on` parents are done. It works
  several initiatives in parallel without GitHub issues.
- **State changes land by pull request.** A ticket's state and evidence change on the branch
  that does the work, as change records already require. No separate tracker exists that
  could drift from the repository.

## Next step

The owner researches the fit with current standards. These are the questions to settle before a plan:

1. **Eligibility.** How a ticket marks itself safe for an agent to take. A job spec's human
   checkpoints (S12 needs owner authorization for infrastructure) and the plan's
   one-ticket-per-fresh-session rule must stop an agent from picking it up.
2. **Picking.** Whether picking becomes a deterministic script over frontmatter (status and
   `depends_on`) in place of the model planner. INFERRED: a script removes the need to validate
   a plan built by a model that read untrusted issue text, as `plan-schema.ts` does now.
3. **Ids and branches.** How a ticket's identity and branch name are derived, replacing
   `sandcastle/issue-<n>`.
4. **Reporting.** Where an agent records progress without issue comments. A ticket's
   `evidence` changes on its branch, but a parallel board needs in-progress state before
   anything merges.
5. **The board.** What renders it: an Obsidian Base, a generated page, or a CLI over
   `wiki/work/`. The Obsidian view is optional, since the wiki needs no Obsidian software.
6. **GitHub issues.** Whether they stay as a second intake or are dropped. If dropped, the
   sandbox needs no `GH_TOKEN`, which narrows what the isolated workflow chosen in
   [[Choose the Sandcastle execution boundary]] must protect.
7. **Interaction with the approved plan.** The audit remediation job specs S10 (Blocked-queue
   planning contract) and S14 (Isolated coordinator preparation and export) come from approved
   plan slices and assume the issue-based planner; S10 puts adding a new issue tracker out of
   scope. Changing the work source changes their scope, which needs renewed owner agreement
   before they start.
