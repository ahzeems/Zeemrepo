---
type: idea
title: Pre-push state check misfires when agents share a repository
summary: Parallel agents in worktrees of one repository share refs and config, so each npm run pr sees the others' changes and git-state refuses the push.
tags: [area/git, area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan whether git-state should compare only the pushing worktree's own refs and config.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "INFERRED: on 2026-10-18 the S06, S08, S19 and S25 agents each reported npm run pr refusing with refs changed or local git config changed while other agents committed; S06 needed six attempts."
---

## Problem

`git-state` snapshots every ref and the local config around `npm run check`, then refuses the push if
anything moved. Worktrees of one repository share both. When five agents worked in parallel on 2026-10-18,
their `npm run pr` runs refused each other: one needed six attempts.

## Desired outcome

Parallel agents can publish without false refusals, while a check that changes the pushing checkout's own
state is still refused.

## Next step

Reproduce it with two fixture worktrees in a test, then decide which refs and keys belong to a worktree.
