---
type: idea
title: Publication accepts a control checkout on any earlier main commit
summary: S16's pinned control checkout means only clean tracked files and a HEAD that origin's main contains, so an older main commit can publish, and git and gh come from the host's PATH.
tags: [area/git, area/agents]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: backlog
owner: human
priority: P3
next_action: Decide whether pinned should mean the fetched main itself (or a recorded minimum commit), and whether git and gh should be resolved to fixed paths, then plan any tightening test first.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[S16 Trusted publication of verified candidate refs]]"]
evidence:
  - "INFERRED: the S16 ticket (PR 53) records what pinned means as enforced at 5f5fca1: no uncommitted changes to tracked files and a HEAD contained in the freshly fetched origin/main (2026-10-19)."
  - "VERIFIED: on main at 4c56101, controlState in scripts/sandcastle/isolated-publication.ts (lines 83 to 94) runs git status with --untracked-files=no and refuses only a HEAD that origin's main does not contain, telling the operator to check out main or a commit on it; line 28 says git and gh are resolved from the host's PATH (checked by Claude Code, Opus 5.5)."
  - "UNKNOWN: whether any later fix to publication would matter if an older control commit ran it; no such case has been tried."
---

## Problem

The word pinned appears in the plan (lines 101 and 335), the S16 ticket's summary and approach step 1, and the refusal message in isolated-publication.ts line 85. The runbook does not use it: it already states the enforced rule. As enforced, a control
checkout on any commit main contains is accepted, so a checkout left on an old main commit
publishes with code that lacks later publication fixes. Untracked files are not checked, and the
two host programs come from whatever PATH holds.

## Desired outcome

The word pinned in the plan, the ticket and the refusal message matches one enforced rule, chosen on
purpose.

## Next step

Decide the meaning. Tightening it changes how operators run publication, so it may need the
owner.
