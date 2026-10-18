---
type: idea
title: Merge hook ignores commands after a heredoc opener
summary: The merge and push-to-main hook drops everything after a heredoc opener on the same line, so a blocked command placed there passes.
tags: [area/agents, tool/claude-code, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P1
next_action: Plan a hook change that judges the text after a heredoc opener as commands, with refusing tests.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Merge gate contract]]"]
evidence:
  - "INFERRED: the S25 re-verifier at 9a355c1 reported these forms permitted on base, 4cc84ef and 9a355c1 (2026-10-18), with the commands passed only as data."
---

## Problem

`scripts/claude/block-pr-merge.ts` keeps only the text before a heredoc opener on its line. A command after
the opener on that line, such as `; gh pr merge`, `&& git push origin main`, `| gh pr merge`, or a
substitution in a redirect target, is never judged. This is on base, not caused by S25.

## Desired outcome

Text after an opener on the same line is read as commands, and the forms above are refused.

## Next step

Add the forms as failing tests, then fix. S25's new heredoc scanner already exposes the text after the opener.
