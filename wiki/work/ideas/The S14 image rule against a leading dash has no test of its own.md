---
type: idea
title: The S14 image rule against a leading dash has no test of its own
summary: S14's only test of an option-like image name uses -eGH_TOKEN, which the pattern refuses for its upper case, so a pattern allowing a leading dash would still pass.
tags: [area/agents, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Add a test with an all-lower-case option-like name such as -ehome and show it fails on a pattern that allows a leading dash.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S14 Isolated coordinator preparation and export]]", "[[The S14 image-name check refuses some valid Docker references]]"]
evidence:
  - "INFERRED: the coordinator relayed the verifier's report at e33b1b9 (PR 62, open, not on main yet, 2026-10-19), which lists this as low finding L2: a mutant pattern that allows a leading dash survives the tests."
  - "VERIFIED: at e33b1b9, scripts/sandcastle/isolated-run.test.ts line 209 tests the image -eGH_TOKEN, and the pattern at isolated-run.ts line 57 allows only lower case after the first character (git show on 2026-10-19). This code exists only on open PR 62, not on main; recheck these lines if PR 62 changes before it merges."
---

## Problem

The rule that an image name starts with a letter or digit keeps it from reading as a Docker
option. Its test value also contains upper-case letters, which the pattern refuses anyway, so the
test passes whether or not the leading-dash rule exists.

## Desired outcome

A test whose only fault is the leading dash, so removing the rule fails it.

## Next step

Fold into the next S14 follow-up branch.
