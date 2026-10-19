---
type: idea
title: Obsidian comments and math blocks still hide headings that count
summary: A required section inside an Obsidian %% comment, a $$ math block or a hidden div still satisfies the wiki section check, although Obsidian does not show it.
tags: [area/wiki, tool/obsidian]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a test-first change to missingSections in scripts/wiki/schema.ts that refuses headings inside %% comments and $$ blocks, with the hidden div as a decided case.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S20 Real Markdown section validation]]"]
evidence:
  - "INFERRED: the independent verifier of PR 44 at 1ca4664 reported (LOW, outside the ticket) that %% then ## Fix then %% still satisfies a section, and named the $$ and <div hidden> forms as untested; its review at 1818175 left them open, recorded in the S20 Discovered work (2026-10-18)."
  - "VERIFIED: on main at caa99e3, missingSections from scripts/wiki/schema.ts returned no missing section for ## Fix wrapped in %% lines, in $$ lines, and after <div hidden> and a blank line, while the same heading in an HTML comment was reported missing (probe run 2026-10-18 by Claude Code, Opus 5.5)."
---

## Problem

S20 made the section check read real CommonMark, so headings in HTML comments and fences no longer count. The wiki is an Obsidian vault (ADR-0001), and Obsidian hides more than CommonMark does: a heading between `%%` lines or between `$$` lines is not shown as a heading in Obsidian, but CommonMark parses it as one. No current note starts a line with `%%`, so nothing passes this way today.

## Desired outcome

A section required by the schema counts only when Obsidian would also show it as a heading, or the schema page states which hidden forms still count and why.

## Next step

Write failing cases for the `%%` and `$$` forms in `scripts/wiki/schema.test.ts`, decide the `<div hidden>` case with the owner, then change the token filter.
