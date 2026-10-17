---
type: idea
title: Changelog entries cannot conflict between branches
summary: Every branch adds a line at the top of the same CHANGELOG.md section, so any two open pull requests conflict; per-branch fragment files remove the shared edit.
tags: [area/git, area/github, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: After the switch lands, repoint the open job specs' Allowed files from CHANGELOG.md to a changelog fragment in a separate records PR (owner decision, 2026-10-17).
related: ["[[ADR-0027 Changelog entries are per-branch fragment files]]", "[[Per-branch changelog fragments plan]]"]
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
