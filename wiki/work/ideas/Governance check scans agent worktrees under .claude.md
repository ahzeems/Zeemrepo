---
type: idea
title: Governance check scans agent worktrees under .claude
summary: governance:check skips .worktrees but not .claude/worktrees, where agent isolation puts worktrees, so npm run check fails in the main checkout while agents work.
tags: [area/compliance, area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan whether governance:check lists files through git (tracked and unignored) or also skips .claude/worktrees, with a refusing test.
related: ["[[Improvement loop turns every finding into tracked work]]"]
evidence:
  - "VERIFIED: on 2026-10-18 a commit in the main checkout was refused by the pre-commit lint, which reported an unused variable in .claude/worktrees/agent-*/scripts/sandcastle/containment-smoke.ts, another agent's work in progress."
  - "VERIFIED: on 2026-10-18 scripts/governance/governance-guard.ts skips only node_modules and .worktrees at the root (ROOT_SKIPPED), and its findings in the main checkout included files under .claude/worktrees/agent-*, which .gitignore line 5 ignores."
---

## Problem

`npm run governance:check` walks the file system instead of the files git tracks. It skips `node_modules` and
`.worktrees`, the directory the repository rules name for parallel sessions. Claude Code's agent isolation
creates worktrees under `.claude/worktrees/` instead, which `.gitignore` already ignores. While agents work,
each agent's copy of the repository is scanned as if it were part of the main checkout. That makes
`npm run check` fail there with findings that belong to no tracked file.

The pre-commit lint has the same blind spot: ESLint linted another agent's in-progress file under
`.claude/worktrees/` and refused an unrelated commit in the main checkout.

## Desired outcome

`governance:check` and the lint run judge only the repository's own files, whichever tool created the worktrees.

## Next step

Decide between listing files through git and adding the directory to the skip list. Then write the refusing
test first.
