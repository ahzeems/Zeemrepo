---
type: decision
title: ADR-0022 Independent review means a separate reviewer context
summary: A review is independent when a separate reviewer context inspects pinned sources and runs its own checks; the reviewer's model and who launched it do not decide independence.
tags: [area/agents, area/docs, kind/convention]
created: 2026-10-06
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0008 Owner merges pull requests on GitHub]]", "[[Merge gate contract]]", "[[Verify a repository change]]"]
---

## Context

Zimi's governing documents, branch-review and verify-work required review separate from the
builder, and said a builder's own review certifies nothing. None of them said what made a
review separate. Records were left open on that gap. The review notes for the 2026-09-21
landings named both reviewers only as "Codex; exact model identifier unavailable", the same
label as the builder, so a later verify-work run could not tell whether those reviews were
independent and returned INCONCLUSIVE. Later passes described their reviewers as same-model
subagents with their own context, accepted by the owner for one slice only.

## Decision

OWNER DECISION, 2026-10-06, in the owner's words:

> For Zimi, independent review means a separate reviewer role/context,
> with direct access to pinned requirements, revisions, and evidence.
>
> Same-model reviewers are permitted.
> The builder may launch and brief reviewers.
> Neither fact alone makes the review self-review.
>
> A qualifying reviewer must:
> - Operate in a separate session/subagent context.
> - Inspect the relevant pinned sources and perform its own applicable checks.
> - Receive the authoritative specification and full relevant change,
>   not only the builder's summary.
> - Report its own findings without repairing the work during review.
> - Preserve a traceable verdict and disclose shared-context limitations.
>
> A builder's own review does not certify its work.
> Cross-model review is optional corroboration, not required.
>
> This decision clarifies the policy now. It does not assert that historical
> reviews complied or waive acceptance criteria.

The decision carries over to Zeemrepo unchanged. This note is the single definition;
[[Verify a repository change]] and [[Merge gate contract]] point here instead of restating it.

## Consequences

A same-model subagent briefed by the builder qualifies when it meets the five conditions, for
example an ECC reviewer subagent or `/ecc:review-pr` run against the pull request. A review the
builder performs in its own context remains self-review and is disclosed as such. The model name
in a review is provenance, not proof of independence.

Review in Zeemrepo is a pull request review plus the required `check` and `guards` status
checks ([[ADR-0008 Owner merges pull requests on GitHub]]). Neither the checks nor GitHub can
tell whether a review met these conditions, so each review records them in the owning work
record: the pinned SHAs, the specification and change it received, the checks it ran, its
findings and any shared-context limit. Missing evidence is recorded as UNKNOWN, never assumed.
A qualifying review is evidence for the owner; it is never an approval, and only the owner merges.

Earlier reviews are judged by the evidence they left. Where that evidence does not show the
conditions, the review is not reinterpreted after the fact. A record that needs independent
review gets a fresh qualifying review, labelled as new, or stays open.

Ported from Zimi `wiki/decisions/ADR-0022 Independent review means a separate reviewer context.md` at 9fb36b2. Changed: the merge-gate clarification was replaced by the pull request review flow, and references to unmigrated documents and skills were removed; the owner's words are unchanged.
