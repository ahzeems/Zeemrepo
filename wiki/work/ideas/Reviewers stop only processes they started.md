---
type: idea
title: Reviewers stop only processes they started
summary: A verifier killed processes by matching a name pattern and interrupted another agent's git commit; reviewers should stop only processes they started, by exact PID.
tags: [area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Add the exact-PID rule to the verifier and finder briefs in .claude/agents/ through a plan.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Parallel agents can overload the authoring machine]]"]
evidence:
  - "INFERRED: the S13 ticket records that, per the coordinator's relay of the third verifier report, a verifier's process kill interrupted another session's commit (2026-10-18)."
  - "VERIFIED: on 2026-10-18 grep found no rule about stopping processes in .claude/agents/verifier.md or .claude/agents/finder.md."
---

## Problem

Verifiers run mutation and load probes and sometimes need to stop a stuck process. On 2026-10-18 one stopped
processes by matching a pattern, which also matched another agent's `git commit` in a different worktree.

## Desired outcome

Every reviewer and agent brief says to stop only processes it started, by exact PID, and never by name or pattern.

## Next step

Add the sentence to the two agent briefs and to the coordinator's brief template in one plan with the
concurrency limit.
