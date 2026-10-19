---
type: idea
title: Wikilink scan strips code with regular expressions
summary: withoutCode in the wiki validator removes code and comments with regular expressions, so a wikilink example in an indented code block or a fence inside a list still counts as a link.
tags: [area/wiki, area/typescript]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan replacing withoutCode in scripts/wiki/wiki-validation.ts with the shared markdownTokens parser, test first.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S20 Real Markdown section validation]]"]
evidence:
  - "INFERRED: the S20 builder recorded in the ticket's Discovered work that withoutCode misses indented code blocks and fences inside lists, and that it could reuse markdownTokens (2026-10-18)."
  - "VERIFIED: on main at caa99e3, scripts/wiki/wiki-validation.ts still defines withoutCode at line 31 and the wikilink scan at line 36 runs on its output."
---

## Problem

S20 moved section detection onto a real Markdown parser, but the wikilink scan still uses its own regular expressions to drop code and comments. Two code forms survive them: indented code blocks and fenced blocks inside list items. A wikilink written there as an example is then checked as a real link.

## Desired outcome

The link scan and the section check read the same parsed tokens, so code is ignored the same way in both.

## Next step

Add failing cases for an indented code block and a fence in a list, then switch the scan to `markdownTokens` from `scripts/lib/markdown.ts`.
