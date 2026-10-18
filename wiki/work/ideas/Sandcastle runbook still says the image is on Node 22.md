---
type: idea
title: Sandcastle runbook still says the image is on Node 22
summary: One line of the Sandcastle runbook still says the sandbox image runs Node 22, which S12 changed.
tags: [area/agents, area/wiki]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Correct the line in S12's open follow-up (PR 40, the Ubuntu 26.04 image), or after it merges, so it names the final base image.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "INFERRED: the S08 verifier at 3cc809e reported the line, at the time line 288 of the runbook (2026-10-18)."
---

## Problem

[[Run Sandcastle on GitHub issues]] says in one place that the sandbox image is on Node 22, while the
Dockerfile and the runbook's Known notes moved to Node 24 in S12 (PR 34). An operator could blame Node 22 for a failure
with another cause.

## Desired outcome

Every runbook line agrees with `.sandcastle/Dockerfile`.

## Next step

Fix the line on PR 40's branch, which already changes the sandbox image, or in a records pull request after it merges.
