---
type: idea
title: Rules cite current decisions
summary: The branch-and-merge rule and the git-notes lesson cite ADR-0025, which superseded ADR-0008, as the decision behind owner-only merging.
tags: [area/git, area/planning]
created: 2026-10-10
updated: 2026-10-10
agent: claude-code
status: done
owner: human
priority: P3
evidence:
  - "OWNER DECISION: \"yes update the ADR pointer, then open the PR\" (2026-10-10)."
  - "VERIFIED: git diff origin/main shows one changed line under .claude/rules (the decision path in branch-and-merge.md) and the cited ADR-0025 file exists; the lesson's two ADR-0008 links now point to ADR-0025; npm run check exits 0."
  - "VERIFIED: outside history (decisions, changelog, migration docs, work records, the governance supersededBy note), ADR-0008 is named only by the Memory index's superseded entry and Idea to execution's note that ADR-0025 supersedes it."
---

## Problem

ADR-0025 superseded ADR-0008, but `.claude/rules/zeem/branch-and-merge.md` and the git-notes
lesson still cited ADR-0008 as the decision behind owner-only merging. Rule files change only
with the owner's approval.

## Desired outcome

Live rules and lessons cite the decision in force; the rule text stays unchanged.

## Next step

None: done with the evidence above. [no-doc-change: branch-and-merge.md only repoints its decision link to ADR-0025, which already records the decision; the rule text and the workflow are unchanged]
