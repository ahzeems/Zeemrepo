---
type: session
title: 2026-10-19 Software factory planning
summary: The owner set the goal of a software factory over the wiki kanban; the requirement, Hermes-based gap research and a decision map were recorded across PRs 64 and 65, with no build work.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
idea: "[[Software factory runs ideas to completion]]"
related: ["[[Resume software factory planning]]", "[[Software factory map]]"]
---

## Goal

In the owner's words: "we need to discuss having an orcastrator, and a kanban style ticketing
system, with the idea of a software factory, something which self improves and works on my projects
and ideas till cimpletion". Sandcastle is the second step, GitHub issues are not used, and a front
end like Hermes Agent's comes later. This phase was planning and research only.

## What was done

1. The owner first trialled a personal AI operating-system starter kit kept outside this
   repository and judged that it did not fit the need. Reviewed against the factory requirement,
   none of its files or skills are used; only two ideas carried over, a regular improvement loop and
   work running on a schedule. The factory is built in this repository.
2. Researched Hermes Agent (NousResearch, v0.22.2) as the functional reference: board, dispatcher,
   worker report tools, reviewer, learned skills, notifications and dashboard.
3. Ran a requirement interview with `grill-plan`: twelve owner answers, recorded in
   [[Software factory runs ideas to completion]].
4. Wrote [[Software factory functions, gaps and build inventory]] and opened
   [PR 64](https://github.com/Zimfra/software_testing/pull/64).
5. On 2026-10-19 found that S01-S17 and S19-S27 had landed since the research was written, and
   refreshed the gap table. Answer 11's re-scope of S10 and S14 no longer applies; it became a
   decision ticket.
6. The owner asked for planning and tickets only. Charted [[Software factory map]] with eight owner
   decisions and four research tickets, and wrote [[Resume software factory planning]]. Opened
   [PR 65](https://github.com/Zimfra/software_testing/pull/65), stacked on PR 64.

## Outcome

- `npm run check` passed on both branches before publication; both PRs are open, not merged.
- No code, rule, ADR or Sandcastle change was made. No build ticket exists: plan-tickets needs an
  owner-merged plan, and write-plan needs the map's decisions.
- Not verified: the four research questions, and whether Docker can be installed on this machine.

## Open items

- The owner merges PR 64, then PR 65.
- Work the map, starting with [[Choose the first factory plan's scope]].
- Two `npm run pr` attempts were refused while parallel sessions committed; see
  [[Pre-push state check misfires when agents share a repository]].
