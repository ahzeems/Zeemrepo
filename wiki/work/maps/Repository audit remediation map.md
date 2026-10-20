---
type: map
title: Repository audit remediation map
summary: The owner choices and source-level isolation research are resolved and recorded in the remediation implementation plan approved through PR 15.
tags: [area/planning, area/agents]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P1
next_action: Obtain owner approval of the proposed job specs linked from the plan, then begin S01 Fixture Git containment.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
evidence:
  - "VERIFIED: the repository's Idea to execution workflow requires decisions to be settled before write-plan and an owner-merged plan before plan-tickets."
  - "OWNER DECISION: the owner selected full-workflow isolation on 2026-10-16; the answer is recorded in Choose the Sandcastle execution boundary."
  - "OWNER DECISION: on 2026-10-16 the owner approved the partial-failure policy recorded in Define Sandcastle partial-failure outcomes."
  - "OWNER DECISION: on 2026-10-16 the owner selected fork-only auditing in Choose the landing audit history scope."
  - "VERIFIED: the research ticket establishes supported SDK APIs and a tested Git bundle primitive, with live containment and the new publication path explicitly unverified."
  - "OWNER DECISION: on 2026-10-16, after the verification approach was presented, the owner directed the agent to proceed and complete the PR for merge."
  - "VERIFIED: the owner merged planning PR 15 on 2026-10-16; the plan records approval_ref and restores its typed map relationship after the validator fix landed."
  - "VERIFIED: the approved breakdown is expanded into 26 proposed job specs linked from the plan; they depend on build tickets, not this completed map."
  - "UNKNOWN: job-spec approval and live containment proof remain pending; environment issues are tracked independently from design completion."
---

## Destination

An owner-reviewable remediation plan, grounded in the audit, with enough context and testable
slices for another LLM to turn it into approved job specs and execute one unblocked ticket per session.

## Notes

Start each session with `wiki-memory`, then this map and [[Resume repository audit remediation]].
The baseline inventory is [[Repository audit findings 2026-10-16]]. This map records decisions
and does not authorize implementation. Use `wayfinder` for one decision at a time, `grill-plan`
for owner questions, and the current harness's available engineering tools.

The likely work areas are execution isolation, Git-state and PR identity, orchestration outcomes,
privacy and metadata guards, and evaluation reliability. These are areas to slice after decisions,
not build tickets. Simple reproduced defects can be described without inventing new architecture.

The current branch also carries the provider-neutral authoring prerequisite. Its policy is in
[[ADR-0026 Any provider may work under shared rules]]. A different provider can use these records;
capability-specific runtime checks still require their real tools.

[[Planning pull request publication is blocked]] records the resolved delivery issue and
publication of PR 15. Authentication was required to publish, not to resolve the design map.

## Open decisions

No map decision remains open. The verification approach is included in
[[Repository audit remediation implementation plan]], approved through the owner's merge of
PR 15. The next stage is owner approval of the linked job specs, then dependency-ordered execution.

## Decisions so far

- [[Choose the Sandcastle execution boundary]]: isolate the complete workflow in a disposable
  environment and import changes through a controlled host step; owner selected on 2026-10-16.
- [[Define Sandcastle partial-failure outcomes]]: reviewed successes may proceed, failed work
  stays unintegrated, incomplete runs exit nonzero and retries resume missing phases without
  duplicate notifications; owner approved on 2026-10-16.
- [[Choose the landing audit history scope]]: audit only the fork after its verified inherited
  starting commit; owner selected on 2026-10-16.
- [[Establish a feasible isolated Sandcastle handoff]]: source-supported outer-container design
  with inner no-sandbox execution and exact-SHA bundles; live containment proof is required in
  the implementation, not claimed by the research.

The owner has also specified the handoff destination: committed planning reviewed through a
pull request, then execution by another LLM in a different session.

## Not yet specified

The approved plan specifies the execution/evidence contract, slice boundaries and dependencies.
Exact job-spec commands and file allowlists are recorded in the linked proposed tickets.
The first isolation slice must establish a real container test; source research does not satisfy
that implementation criterion. All A01-A22 findings remain in scope.

## Out of scope

- Automatically approving or merging changes: ownership stays with the human.
- Provider runtime ports: the authoring prerequisite permits other harnesses but does not port
  Sandcastle or the live compliance runner to another model API.
- Inherited upstream landing history at and before the verified fork boundary, per the owner's
  fork-only audit choice.
- Live paid model evaluations or credential changes without explicit authorization for the run.
- Unrelated cleanup or a second issue-tracking system.
