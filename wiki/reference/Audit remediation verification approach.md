---
type: reference
title: Audit remediation verification approach
summary: Verification seams for the approved remediation plan, using real Git fixtures, the actual orchestration with fake agents, container boundary controls and offline evaluation outcomes.
tags: [area/planning, area/agents, area/evals]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: active
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
---

On 2026-10-16, after this verification approach was presented, the owner directed the agent to
proceed and complete the PR for merge. These seams are included in
[[Repository audit remediation implementation plan]], approved by the owner's verified merge of
[PR 15](https://github.com/Zimfra/software_testing/pull/15). The future tests are implementation
work; plan approval does not claim they already exist or pass.

## Why these seams

The audit found gaps despite high helper-test coverage. The proposed tests exercise the actual
boundary responsible for each behavior. Mocks remain useful at external service/model edges,
but a mocked loop cannot prove that the real coordinator propagates failure, and an in-memory
check cannot prove container containment.

## Verification layers

| Seam | Findings and behavior | Existing prior art | Required positive and broken controls |
|---|---|---|---|
| Real temporary Git repositories and CLI boundaries | A02-A09: fixture routing, checked state, PR identity, fork history and fetched refs; import/ref identity for A01 | `scripts/test-support/repo-fixture.ts`, Git-state, PR-ready and landing-audit tests | Correct fixture/repository/SHA passes. Inherited decoy routing, dirty-to-dirty content changes, moved checked SHA, wrong PR base/repository, stale tracking refs and invalid fork boundaries refuse. |
| Actual coordinator with fake model/service adapters | A10-A13: eligibility, review sequencing, total/partial failure, retries and branch argument handling | `scripts/sandcastle/afk.test.ts`, `afk-guard.test.ts`, `plan-schema.test.ts`; existing wrapper harness replaces the loop | A complete fake run succeeds; failed creation/review/integration or exhausted work reports incomplete/nonzero. Blocked work stays blocked. Legal branch input never becomes executable shell text. |
| Real disposable-container boundary with a fake agent | A01 and A14: complete isolation, toolchain, transfer, fresh verification and controlled publication | Current Dockerfile and pinned SDK; local bundle experiment in the research ticket | The real SDK create/cleanup path runs inside the disposable boundary. Harmless planted hook/fsmonitor sentinels never execute on the host. Missing container support, malformed artifacts, forged/stale evidence or an unverified integration commit cannot produce a publishable success. |
| Real document and hook validators against valid/broken artifacts | A15, A19-A22: privacy traversal, actual Markdown headings, companion provenance, immutable history and shell backstops | Existing redaction, schema, provenance, wiki-compliance and block-pr-merge tests; valid/broken CLI fixtures | Valid sandbox paths, visible headings, authorized revisions and legitimate commands pass. Role-identity traversal, hidden headings, unapproved companion changes, forbidden historical edits and the audited command forms refuse. |
| Offline evaluation artifacts and outcomes | A17-A18: benchmark-clean snapshots and complete scoring requirements | `evals/compliance/test_run_comply.py`, in-memory archives, pinned specs and standard-library tests | A clean operational snapshot and compliant outcome pass. Seeded score/rubric leaks, prohibited actions, a warning-only guard, missing wiring or missing required records fail independently. |

All new automated checks must be wired into the canonical check path or a required CI job in
the same slice. The container runner does not exist yet; its implementation slice must add it,
document the command and prerequisites, and wire it into an existing required CI check on a
Docker-capable runner. Routine authoring checks should not acquire a local Docker prerequisite;
the container proof can be supplied by a matching-head CI run. A
missing container runtime is blocked proof, not a passing test. No paid model call is needed for
these proposed regression controls.

For A16, review the token instructions against primary service documentation and separate what
identity/expiry reads prove from what a write-capability test proves. Any authenticated write
trial remains an explicit owner-controlled checkpoint. Do not claim that a mock establishes
real token permissions.

## Sequencing

[[Repository audit remediation implementation plan]] owns the slices, finding coverage and
dependency order. It begins with fixture containment and establishes the real container control
early. Build tickets are created from the owner-approved plan; this reference owns the verification
approach rather than maintaining a second task list. No audit finding has an approved deferral.

## Evidence requirements

- Each defect has an observed failing control before its repair and a passing result afterward.
- Record the exact commit, command, runtime and result; preserve the distinction between mock,
  local Git, real container, authenticated service and live-model evidence.
- An independent verifier judges the final candidate or integration SHA, not an implementer's
  summary. Changed commits invalidate old verification evidence.
- For the isolation design, builder output cannot authorize itself: the receipt must come from
  trusted supervision and bind the candidate, base, check/reviewer version and results.
- Full repository checks and the ticket's own controls precede publication. Approval and merging
  remain separate owner actions under the existing workflow.
