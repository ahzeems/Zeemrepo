---
type: idea
title: test_run_comply.py is over the 800-line limit
summary: evals/compliance/test_run_comply.py has 809 lines, over the 800-line file limit that applies to tests, and no check enforces the limit for Python.
tags: [area/evals, kind/convention]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Plan splitting test_run_comply.py by area and a check that runs the file-size limit on Python files.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S23 Benchmark-clean evaluation snapshots]]"]
evidence:
  - "INFERRED: the S23 builder recorded the overrun in the ticket's Discovered work, and the PR 47 verifier confirmed 809 lines at base and head (2026-10-18)."
  - "VERIFIED: on main at caa99e3, wc -l reports 809 lines for evals/compliance/test_run_comply.py."
---

## Problem

The design rule keeps files under 800 lines, tests included, and `eslint.config.ts` enforces it for TypeScript. The Python compliance tests have no such check, and the main test file has grown past the limit. S23 put its own tests in a new file to avoid growing it.

## Desired outcome

The file is split below the limit, and a check that `npm run check` runs refuses a Python file over it.

## Next step

Show a check missing the overrun, add it, then split the file without changing any test.
