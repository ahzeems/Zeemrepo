---
type: ticket
title: S06 Exact PR destination and head identity
summary: Bind the pushed commit and reused or created PR to the intended repository, main base, source branch and head SHA.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S03/S05 completion, then test mismatched GitHub destinations and PR heads.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S03 Fresh pinned main revisions]]", "[[S05 Checked-commit publication invariant]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S06, finding A05 and its S03/S05 prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make a successful PR handoff identify the same repository, branch and checked commit that was pushed.

## Inputs

- Plan S06, audit A05 and the landed readiness/publication state contract.
- Inspect every `gh` and Git push call in `scripts/git/pr-ready.ts` and existing response fixtures.

## Approach

1. Establish one intended push/PR repository identity from trusted checkout configuration.
2. Scope GitHub calls explicitly and request/validate the existing PR's base and source identities and head SHA.
3. Reuse only the correct open PR; describe errors precisely without reporting an unrelated PR as success.

## Acceptance criteria

- [ ] A correct existing PR is reused and the correct absent PR is created for the captured commit.
- [ ] Wrong repository, non-main base, unexpected source repository/branch and stale head refuse a successful handoff; an unrelated existing PR is not silently retargeted.
- [ ] `GH_REPO` or gh defaults cannot silently redirect the handoff away from the intended push destination.
- [ ] Malformed/failed GitHub responses fail visibly; machine-account and code-owner checks remain enforced.
- [ ] No mismatch case reports success for the wrong PR.

## Out of scope

New account authorization, fork creation, changing CODEOWNERS and bypassing approval requirements.

## Allowed files

- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`; `scripts/sandcastle/afk.ts` and its tests only if a shared identity/result contract requires adjustment.
- `wiki/reference/Merge gate contract.md`, `wiki/runbooks/Land a change.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; especially `.github/CODEOWNERS`, branch rulesets and credential stores.

## Human checkpoints

Verify job approval and parent landings. A live publication trial needs explicit authorization and the machine account; offline controls are sufficient for the regression suite.

## Secrets needed

None for tests. Any authorized live trial uses an existing scoped credential without copying its value into files or evidence.

## Tests and evals

- `node --test scripts/git/pr-ready.test.ts "scripts/sandcastle/afk*.test.ts"`; `npm run check`.
- Positive: exact repository/main/source/head response and correct missing-PR creation.
- Broken: each identity field mismatched separately, closed/merged stale PR, hostile defaults, missing fields and failed calls. Verify arguments and returned outcome through the actual publication function.

## Rollback and recovery

If a push succeeded but PR creation failed, report that durable state and recover without force-pushing or opening duplicate PRs. Repair/revert code through the normal PR path.

## Evidence

Record the tested repository/base/source/SHA matrix, captured command arguments, outcomes and independent verdict; distinguish mocks from any live trial.

## Wiki and doc updates

Document the exact identity checks and post-push recovery boundary; update this ticket and changelog.
