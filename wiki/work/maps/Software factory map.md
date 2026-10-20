---
type: map
title: Software factory map
summary: Decisions the software factory plan needs before it can be written, charted from the owner's requirement interview and the gap research.
tags: [area/agents, area/planning, kind/architecture]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: clarifying
owner: human
priority: P1
next_action: The owner works the frontier, starting with Choose the first factory plan's scope; agents may resolve the research tickets.
idea: "[[Software factory runs ideas to completion]]"
related: ["[[Software factory functions, gaps and build inventory]]", "[[Repository tickets drive parallel agent work on a kanban board]]", "[[Smallest slice of a repository ticket board and its evals]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner asked for planning and tickets only: \"dont do any build work, just planning and tickets\"."
  - "VERIFIED: wayfinder charts decisions on a map before write-plan, and plan-tickets creates build tickets only from an owner-merged plan (.claude/skills, read 2026-10-19)."
  - "VERIFIED: the twelve interview answers are recorded in the idea, and the gap table was refreshed against main on 2026-10-19 (research note)."
---

Use evidence and owner decisions; do not invent approval.

## Destination

An owner-approved factory plan with `job_specs: required`, sliced in the order of the build inventory in [[Software factory functions, gaps and build inventory]], plus the governance PRs it needs. The read-only board and picker may get their own plan first if [[Choose the first factory plan's scope]] says so.

## Notes

- The requirement is [[Software factory runs ideas to completion]]; its twelve interview answers are settled and are not reopened here.
- This map records decisions and never authorises implementation. Build tickets come only from an owner-merged plan (plan-tickets).
- A fresh session starts from [[Resume software factory planning]].
- Load `wiki-memory` first. Use `wayfinder` for one decision per session and `grill-plan` for owner questions. Agents resolve research tickets alone.
- Outside this map but blocking the build: Docker is not installed on this machine, and S18 (the public-command cutover) is proposed and waits on the owner's decision on how a scoped model credential reaches the isolated guest. Answer 7's subscription login rides on that decision.

## Open decisions

Owner:
- [[Choose the first factory plan's scope]]
- [[Define how the picker reads approval and open checkpoints]]
- [[Choose where factory run records and the usage ledger live]]
- [[Choose how wiki tickets replace issue keys in the Sandcastle pipeline]] (after [[Check whether the Sandcastle custom tracker accepts wiki ticket ids]])
- [[Choose where the learned-skill overlay lives]]
- [[Authorise email notifications and their content]] (after [[Compare Gmail sending paths for a headless dispatcher]])
- [[Choose how the dispatcher runs on the owner's machine]]
- [[Choose what renders the read-only board]]

Agent (research):
- [[Check whether the Sandcastle custom tracker accepts wiki ticket ids]]
- [[Find how subscription usage limits reach a running worker]]
- [[Compare Gmail sending paths for a headless dispatcher]]
- [[Read Hermes's skill curator and goal mode]]

## Decisions so far

- Requirement interview, answers 1-12: recorded in [[Software factory runs ideas to completion]] on 2026-10-18.

## Not yet specified

- How the planner agent notices a new idea and avoids planning it twice.
- How an idea's desired outcome becomes something the verifier can check (answer 12).
- How often learned skills are batched into promotion PRs, and who reviews them.
- What the governance ADR for the overlay says beyond the storage choice.

## Out of scope

- Other repositories: answer 1 keeps the first version in Zeemrepo.
- Deciding, chatting or controlling the dispatcher from the front end: answer 10 chose read-only.
- GitHub issues as intake: answer 11 dropped them.
- Building anything: the owner asked for planning and tickets only.
