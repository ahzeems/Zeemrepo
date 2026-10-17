---
type: ticket
title: S10 Blocked-queue planning contract
summary: Keep blocked issues out of execution and represent empty and blocked queues as explicit non-executing outcomes.
tags: [area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S09 completion, then remove the planner's dependency-waiver fallback and test the actual selection boundary.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S09 Explicit phase outcomes and review eligibility]]"]
related: ["[[Define Sandcastle partial-failure outcomes]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S10, finding A11 and its S09 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Prevent the planner from deliberately selecting blocked work and preserve explicit empty/blocked queue outcomes.

## Inputs

- Plan S10, audit A11, `.sandcastle/plan-prompt.md` and `scripts/sandcastle/plan-schema.ts`.
- S09's landed outcome contract and coordinator selection tests.

## Approach

1. Remove instructions that waive dependencies when no issue is eligible.
2. Validate the planner result needed to distinguish no work, blocked work and eligible work.
3. Reject contradictory known dependency/eligibility declarations before starting workers, retaining existing ID/branch/title validation.

## Acceptance criteria

- [ ] An all-blocked result starts no worker and reports blocked work without claiming issue completion.
- [ ] An empty queue starts no worker and remains distinct from failed execution.
- [ ] Declared blocked candidates cannot be scheduled; eligible candidates still run.
- [ ] Invalid IDs, duplicate issues, unsafe branches and malformed result combinations remain refused.
- [ ] Tests separate mechanically validated dependency metadata from unverified natural-language model reasoning.

## Out of scope

Automatically rewriting issue dependencies, adding a new issue tracker or claiming model interpretation is proven by a fake planner.

## Allowed files

- `.sandcastle/plan-prompt.md`, `scripts/sandcastle/plan-schema.ts`, `scripts/sandcastle/plan-schema.test.ts`.
- `scripts/sandcastle/coordinator*.ts`, `scripts/sandcastle/run-result*.ts` and relevant coordinator test support.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files and real GitHub issue state; no automatic dependency overrides.

## Human checkpoints

Verify job approval and S09 landing. Raise ambiguous dependency semantics as an owner question rather than scheduling the least-blocked issue.

## Secrets needed

None; use controlled issue snapshots and fake planner outputs.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Positive: empty, wholly blocked and eligible queues produce their respective outcomes.
- Broken: a selected issue also declared blocked, malformed status/issue combinations and duplicate identities. Assert worker invocation count and structured outcomes through the real coordinator.

## Rollback and recovery

Keep blocked work pending with its reason. If selection cannot be established, refuse execution rather than restoring the dependency-waiver fallback.

## Evidence

Record validated input/output cases, worker selection and exits, with model-reasoning limits and independent review.

## Wiki and doc updates

Align the prompt, schema and runbook descriptions of eligibility. Record the implementation PR in this ticket.
