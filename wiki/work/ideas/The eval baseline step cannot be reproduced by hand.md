---
type: idea
title: The eval baseline step cannot be reproduced by hand
summary: The block-pr-merge hook refuses git push origin main even to a local bare repository in a scratch directory, so a session cannot reproduce the compliance harness's baseline step by hand.
tags: [area/evals, tool/claude-code]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan a fixture-driven command or test that runs the harness baseline step end to end, without loosening the hook.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S23 Benchmark-clean evaluation snapshots]]"]
evidence:
  - "INFERRED: the S23 builder recorded in the ticket's Discovered work that the hook refuses the push to a local bare repository (2026-10-18)."
  - "INFERRED: the independent verifier of PR 47 at 98826a0 reported the live harness path (bubblewrap run, local origin, baseline commit) as UNKNOWN (2026-10-18)."
---

## Problem

The compliance harness builds a baseline by pushing to `main` of a local bare origin. The merge-blocking hook refuses any push to `main` from a session, whatever the remote, so neither the builder nor the verifier could run that step to check the snapshot in place. The live path stays unverified.

## Desired outcome

The baseline step runs under test against a temporary repository, so its result is checked without a manual push.

## Next step

Find the narrowest seam in the harness to drive the baseline from a test; the hook stays as it is.
