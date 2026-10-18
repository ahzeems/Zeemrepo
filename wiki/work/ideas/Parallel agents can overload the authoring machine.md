---
type: idea
title: Parallel agents can overload the authoring machine
summary: Running many agents and stress tests at once on the 8-core, 7 GiB authoring machine crashed it twice; nothing in the repository limits concurrent heavy jobs.
tags: [area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan where a concurrency limit for heavy jobs lives, among the coordinator's briefs, a skill, or a check in npm run check.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Parallel agents collide in the shared scratchpad]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner reported the crashes: \"continue - the server creashed\", twice."
  - "INFERRED: before the crashes up to seven agents ran at once, several with full npm run check runs and mutation runs, and one stress probe ran 16 busy loops (load average 39, recorded in the S25 ticket). After the coordinator limited itself to two heavy jobs at a time there was no further crash that day."
  - "VERIFIED: on 2026-10-18 nproc reported 8 and free reported about 7 GiB of memory on the authoring machine."
---

## Problem

A coordinator session can start any number of agents, and each one may run `npm run check`, mutation runs or
load probes. On 2026-10-18 that crashed the machine twice, killing agents mid-commit and leaving fixture
directories and one planted mutation behind.

## Desired outcome

Heavy work (full checks, mutation runs, load probes) is limited to a stated number of concurrent jobs, the limit
is written where every coordinator reads it, and an agent's brief carries it.

## Next step

Decide whether the limit is guidance in a skill or something a script enforces, and how a load probe stays
within it.
