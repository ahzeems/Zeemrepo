---
type: idea
title: Software factory runs ideas to completion
summary: An orchestrator and dispatcher over the wiki kanban that works the owner's ideas to completion, improves itself, and lands every change by owner-merged pull request.
tags: [area/agents, area/planning, kind/architecture]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: clarifying
owner: human
priority: P1
next_action: The owner reviews the interview below and [[Software factory functions, gaps and build inventory]]; on approval a planner writes the factory plan.
related: ["[[Repository tickets drive parallel agent work on a kanban board]]", "[[Smallest slice of a repository ticket board and its evals]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner set the goal: \"we need to discuss having an orcastrator, and a kanban style ticketing system, with the idea of a software factory, something which self improves and works on my projects and ideas till cimpletion\"."
  - "OWNER DECISION: on 2026-10-18 the owner said Sandcastle \"is a 2nd step to acheiving this but we dont want to rely on github issues- we want the internal process and wiki used\"."
  - "OWNER DECISION: on 2026-10-18 the owner said a front end comes later: \"at some point we will design a front end which we can use to interact with this repo - something similar to what the Hermes software does nativly\"."
  - "OWNER DECISION: on 2026-10-18 the owner chose to build natively and borrow from Hermes: \"i want to plan and research the build required to borrow from the hermes design, but also we do need a orchestrator and dispatchecer s so its a combination\"."
  - "OWNER DECISION: on 2026-10-18 the owner set this phase's end state: \"an ful understanding of the requiment, gaps from the repo, tools and skill and connectors required for this to work within the zim repo, and hermes is a good example of functionalikty required\"."
  - "OWNER DECISION: on 2026-10-18 the owner chose the autonomy target \"Agents do everything up to PR; I merge (Recommended)\"."
  - "OWNER DECISION: on 2026-10-18 the owner chose for self-improvement \"Auto-apply skills, rules need PR\"."
  - "VERIFIED: .claude/rules/zeem/owner-authority.md says a skill an agent drafts is approved only when the owner merges the PR that adds it, so auto-applied skills conflict with the current rule (read 2026-10-18)."
---

## Problem

Work moves only as fast as the owner can hand-drive it: finding which ticket can start,
starting each agent, checking its evidence and landing its pull request one at a time.
Sandcastle can run agents in parallel, but it takes work only from GitHub issues, while the
owner-approved contract for each piece of work lives in `wiki/work/`.

## Desired outcome

A software factory in this repository that:

- holds every initiative as wiki work records on a kanban board, with no GitHub issues;
- has an orchestrator and dispatcher that pick ready tickets, run agents (Sandcastle as the worker
  runtime) and keep going until each project or idea is done;
- improves itself from what it learns: skills change without a pull request, rules only by one;
- lets agents do everything up to an open pull request, and the owner merges;
- later gets a front end for interacting with the repository, in the spirit of Hermes Agent.

## Requirement interview

Answers from the owner, recorded as they are given.

1. **Scope.** Zeemrepo is the control plane: board, dispatcher, rules and wiki live here. The first
   version builds only in Zeemrepo; other repositories are added later as registered projects once the
   loop is proven. OWNER DECISION, 2026-10-18: "Zeemrepo is control plane; other repos later (Recommended)".
2. **Breakdown.** A planner agent turns a new idea into a plan and tickets through the existing chain
   (grill-plan, write-plan, plan-tickets) and opens a pull request. The owner's merge is the approval;
   only then can its tickets become ready. No rule change. OWNER DECISION, 2026-10-18: "Agent plans, I
   approve by merge (Recommended)".
3. **Learned skills.** The factory writes learned skills to a versioned overlay outside `main`; workers
   use them at once, a bad one is reverted in the overlay, and the factory periodically opens a pull
   request promoting good ones into `.claude/skills/`, which the owner merges. This needs a new ADR and an
   amendment to `owner-authority.md`, both by pull request. OWNER DECISION, 2026-10-18: "Learned overlay
   + PR promotion (Recommended)".
4. **Picking.** A deterministic script picks work; a model only implements. A ticket is eligible when it
   is a ticket with status `ready`, `owner: agent`, every `depends_on` done, its plan approved
   (`approval_ref`) and no open human checkpoint. Order is priority (P0 first), then oldest. This answers
   owner questions 1 and 2 of [[Repository tickets drive parallel agent work on a kanban board]].
   OWNER DECISION, 2026-10-18: "Deterministic script (Recommended)".
5. **Claims and live state.** A ticket's id is its note's file name; its branch is `factory/<slug>`.
   Pushing the branch claims the ticket. Workers report through commands modelled on Hermes's
   (complete, block, request review) that write status and labelled evidence into the ticket note on
   that branch. The board reads `main` plus open `factory/*` branches; all state stays in git, with no
   database. This answers owner questions 3 and 4 of the kanban idea. OWNER DECISION, 2026-10-18:
   "Branch is the claim (Recommended)".
6. **Runtime.** The dispatcher and its agent sandboxes run on the owner's own machine, which needs Docker
   installed first (S12's evidence records `npm run sandbox:smoke` there reporting Docker unavailable). The factory
   runs only while the machine is on, and its containment must keep agents away from the owner's personal
   files and logins. OWNER DECISION, 2026-10-18: "This machine (install Docker)".
7. **Budget.** Workers use the owner's Claude subscription login, as the compliance evals do. The
   dispatcher enforces hard caps: at most 3 parallel workers, a per-ticket iteration cap, a maximum number
   of runs per day, and a stop when usage limits are hit. Every run is logged to a usage ledger in the
   wiki. OWNER DECISION, 2026-10-18: "Subscription login + hard caps (Recommended)".
8. **Notifications.** The factory reaches the owner by email through Gmail: pull request ready, ticket
   blocked, decision needed, cap hit, and a daily summary. Email leaves the workspace, so each message
   needs the redaction pass in `owner-authority.md` and the destination authorised once in a decision.
   OWNER DECISION, 2026-10-18: "Email (Gmail)".
9. **Failures.** A failed run is retried up to 2 times in a fresh sandbox, with the reviewer's findings
   fed back. After that the ticket is set `blocked` with a `blocker`, the owner is emailed, and a lesson
   candidate is drafted. A claimed branch with no commits for 6 hours is stale and the dispatcher
   re-queues it. OWNER DECISION, 2026-10-18: "2 retries, then block + lesson (Recommended)".
10. **Front end.** The first front end is read-only: the board by status per project, live in-flight
    branches, and each run's history (log, retries, usage). Answering decisions, chat and dispatcher
    controls were offered and not chosen for now. OWNER DECISION, 2026-10-18: "See the board + run history".
11. **GitHub issues.** Wiki tickets are the only intake; GitHub issues are dropped. Remediation tickets
    S10 (Blocked-queue planning contract) and S14 (Isolated coordinator preparation and export) are
    re-planned against the wiki tracker through a plan amendment pull request, keeping their containment
    and coordinator goals. This answers owner questions 6 and 7 of the kanban idea. OWNER DECISION,
    2026-10-18: "Drop issues; re-scope S10/S14 (Recommended)".
12. **Completion.** An idea is done when every ticket under its plan is done (merged by the owner) and an
    independent verifier confirms its desired outcome against `main`. On a pass the factory opens a
    closing pull request marking the idea and project done, which the owner merges. On a fail the
    verifier's gaps go to the planner as new tickets, and the loop continues. OWNER DECISION, 2026-10-18:
    "All tickets merged + verified outcome (Recommended)".

Settled by the files, not asked: any harness or provider may work here. ADR-0026 is active and
supersedes ADR-0024 (read 2026-10-18).

## Next step

The interview is complete. The owner reviews it with [[Software factory functions, gaps and build inventory]],
which maps Hermes's functions to this repository, lists the gaps and the build inventory, and names the
governance changes each decision needs. A plan follows only after that review.
