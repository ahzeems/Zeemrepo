---
type: idea
title: The Sandcastle runbook has unwrapped long lines
summary: S26 left two prose lines in the Sandcastle runbook unwrapped, and 41 of its lines are longer than 100 characters; no rule or check sets a line length for wiki pages. A minor, cosmetic gap.
tags: [area/docs, area/wiki]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Owner decides whether wiki prose has a line-length convention; if so, re-wrap the runbook in a docs-only branch and add the rule where it can be checked.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S26 Evidence-based token setup guidance]]"]
evidence:
  - "INFERRED: the independent verifier of PR 46 at aed8422 reported (LOW, cosmetic) that the S26 edits left two runbook lines unwrapped, then at lines 459 and 474 (152 and 134 characters) (2026-10-18)."
  - "VERIFIED: on main at caa99e3, 41 of the 637 lines in wiki/runbooks/Run Sandcastle on GitHub issues.md are longer than 100 characters, and wiki:lint passes."
---

## Problem

Most of the runbook wraps prose near 110 characters, but edits over time have left long lines, two of them from S26. Long lines make diffs of later edits harder to read. Nothing in the repository states a line length for wiki prose, so this is a style question, not a broken rule. The agent filing this judges it minor.

## Desired outcome

Either a stated convention with a check, or a recorded decision that wiki prose has no line length.

## Next step

Ask the owner whether a convention is wanted before any re-wrap.
