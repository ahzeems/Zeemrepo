---
type: ticket
title: Choose the landing audit history scope
summary: The owner selected fork-only assurance; the verified boundary is the inherited parent immediately before the fork's first main-branch PR merge.
tags: [area/planning, area/git, area/github]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P2
next_action: Carry the fork-only repository and verified exclusive starting commit into the landing-audit implementation slice and its tests.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: decision
map: "[[Repository audit remediation map]]"
depends_on: []
evidence:
  - "VERIFIED: config/landing-audit.json names ahzeems/Zeemrepo while the current origin is Zimfra/software_testing; the first-parent history contains merged pull requests from both repositories."
  - "VERIFIED: the audit's GitHub query found the latest audited merge in the fork and no associated pull request for that commit in the configured upstream repository."
  - "OWNER DECISION: on 2026-10-16 the owner chose 'audit only the fork'; the follow-up requested more detail about what is being worked on and why."
  - "VERIFIED: git rev-list --parents -n 1 bf3e4073f32ae593d02c55eae1f003ba711bd41e identifies f9c1b9d3853226fe8a1a3181703f884106393ad0 as its first parent. GitHub reports fork PR 2 merged that child into main with the same base SHA, and upstream PR 25 merged the parent."
---

## Question

Should the landing audit validate inherited upstream history and fork history separately, or
begin its assurance at a documented fork boundary?

## Evidence

Finding A07 in [[Repository audit findings 2026-10-16]] identifies a repository mismatch. Replacing
the repository name alone would misattribute older upstream PR numbers. The choice changes
the configuration model, external queries, failure handling and test fixtures.

## Options

1. **Repository-specific history segments.** Preserve upstream provenance with explicit immutable
   boundaries and repository identities, then validate the fork's own segment against the fork.
   This retains historical assurance but depends on access to both repositories' records.
2. **Fork-only assurance.** Choose and document a verified starting commit for the fork. Treat
   inherited history as outside the audit's guarantee. This is simpler but deliberately narrows
   what a passing audit establishes.

## Recommendation

Use repository-specific segments if the existing whole-history assurance remains a requirement.
Prefer the fork-only approach only with an explicit owner decision to narrow that guarantee.
In either case, validate the PR's actual base branch and use a freshly fetched, pinned revision.

## Resolution

OWNER DECISION: on 2026-10-16 the owner selected **"audit only the fork"**.

The planned audit covers `Zimfra/software_testing` only, beginning after the verified inherited
commit `f9c1b9d3853226fe8a1a3181703f884106393ad0`. That starting commit is excluded. The first
included main-branch merge is `bf3e4073f32ae593d02c55eae1f003ba711bd41e`.

Boundary evidence, read on 2026-10-16:

- [Fork PR 2](https://github.com/Zimfra/software_testing/pull/2) targets main, has base
  `f9c1b9d3853226fe8a1a3181703f884106393ad0`, and merged as
  `bf3e4073f32ae593d02c55eae1f003ba711bd41e` on 2026-10-13.
- Git's first-parent history confirms that direct boundary; it contains no intervening main
  commit between the inherited parent and that first fork merge.
- [Upstream PR 25](https://github.com/ahzeems/Zeemrepo/pull/25) identifies the parent as an
  upstream main merge on 2026-10-11. The fork's GitHub metadata names the upstream repository
  as its parent and records fork creation on 2026-10-12.

Implementation must make the fork-only guarantee explicit, check that the configured boundary
is an ancestor of the freshly fetched main revision, and validate in-scope PRs against the fork's
main branch. Inherited history at and before the boundary is outside this audit's guarantee.
This records the planned behavior; `config/landing-audit.json` is changed by the later build slice.
