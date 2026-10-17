---
type: idea
title: Changelog entries cannot conflict between branches
summary: Every branch adds a line at the top of the same CHANGELOG.md section, so any two open pull requests conflict; per-branch fragment files remove the shared edit.
tags: [area/git, area/github, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: done
owner: human
priority: P2
next_action: None; every branch now records itself with a changelog fragment.
related: ["[[ADR-0027 Changelog entries are per-branch fragment files]]", "[[Per-branch changelog fragments plan]]"]
evidence:
  - "VERIFIED: PR 28 and PR 29 are MERGED (gh pr view); the tree of merge commit 080c7d3 equals the tree of the reviewed head fa98671, and git ls-tree origin/main -- changelog/ lists changelog/2026-10-17-changelog-fragments.md, so the transition is closed."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Separate PR after slice 2\" for the open job specs whose Allowed files named CHANGELOG.md."
  - "VERIFIED: this branch repoints the Allowed files of the 21 open job specs (S05, S06 and S08 to S26, all status proposed) from CHANGELOG.md to a new changelog/ fragment; grep finds no CHANGELOG.md left in them. The done tickets S01 to S04 and S07 stay as written. The slice 2 ticket counted 22 such specs; the count on main after PR 29 is 21."
---

## Problem

`changelog:guard` requires every branch to add an entry under a date heading in `CHANGELOG.md`,
and entries go at the top of the current day's section. Two pull requests open at once therefore
insert different lines at the same place. On 2026-10-17, PR 22 and PR 23 each added a line under
`## 2026-10-17`; after the owner merged PR 22, the owner reported GitHub's message that PR 23
had conflicts in `CHANGELOG.md`, and it could not merge until `main` was merged into the branch
by hand (merge commit 271578d).

Nothing was lost: the conflict is the safe outcome. It costs a merge, a re-check, a fresh review
and a second owner approval each time, and Sandcastle, which runs several agents at once, would
meet it on almost every round.

## Desired outcome

Two branches open at the same time never conflict on the changelog, while every branch still has
to describe its change and the history stays readable in one place.

## Next step

The owner decided on 2026-10-17 that new entries live as per-branch files in a `changelog/`
folder ([[ADR-0027 Changelog entries are per-branch fragment files]]). The proposed
[[Per-branch changelog fragments plan]] turns that into two build tickets once approved.

PR 28 and PR 29 delivered the switch, and a records PR repointed the open job specs to fragments.
