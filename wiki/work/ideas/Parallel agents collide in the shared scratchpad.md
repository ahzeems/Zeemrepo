---
type: idea
title: Parallel agents collide in the shared scratchpad
summary: Agents working in parallel share one scratch directory, and on 2026-10-18 one overwrote another's PR-body file, so a PR briefly showed the wrong description.
tags: [area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a per-agent scratch directory convention for parallel work, in the brief or the harness setup.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: the S19 and S13 agents each reported a collision on 2026-10-18; the S13 agent reported the PR 37 body briefly holding S06's text."
---

## Problem

The parallel batch on 2026-10-18 shared one scratchpad. Generic file names collided: one agent's
commit-message file was overwritten, and the S13 agent posted S06's PR description onto PR 37 for about a
minute before correcting it.

## Desired outcome

Each parallel agent writes scratch files only under its own directory, so no file can be overwritten.

## Next step

Write the convention into the runbook that covers parallel agents, and use it in every brief.
