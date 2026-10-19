---
type: idea
title: Shell characters in the host branch name await an owner decision
summary: Sandcastle 0.12.0 builds shell commands from the host branch name, so the owner must decide whether the coordinator refuses shell metacharacters in it.
tags: [area/agents, area/git, area/shell]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Owner decides whether the Sandcastle commands refuse a host branch name holding shell metacharacters; nothing else moves this item.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S11 Non-executable branch inputs]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "INFERRED: the S11 ticket's Discovered work on origin/fix/s11-branch-inputs (PR 50) records that the SDK builds host and sandbox shell commands from branch names, that the head strategy the planner and merger use by default passes the host branch, that double quotes do not stop $(...), and that refusing such names is an owner decision because it broadens branch restrictions (2026-10-18)."
  - "INFERRED: the same ticket records that the coordinator only hands the SDK sandcastle/issue-<N> names, so the host branch name is the only free input."
  - "VERIFIED: on origin/fix/s11-branch-inputs at aff82d8, step 2 of the Sandcastle runbook tells operators to keep $, backticks, quotes, ;, |, & and other shell characters out of their branch name until it is established whether they run."
  - "VERIFIED: on 2026-10-19 node_modules/@ai-hero/sandcastle at version 0.12.0 contains git merge \"${resolvedBranch}\" (dist/chunk-VOG34SRF.js line 26051) and git config --global --add safe.directory \"${sandboxRepoDir}\" (dist/index.js line 1950; line 2078 has the same command with ${sandboxRepoDir2})."
  - "UNKNOWN: whether a shell command runs with the host branch name on the docker path; S11 did not test it."
---

## Problem

Sandcastle builds some shell commands itself by placing a branch name inside double quotes, and
double quotes do not stop `$(...)`. A host branch named with shell characters could run a command
on the host when the planner or merger starts. Today only the runbook warns operators. Refusing such
names in code narrows which branch names the Sandcastle commands accept, which only the owner can
decide.

## Desired outcome

The owner's answer is recorded. If the owner chooses refusal, a build ticket makes the Sandcastle
entry points refuse a host branch name outside a safe character set before any SDK call.

## Next step

Awaiting the owner's decision. Pending decision, not a build task.
