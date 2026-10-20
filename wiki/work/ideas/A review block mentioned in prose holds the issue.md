---
type: idea
title: A review block mentioned in prose holds the issue
summary: Since S09 fails closed on an unclosed review block, a reviewer that writes the word <review> in prose after its verdict gets its issue held.
tags: [area/agents]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide, with evidence from a first live review, whether chatty reviewer output causes false holds before changing the parser.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S09 Explicit phase outcomes and review eligibility]]"]
evidence:
  - "INFERRED: the independent verifier of PR 45 at f19d838 reported (LOW, no change needed) that a later <review> mentioned only in prose holds the issue as an unclosed block, a possible false hold that fails closed (2026-10-18)."
  - "UNKNOWN: whether a real reviewer model writes such prose; no live review has run."
---

## Problem

The verdict parser treats a `<review>` opener after the last closed block as truncated output and holds the issue. That is the safe choice, but a reviewer that ends with a sentence such as "I ended with a `<review>` block" is also held, and the issue waits for another round.

## Desired outcome

False holds from prose are measured on real reviewer output, and the prompt or parser changes only if they occur.

## Next step

Count false holds in the first live Sandcastle runs; until then the runbook's rule stands.
