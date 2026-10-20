---
type: ticket
title: S03 Fresh pinned main revisions
summary: Make readiness and audit callers compare against an explicitly refreshed and pinned main commit, including narrowed fetch refspecs.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges its pull request; S07 Fork-only landing assurance then has its only parent complete, and S13 also waits on it.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S02 Explicit-checkout command routing]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S03, finding A09 and its S02 prerequisite."
  - "OWNER DECISION: job-spec approval is PR 17, merged after an APPROVED code-owner review; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parent S02 landed as PR 21 (5d56a42); this branch starts from 6a28e1d."
  - "VERIFIED: at red commit e18fff2, with a real local bare origin, remote.origin.fetch narrowed to another branch and refs/remotes/origin/main left at an older commit, npm run audit passed over a direct push and npm run pr passed a branch behind main; the tests for an origin without main already errored."
  - "VERIFIED: at fix commit 0770e83, node --test on scripts/git, the AFK tests and scripts/lib/git.test.ts passed 268 of 268; an unrelated refs/remotes/origin/other stayed at its commit; and making readiness re-read the tracking ref instead of the captured commit failed the moved-ref test."
  - "VERIFIED: an independent verifier at b39254e rated all five criteria MET: the base code failed exactly the two narrowed-refspec tests, its own probe saw fetchMain return the advertised main with no tracking ref, and a tree, blob or tag of a tree as origin main each threw."
  - "VERIFIED: an independent finder at b39254e reported no CRITICAL or HIGH issue and no change in exit semantics; after it, tests cover fetchMain with a narrowed refspec and no tracking ref, an unreachable origin in both fetchMain and npm run pr, and a main naming a tree, whose test fails when ^{commit} is removed."
  - "INFERRED: a fetch that hangs cannot pass, because lib/git.ts and spawnRunner stop git at their timeouts and treat it as a failure; the existing hung-step test in pr-ready.test.ts exercises spawnRunner's timeout only, and no fetch-specific or lib/git.ts timeout test exists."
  - "UNKNOWN: review of the head after these tests is pending; the PR body records it."
---

## Goal

Ensure successful fetch/readiness checks use the intended remote main revision rather than a stale tracking ref.

## Inputs

- Plan S03 and audit A09; inspect `pr-ready.ts`, `landing-audit.ts` and AFK's existing explicit-destination fetch.
- Read S02's landed runner contract and existing local bare-origin fixtures.

## Approach

1. Reproduce success into FETCH_HEAD while a narrowed mapping leaves origin/main stale.
2. Refresh the intended destination explicitly and capture the verified commit used by later comparisons.
3. Apply the same boundary behavior to relevant callers, preserving before/after-loop refusal versus failure semantics.

## Acceptance criteria

- [x] The old readiness/audit path fails a stale-ref control backed by a real local bare origin.
- [x] A successful refresh identifies the correct main commit even with narrowed refspecs or an absent tracking ref.
- [x] Unreachable origin, timeout, missing main and unreadable/noncommit results cannot become a passing comparison.
- [x] Later comparisons use the captured revision; unrelated remote refs are not rewritten.
- [x] Targeted Git/Sandcastle tests and the full check pass.

## Out of scope

Changing audit scope, PR destination semantics, authenticated services or general network retries.

## Allowed files

- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`, `scripts/git/landing-audit.ts`, `scripts/git/landing-audit.test.ts`.
- `scripts/sandcastle/afk.ts`, `scripts/sandcastle/afk*.test.ts`, `scripts/lib/git.ts`, `scripts/lib/git.test.ts`.
- `wiki/reference/Merge gate contract.md`, this ticket and `CHANGELOG.md`.

## Forbidden files

All other files; never change the real origin or fetch configuration as a regression fixture.

## Human checkpoints

Verify approval and parent landing. Ask before altering public exit semantics or introducing a new retry policy.

## Secrets needed

None. Use local bare origins and scripted failures, not live GitHub credentials.

## Tests and evals

- `node --test "scripts/git/*.test.ts" "scripts/sandcastle/afk*.test.ts"`; `npm run check`.
- Positive: normal and narrowed mappings both capture the advertised main SHA.
- Broken: a preexisting stale ref plus narrowed mapping, failed fetch, absent main and changed ref after capture. Check the compared SHA, not just fetch exit status.

## Rollback and recovery

Retain failing fixture logs before cleanup. Repair/revert through a new PR; never reset or rewrite the real remote-tracking refs to imitate the test.

## Evidence

Record the advertised, fetched and compared fixture SHAs, each error case's exit, and independent verification.

## Wiki and doc updates

Describe exactly what freshness is established in the merge-gate contract and update this ticket's completion evidence.
