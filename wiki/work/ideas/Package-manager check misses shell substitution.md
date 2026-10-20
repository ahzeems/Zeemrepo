---
type: idea
title: Package-manager check misses shell substitution
summary: The verifier driver refuses base checks that call a package manager, but a name built by shell substitution, such as $(printf np)m test, passes. Only a hostile base could do this.
tags: [area/agents, area/shell]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide whether base check commands should be restricted to a plain allowlist form, then plan the test with $(printf np)m as the control.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the independent verifier of PR 49 at 54f7215 and 1654e5c reported, as an info item it did not count because the base is owner-merged, that $(printf np)m test and x=np; ${x}m pass DELEGATES (2026-10-18)."
  - "VERIFIED: on main at caa99e3, the DELEGATES pattern from scripts/sandcastle/verifier-driver.ts line 38, applied as line 91 applies it, returned false for $(printf np)m test and x=np; ${x}m test and true for npm test (node probe run 2026-10-18 by Claude Code, Opus 5.5)."
---

## Problem

A base check that runs a package manager would read the candidate's scripts, so the driver refuses such commands by name. The name test reads the command text, and shell substitution builds the name at run time. The base is owner-merged, so this needs a hostile base, which the reviewer judged out of reach.

## Desired outcome

Base check commands are either parsed into a form the driver can judge, or this limit is recorded as accepted.

## Next step

Owner decides whether defence against a hostile base is in scope.
