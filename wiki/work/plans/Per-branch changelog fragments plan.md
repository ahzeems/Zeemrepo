---
type: plan
title: Per-branch changelog fragments plan
summary: Replace the shared CHANGELOG.md edit with one dated fragment file per branch under changelog/, enforced by changelog:guard, so concurrent pull requests never conflict on the changelog.
tags: [area/git, area/planning, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: done
approval_ref: "#24"
owner: human
priority: P2
next_action: None once the owner merges slice 2; the follow-up for open job specs is tracked on the idea.
idea: "[[Changelog entries cannot conflict between branches]]"
related: ["[[ADR-0027 Changelog entries are per-branch fragment files]]", "[[ADR-0007 Changelog entries carry no post-merge facts]]", "[[Change records]]"]
evidence:
  - "VERIFIED: merge commit 271578d records a CHANGELOG.md conflict between PR 23's branch and main after PR 22 merged; both had added a line directly under the 2026-10-17 heading, and the resolution kept both. PR 23's approval was dismissed and given again on the new head."
  - "INFERRED: GitHub reported the same conflict, from the owner's pasted message on 2026-10-17; GitHub's mergeable state at that time cannot be fetched now."
  - "VERIFIED: scripts/changes/changelog-validation.ts judges entries by the lines a branch added under a date heading in CHANGELOG.md; scripts/lib/paths.ts:6 names the file."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Folder is the changelog (Recommended)\" and \"Existing guard tests (Recommended)\" as the test seam."
  - "UNKNOWN: whether GitHub's conflict check would honour a merge=union attribute; this plan does not depend on it."
  - "VERIFIED: an independent verifier at 1424498 found the first draft omitted the AFK wrapper's documentation patterns (scripts/sandcastle/afk.ts:27), the guards workflow running main's old guard on the switching pull request, and the new guard refusing that pull request's own pointer line."
  - "VERIFIED: gh pr view 24 shows the plan PR MERGED by the owner on 2026-10-17 (squash commit 6a28e1d), which approves this plan."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Move exclusion to slice 2 (Recommended)\": governance:check refuses an exclusion that matches no file, and slice 1 adds no file under changelog/, so the changelog/** exclusion lands with the first fragment in slice 2."
  - "VERIFIED: slice 1 landed as PR 28 (02fd7cb); slice 2 is recorded in Switch the changelog to per-branch fragments with its own evidence."
  - "INFERRED: the slices below close those gaps and the transition-closing gap a second review found at 3ac46a4; the reviews of this revision record whether they do."
---

The plan is approved when the owner merges the pull request that adds it; then set
`approval_ref` to that PR.

## Problem

Every branch must add a `CHANGELOG.md` entry under a date heading, and every branch adds it at the
top of the same section, so any two open pull requests conflict there. See
[[Changelog entries cannot conflict between branches]] for the observed case.

## Destination

A branch records its change in its own new file, `changelog/<YYYY-MM-DD>-<slug>.md`.
`changelog:guard` requires exactly that, and two branches open at once merge in either order
without a conflict. `CHANGELOG.md` holds the history written before the switch and points to the
folder. ADR-0027 is active and ADR-0007 is superseded by it.

## Constraints

- Test first, with each guard change shown failing before it passes (`write-guard`).
- A replaced rule is retired in the same pull request, and every live reference is repointed;
  `governance:check` must refuse text that still asserts the old rule.
- Historical records stay as written: existing `CHANGELOG.md` entries, decision bodies and work
  records are not edited, apart from the switching pull request's pointer line and transition
  entry in `CHANGELOG.md`, and ADR-0007's status.
- The required `guards` check runs main's copy of the guards against a pull request
  (`.github/workflows/guards.yml`), so the switching pull request must satisfy main's old
  changelog guard as well as its own new one.
- Dependabot and other bot branches keep their current exemption from the change-record guards.

## Decisions

- New entries are per-branch files in `changelog/`; the folder is the changelog, nothing folds
  them back, the switching pull request is the one transition, and a correction after merge is a
  new fragment ([[ADR-0027 Changelog entries are per-branch fragment files]]).
- Fragments carry no post-merge facts; ADR-0027 restates this when it supersedes
  [[ADR-0007 Changelog entries carry no post-merge facts]].

## Test seams

One seam: the existing guard tests. `scripts/changes/changelog-validation.test.ts` covers the pure
rule and `scripts/changes/changelog-guard.test.ts` runs the CLI against real temporary git
repositories through `scripts/test-support/repo-fixture.ts`; both run in `npm test`. The AFK
wrapper's landing rule keeps its own existing test, `scripts/sandcastle/afk-guard.test.ts`.

## Implementation slices

### 1. Fragment paths are recognised as documentation

Ticket: [[Recognise changelog fragments as documentation]].

- **Behaviour:** `scripts/lib/paths.ts` names the `changelog/` folder and the fragment name
  pattern. The AFK wrapper's documentation rule (`scripts/sandcastle/afk.ts`) counts a
  `changelog/` fragment as documentation, so a docs-only Sandcastle branch still lands unattended.
  No guard requires fragments yet, and this slice adds no file under `changelog/`: its own record is a
  `CHANGELOG.md` entry, as main's guard still requires.
- **Acceptance:** an `afk-guard` case where a branch adds only a wiki page and a fragment is
  treated as documentation, failing before the change; `npm run check` passes.
- **Blocked by:** owner approval of this plan.

### 2. Changelog fragments replace the shared entry

Ticket: [[Switch the changelog to per-branch fragments]] (parent: slice 1).

- **Behaviour:** `changelog:guard` accepts a branch that adds at least one new valid fragment, and
  refuses a branch with no fragment, an empty fragment or one with no `- ` entry, a fragment dated
  before the branch started or after today, a name not matching `<YYYY-MM-DD>-<slug>.md`, a
  change to or deletion of a fragment that exists on the base, any change to `CHANGELOG.md` once
  the base holds a fragment, and a post-merge fact. The fragment set comes from the branch diff with
  added, modified and deleted paths told apart, untracked files included.
- **Transition:** while the base has no file matching the fragment pattern, the guard also
  accepts the branch's dated `CHANGELOG.md` entry and pointer line, so this pull request passes main's old guard in the
  `guards` check and its own new guard in `check`. This pull request must also add its own
  fragment, so main holds a fragment once it merges and the transition never applies again. The guard's refusal for a branch that still
  carries a `CHANGELOG.md` entry tells it to move the entry into a fragment.
- **Rule and references, same pull request:** `CLAUDE.md`, `README.md`,
  `.claude/rules/zeem/change-records.md`, `.claude/rules/zeem/wiki-and-docs.md`,
  `wiki/reference/Change records.md`, the runbooks Land a change, Maintain the repository wiki,
  Run Sandcastle on GitHub issues and Verify a repository change, the Memory index lines for
  Maintain the repository wiki and for ADR-0007 ("Superseded by ADR-0027"), `.sandcastle/implement-prompt.md`, `.sandcastle/merge-prompt.md`, the guard's usage text,
  the comment in `scripts/wiki/wiki-compliance-validation.ts`, `repo-memory-validation`, and
  `config/governance-alignment.json`, which gains a claim refusing live text that still requires
  a `CHANGELOG.md` entry; each existing history file the claim matches (decision bodies, work
  records, this plan, evaluation reports) gets its own exact-span allowance or a named exclusion,
  as the config's model requires.
  ADR-0007 becomes `superseded` with `superseded_by` ADR-0027, and ADR-0027 becomes `active`.
  `governance:check` excludes `changelog/**` as history, as it excludes `CHANGELOG.md`; the
  exclusion lands here, with the first fragment, because the check refuses an exclusion that
  matches no file.
- **Acceptance:** the refusing cases fail before the change and pass after it; two fixture
  branches from one base each add a fragment and merge into `main` in either order without a
  conflict, the guard passing on both; a governance case shows a fragment is not scanned; the transition case passes only while the base has no
  fragment, and a branch with a transition entry but no fragment is refused; `governance:check` refuses a planted sentence asserting the old rule;
  `npm run check` passes.
- **Blocked by:** slice 1.

## Acceptance criteria

- [x] Two concurrent fixture branches each record a change and merge into `main` in either order
  with no conflict, and the guard passes on both.
- [x] Each refusing case in slice 2 is refused by `changelog:guard` with a reason, and was shown
  failing first.
- [x] The switching pull request passes both main's old guard and its own new guard, and adds a
  fragment, so main holds one after it merges and the transition is closed.
- [x] Slice 1 adds no file under `changelog/`.
- [x] A docs-only Sandcastle branch with a fragment still lands unattended.
- [x] No live rule, prompt, runbook, reference, README or config still requires a `CHANGELOG.md`
  entry, and `governance:check` refuses one planted back.
- [x] Existing `CHANGELOG.md` entries are not edited; after slice 2's base, the only lines added
  to it are the switching pull request's pointer line and transition entry, and any later change
  to it is refused.
- [ ] `npm run check` passes, and an independent verifier rates each criterion at each slice's
  final head.

## Out of scope

- Folding fragments into one file or generating a combined view: the owner chose the folder as
  the changelog.
- A `merge=union` attribute: not needed once no branch edits a shared file.
- Rewriting or moving existing `CHANGELOG.md` entries: history stays as written.
- Changing the post-merge rule itself: ADR-0027 restates it unchanged.
