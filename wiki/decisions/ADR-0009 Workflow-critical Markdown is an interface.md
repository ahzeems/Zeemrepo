---
type: decision
title: ADR-0009 Workflow-critical Markdown is an interface
summary: Documents that declare how work is landed, reviewed, and verified are part of the interface; drift between them and the code is a Blocker and is checked mechanically.
tags: [area/docs, area/agents, area/git, kind/architecture]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0008 Owner merges pull requests on GitHub]]"]
---

## Context

In Zimi, a change of landing model (owner merges replaced by an agent merge gate) took one
review to land in code. Removing the rule it replaced from the documents that declared it took
five, and each pass found the same class of defect after the previous pass had declared the
repository clean.

The fourth pass found the shared agent instructions ordering owner-only merges twelve lines
from "the gate is the only supported merge path". The fifth found the same rule in the intent
document, which took precedence over those instructions, so the governing document forbade the
gate. The sixth found it in `README.md`, missed because the search matched the word "owner" and
the sentence said "Only you merge". The seventh found it in three more documents, one of which
the branch had already edited without fixing the row below.

Each time the fix was a promise to search more carefully, and each time the promise failed. The
cause is structural: a search by hand matches a phrasing, and a rule can be written many ways.

An agent loads its instruction files and skills at the start of a session. It does not read
the diff that changed them. A correct implementation under a document that states the opposite
rule is not a working system; the document is what runs.

## Decision

Repository behaviour is defined by code plus the declared operating model. For workflow-critical
behaviour, Markdown and wiki pages are an interface, and interface drift is a Blocker.

`scripts/governance/governance-guard.ts` (`npm run governance:check`) scans every text file in
the repository, minus exclusions that each carry a reason in `config/governance-alignment.json`,
for phrasings that assert a replaced rule. It runs inside `npm run check`, and the required
`guards` status check runs main's copy of it on every pull request, so a governance failure
blocks the merge.

Historical wording is carried two ways: a wiki note marked `status: superseded` that names its
replacement is read as history, and anything else needs an allowance naming the file, the exact
span, the claims it excuses, and a reason. An allowance that no longer matches is itself a
failure.

`branch-review` treats a declared operating-model contradiction as a spec Blocker, and
`verify-work` runs the check for workflow changes.

## Consequences

A change that alters the operating model and leaves a governing document behind cannot land.
The cost is that the claim list needs extending whenever a rule is replaced, in the same
branch, which is the behaviour being bought.

The check matches phrasings, so it finds what it has been taught to find. It cannot judge
whether a document is otherwise wrong, only whether it still says something the repository has
decided against. A new contradiction nobody has phrased as a claim will pass, and the answer is
to add the claim when the decision is made, not to trust a search.

Ported from Zimi `wiki/decisions/ADR-0009 Workflow-critical Markdown is an interface.md` at 9fb36b2. Changed: script and config paths, the scan scope (every text file, not only Markdown) and the CI `guards` check now match Zeemrepo; Zimi's own instruction files are described rather than named.
