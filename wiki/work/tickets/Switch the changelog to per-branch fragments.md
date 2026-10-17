---
type: ticket
title: Switch the changelog to per-branch fragments
summary: changelog:guard requires one new dated fragment per branch under changelog/, with a one-time transition, and no live text still requires a CHANGELOG.md entry.
tags: [area/git, area/planning, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: done
owner: agent
priority: P2
next_action: None once the owner merges its pull request; the open job specs' Allowed files are repointed in a separate records PR afterwards.
idea: "[[Changelog entries cannot conflict between branches]]"
ticket_kind: build
plan: "[[Per-branch changelog fragments plan]]"
depends_on: ["[[Recognise changelog fragments as documentation]]"]
related: ["[[ADR-0027 Changelog entries are per-branch fragment files]]", "[[ADR-0007 Changelog entries carry no post-merge facts]]", "[[Change records]]"]
evidence:
  - "VERIFIED: the plan was approved by PR 24, which gh pr view 24 shows MERGED by the owner (squash commit 6a28e1d)."
  - "VERIFIED: the required guards check runs main's copy of the guards against a pull request (.github/workflows/guards.yml, pull_request_target), so this ticket's pull request must satisfy main's old changelog guard as well as its own new one."
  - "VERIFIED: parent slice 1 landed as PR 28 (squash 02fd7cb), whose tree equals its reviewed head c2826b6; this branch starts from 02fd7cb."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Separate PR after slice 2\" for the 22 open job specs whose Allowed files name CHANGELOG.md; this branch leaves them as written, and the claim's pattern does not match their Allowed files lines."
  - "VERIFIED: red first, measured by the independent verifier with the final test files on base 02fd7cb: changelog-validation failed 20 of 21 and changelog-guard 12 of 17 (my own earlier counts, 19 of 20 and 14 of 16, were taken before later cases were added); the two new real-config governance tests failed against main's config/governance-alignment.json; the new repo-memory case failed before fragments were excluded."
  - "VERIFIED: at e12ff78, node --test scripts/changes/*.test.ts passed 77 of 77 and governance-validation 34 of 34. Each of 12 planted mutations failed at least one test: dropping the history, window, real-date, entry, post-merge, transition or CHANGELOG.md checks, counting any added path or fragments as records, ignoring untracked fragments, reading every change as an add, and counting any file on the base as a fragment."
  - "VERIFIED: fixture tests show two branches from one base each adding a fragment and merging into main in either order without a conflict, the guard passing on each; a fragment on main edited, deleted or renamed is refused; the transition passes only while the base holds no fragment, a non-fragment file under changelog/ on the base keeps it open, and a transition entry without a fragment is refused."
  - "VERIFIED: main's own changelog-guard.ts, extracted from origin/main with git archive and run in this checkout, printed 'this branch records its own CHANGELOG.md entry' (exit 0); the new guard printed 'this branch records its own changelog fragment' (exit 0); git diff --name-only origin/main...HEAD lists changelog/2026-10-17-changelog-fragments.md."
  - "VERIFIED: planting 'Every branch must add a `CHANGELOG.md` entry.' in wiki/runbooks/Land a change.md made npm run governance:check exit 1 naming that line under changelog-md-entry; restored, it passed. The fragment exclusion is tested in scripts/governance/governance-validation.test.ts, beside the other real-config tests, rather than governance-guard.test.ts, whose fixtures use their own config."
  - "VERIFIED: an independent verifier (Claude Code subagent, Opus 5.5, separate context) rated 75613ba PASS with every ticket and plan criterion MET and seven LOW findings. It ran main's old guards, including changelog-guard and repo-memory-guard, against a local --no-ff merge standing in for the PR merge ref (exit 0), and caught 16 of 18 of its own mutations, the two survivors being equivalent. Fixed after it: the claim now also catches an entry under a date heading in, into or to the CHANGELOG.md file and recording the change in CHANGELOG.md; Change records names * entries; the open Sandcastle idea no longer asks for a CHANGELOG entry; these counts are corrected."
  - "UNKNOWN: independent review of the final head is pending; the PR body records it."
---

## Goal

`changelog:guard` requires each branch to add its own valid fragment under `changelog/`, so two
open pull requests never conflict on the changelog, and no live text still requires a
`CHANGELOG.md` entry.

## Approach

- Plan slice 2, "Changelog fragments replace the shared entry". The plan lists the guard's rules,
  the transition and every file to repoint; this ticket does not restate them.
- Write the refusing cases first in `scripts/changes/changelog-validation.test.ts` and
  `scripts/changes/changelog-guard.test.ts`, plus the two-branch either-order merge fixture and
  the transition cases, and show each failing.
- Change `scripts/changes/changelog-validation.ts` and `changelog-guard.ts` to read fragments from
  the branch diff (added, modified and deleted told apart, untracked included).
- In the same pull request: repoint every live reference the plan lists, add the
  `config/governance-alignment.json` claim with its history allowances, exclude `changelog/**`
  there as history beside `CHANGELOG.md` (moved here from slice 1 by owner decision, 2026-10-17), set ADR-0007 to
  `superseded` (`superseded_by` ADR-0027) and ADR-0027 to `active`.
- Record the branch with its own fragment plus the transition `CHANGELOG.md` entry and pointer line.

## Acceptance criteria

- [x] Each refusing case in plan slice 2 is refused with a reason, and was shown failing first (`node --test scripts/changes/*.test.ts`).
- [x] Two fixture branches from one base each add a fragment and merge into `main` in either order without a conflict, the guard passing on both (a case in `scripts/changes/changelog-guard.test.ts`).
- [x] A fragment under `changelog/` is not scanned by `governance:check` (a case in `scripts/governance/governance-validation.test.ts`, run by `npm test`).
- [x] The transition case passes only while the base has no fragment, and a branch with a transition entry but no fragment is refused.
- [x] The branch passes main's old `changelog:guard` (the PR's required `guards` check, which runs main's copy) and its own new one (`npm run changelog:guard`), and adds a fragment (`git diff --name-only origin/main...HEAD`).
- [x] `npm run governance:check` refuses a planted sentence that still requires a `CHANGELOG.md` entry.
- [ ] `npm run check` passes, and an independent verifier rates these criteria at the final head.

## Out of scope

- Folding fragments into one file or generating a combined view (the owner chose the folder as the changelog).
- A `merge=union` attribute.
- Editing or moving existing `CHANGELOG.md` entries beyond the pointer line and transition entry.
- Changing the post-merge rule itself.
- Repointing the open job specs' Allowed files from `CHANGELOG.md` to a fragment: a separate records PR after this one (owner decision, 2026-10-17).
- Dependabot's exemption from the change-record guards (`.github/workflows/guards.yml`), which stays as it is, as the plan's constraints require.
