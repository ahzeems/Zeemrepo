---
type: idea
title: Wiki privacy scan allows the sandbox home path
summary: The privacy scan flags every home path with a username; the Sandcastle sandbox runs as the role-name user agent, so its files could not name the workspace until the scan allowed that one home.
tags: [area/git, area/agents]
created: 2026-10-14
updated: 2026-10-18
agent: claude-code
status: done
owner: human
priority: P2
next_action: None. The scan change landed as f97761d; S19 later confined the exception.
evidence:
  - "VERIFIED: GitHub's guards job on the Sandcastle integration pull request ran main's wiki-lint against the branch and reported seven home-path findings (six in the sandbox Dockerfile, one in the changelog), which is why the scan rule ships as a pull request of its own (2026-10-14)."
  - "VERIFIED: scripts/wiki/redaction.test.ts has 37 tests; against main's pattern the case named the role-name home agent is allowed, and every other home path is flagged for every login fails (1 of 37), and with the new pattern 37 of 37 pass (2026-10-14). It covers the allowed path, a longer account name, a different case, a bare path and a path that climbs out of the home."
  - "VERIFIED: npm run check exits 0 on this branch, which is current with origin/main at 927c9d1."
  - "VERIFIED: on 2026-10-18 git log showed the scan change on main as f97761d."
  - "INFERRED: correction of 2026-10-18. Audit finding A15 and an independent verifier of PR 41 found that the climb-out case above ran under a personal login, where the exemption never applied, so it did not prove that a climb out of the role home is flagged. Under a neutral identity such a climb got no finding until S19 Privacy exception confinement (PR 35) confined the exception."
---

## Problem

The privacy scan treats every `/home/<name>` path as a personal home directory. The Sandcastle
sandbox image runs as the user `agent`, a role name, and its workspace lives under that home, so
the Dockerfile and the runbook could not write the path without failing `wiki:lint`.

## Desired outcome

Only a path under the role-name home is allowed, nothing else changes: a longer account name that
starts with the same letters, another case, and any other username stay flagged.

## Next step

Owner review. The change is the home-path pattern in `scripts/wiki/redaction.ts` and its tests.

## Observations

- [no-doc-change: the scan's behaviour is documented by its tests and the privacy checklist in the
  wiki-memory skill, which already says home paths with a username are flagged; this narrows one
  case and adds no rule or workflow step]
- The Sandcastle integration pull request cannot carry this change itself: the guards job runs
  main's scripts, so a pull request that edits the scan is judged by the old scan.
