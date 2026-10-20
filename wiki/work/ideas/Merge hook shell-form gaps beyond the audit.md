---
type: idea
title: Merge hook shell-form gaps beyond the audit
summary: Several shell forms still pass the merge and push-to-main hook; they are not closed, and only S25's open branch (PR 36) lists them in the Merge gate contract.
tags: [area/agents, tool/claude-code, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan which of these forms the heuristic hook should refuse, and record why the rest stay limits.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Merge gate contract]]"]
evidence:
  - "INFERRED: S25's implementer and two verifiers reported each form permitted when passed to the hook as data on 2026-10-18."
---

## Problem

These forms pass the hook. They were found by S25's implementer and verifiers and are outside finding A22:

- `eval`, also under `if`;
- `coproc`;
- a heredoc opener inside quotes or a comment, or an arithmetic shift;
- `$(case ...)` inside a heredoc;
- a doubled backslash before `$(` at top level;
- a backtick substitution inside double quotes;
- a delimiter that `\w+` cuts short.

The hook is a heuristic and the ruleset is the control, but each gap is cheap to probe.

## Desired outcome

Each form is either refused with a test or named in the contract with the reason it stays a limit.

## Next step

Decide per form after [[Merge hook ignores commands after a heredoc opener]], which matters most.
