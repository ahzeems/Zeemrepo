---
type: idea
title: Governance guard does not refuse the old token expiry claim
summary: S26 replaced the runbook claim that a new token's expiry date must differ, but config/governance-alignment.json does not list it, so the guard would not refuse it if it came back.
tags: [area/github, area/compliance]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan adding the replaced expiry claim to config/governance-alignment.json with a failing control.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S26 Evidence-based token setup guidance]]"]
evidence:
  - "INFERRED: the S26 builder recorded in the ticket's Discovered work that the governance guard could refuse the replaced claim if it were listed (2026-10-18)."
  - "VERIFIED: on main at caa99e3, config/governance-alignment.json contains no occurrence of expiry."
---

## Problem

The change-records rule says a replaced rule is listed in `config/governance-alignment.json` so the governance guard refuses text that still asserts it. S26 retired the advice that an unchanged expiry date shows the old token is still in place, but did not list it, because the file was outside the ticket's scope.

## Desired outcome

Text that reasserts the retired expiry advice fails `npm run governance:check`.

## Next step

Plant the old sentence in a fixture, show the guard missing it, then add the entry.
