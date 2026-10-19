---
type: idea
title: A scoped model credential for the isolated guest awaits an owner decision
summary: S14's guest gets no model credential, so a real-model run fails at its first agent until the owner decides how a scoped credential enters the boundary.
tags: [area/agents, area/auth]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: human
priority: P1
next_action: None. The owner decided on 2026-10-19; S28, S29 and S30 carry the build and S18 depends on them.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S14 Isolated coordinator preparation and export]]", "[[S18 Public-command cutover and end-to-end isolation proof]]", "[[Run Sandcastle on GitHub issues]]", "[[Choose how the model credential reaches the isolated guest]]", "[[S28 Per-run model credential proxy]]", "[[S29 Guest credential wiring and token handling]]"]
evidence:
  - "INFERRED: PR 60 (S14, open, head 7b0df89, read on 2026-10-19) records in its ticket's Discovered work that the launcher passes no environment and S12's launch check refuses any credential variable, so a real-model run fails at its first agent, and that how a scoped credential enters the boundary is an owner decision for S18; its body says the same. The S14 ticket's Discovered work is not on main yet (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on main at 2a69b17 (PR 60 merged), line 114 of wiki/work/tickets/S14 Isolated coordinator preparation and export.md, under Discovered work, reads: Model credentials: the launcher passes no environment, and S12's launch check refuses any credential variable, so a real-model run fails at its first agent; how a scoped credential enters the boundary is an owner decision for S18 (checked by Claude Code, Opus 5.5)."
  - "OWNER DECISION: on 2026-10-19, asked \"How should the agent's credential reach the container?\", the owner chose \"Build our own tiny proxy (Recommended)\"; the decision ticket Choose how the model credential reaches the isolated guest quotes the option in full and lists the rejected options."
---

## Problem

S18 makes the public commands run in the isolated guest. Without a credential, that guest cannot run the planner, implementer or merger, and S12's launch check refuses credential variables by design.

## Desired outcome

The owner's answer is recorded, and S18 delivers the credential that way with its own refusal controls.

## Next step

None. The owner chose an in-repo per-run proxy on 2026-10-19, recorded in
[[Choose how the model credential reaches the isolated guest]]. [[S28 Per-run model credential proxy]],
[[S29 Guest credential wiring and token handling]] and [[S30 Per-run internal guest network]]
carry the build.
