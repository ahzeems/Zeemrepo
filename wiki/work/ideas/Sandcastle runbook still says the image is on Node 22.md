---
type: idea
title: Sandcastle runbook still says the image is on Node 22
summary: One line of the Sandcastle runbook still says the sandbox image runs Node 22, which S12 changed.
tags: [area/agents, area/wiki]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: done
owner: human
priority: P3
next_action: None. PR 40 removed the line.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "INFERRED: the S08 verifier at 3cc809e reported the line, at the time line 288 of the runbook (2026-10-18)."
  - "VERIFIED: on 2026-10-18 grep found no \"Node 22\" in wiki/runbooks/ or .sandcastle/ on main at 801eb53; PR 40, merged as c11dfa7, replaced the line when it moved the image to Ubuntu 26.04."
---

## Problem

[[Run Sandcastle on GitHub issues]] says in one place that the sandbox image is on Node 22, while the
Dockerfile and the runbook's Known notes moved to Node 24 in S12 (PR 34). An operator could blame Node 22 for a failure
with another cause.

## Desired outcome

Every runbook line agrees with `.sandcastle/Dockerfile`.

## Next step

None. PR 40 fixed the line.
