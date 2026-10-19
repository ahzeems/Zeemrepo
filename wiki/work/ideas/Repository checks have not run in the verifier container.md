---
type: idea
title: Repository checks have not run in the verifier container
summary: Only the fixture's single check has run in a real verifier container; the repository's own check:base links and the Python safe-path guard have run only on the host.
tags: [area/agents, area/compliance]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan a CI control that runs this repository's check:base inside the verifier container on a fixture candidate, or fold it into the first live run.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S15 Independent isolated verification receipts]]"]
evidence:
  - "INFERRED: the independent verifier of PR 49 at 54f7215 and 1654e5c reported that the real-container evidence covers only the fixture's node check, and that the Python guard and the real check:base leaves ran only on the host (Python 3.15), not in the guest (Python 3.14) (2026-10-18)."
  - "VERIFIED: main CI run 39169338254 at caa99e3 printed the verifier-control line, which describes the fixture candidate only."
---

## Problem

A receipt says a candidate passed the base's checks inside the verifier container. The CI control proves that path for a one-check fixture. Whether every link of this repository's `check:base` passes inside the container image is not shown, and the guest has a different Python version from the host where the guard was tested.

## Desired outcome

A required CI step runs the real `check:base` in the container, so a receipt for this repository is known to be obtainable.

## Next step

Measure how long the real chain takes in the container on CI before choosing between a CI step and the first live run.
