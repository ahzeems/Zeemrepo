---
type: idea
title: Merger comments announce issues before integration is checked
summary: A comment the merger agent posts on an issue is a phase claim made before the coordinator checks integration, so it can announce an issue the run then reports not integrated.
tags: [area/agents, area/github]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Check whether S17's notification reconciliation covers comments made by agents; if not, plan moving issue comments to the host after the integration check.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S09 Explicit phase outcomes and review eligibility]]"]
evidence:
  - "INFERRED: the S09 builder recorded in the ticket's Discovered work that a merger comment is a phase claim made before the coordinator checks integration (2026-10-18)."
  - "INFERRED: S17's acceptance criteria cover duplicate notifications after lost acknowledgement, not notifications sent by an agent before integration; read 2026-10-18."
---

## Problem

S09 made the coordinator, not the agents, decide whether an issue was integrated. The merger agent can still comment on the issue during its phase, and that comment can say the work is merged before the coordinator finds that it is not.

## Desired outcome

Every issue notification comes from the host after the outcome it reports is established.

## Next step

Read S17's plan section; either extend S17 with this case through the owner, or plan a separate change.
