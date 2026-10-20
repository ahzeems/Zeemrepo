---
type: ticket
title: Recognise changelog fragments as documentation
summary: Name the changelog/ fragment folder and pattern once and count a fragment as documentation in the AFK landing rule, before any guard requires fragments.
tags: [area/git, area/planning, kind/convention]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: done
owner: agent
priority: P2
next_action: None once the owner merges its pull request; Switch the changelog to per-branch fragments is then unblocked.
idea: "[[Changelog entries cannot conflict between branches]]"
ticket_kind: build
plan: "[[Per-branch changelog fragments plan]]"
depends_on: []
related: ["[[ADR-0027 Changelog entries are per-branch fragment files]]"]
evidence:
  - "VERIFIED: the plan was approved by PR 24, which gh pr view 24 shows MERGED by the owner (squash commit 6a28e1d)."
  - "VERIFIED: before this branch, scripts/sandcastle/afk.ts:28 lists the documentation paths as wiki/**.md, docs/**.md and root *.md, so a changelog/ fragment is not documentation today; scripts/lib/paths.ts:6 names only CHANGELOG.md; config/governance-alignment.json:32 excludes CHANGELOG.md as history."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Move exclusion to slice 2 (Recommended)\" after a probe showed npm run governance:check refusing a changelog/** exclusion with \"exclusion matches no file; remove it\" while no fragment exists."
  - "VERIFIED: before the fix, the new afk-guard cases (a fragment alone, and a wiki page with a fragment) failed, and the new paths.test.ts cases failed because the pattern did not exist."
  - "VERIFIED: at ca0fef9, node --test on paths.test.ts, afk-guard.test.ts and afk.test.ts passed 115 of 115, lint and typecheck passed; removing the fragment pattern from the AFK rule failed 3 tests, and loosening the slug to .+ failed the paths test. changelog/build.mjs and changelog/2026-10-17-change.py are still refused."
  - "VERIFIED: git diff --name-only origin/main...HEAD lists no file under changelog/."
  - "VERIFIED: an independent verifier (Claude Code subagent, Opus 5.5, separate context) rated cd2545e FAIL on one MEDIUM finding, a garbled Approach bullet in this ticket, with four LOW findings; the code passed all checks and every planted mutation. Fixed after it: the bullet and the Goal's overstated scope, this box left unticked until a passing review, the pattern now built from CHANGELOG_DIR (bf58125), and paths.test.ts now refuses a pattern with flags and the paths changelog/2026-10-17-change.md.ts and one with a newline, so dropping $ or adding the m flag each fails two tests."
  - "UNKNOWN: independent review of the final head is pending; the PR body records it."
---

## Goal

A `changelog/<YYYY-MM-DD>-<slug>.md` fragment is recognised as documentation by the AFK
landing rule, while `CHANGELOG.md` stays the required record.

## Approach

- Plan slice 1, "Fragment paths are recognised as documentation".
- Write the failing tests first: an `afk-guard` case (`scripts/sandcastle/afk-guard.test.ts`)
  where a branch adds only a wiki page and a fragment and is treated as documentation.
- `scripts/lib/paths.ts`: name the `changelog/` folder and the fragment name pattern once.
- `scripts/sandcastle/afk.ts`: count a path matching that pattern as documentation.
- Record the branch with a `CHANGELOG.md` entry, as main's guard still requires.

## Acceptance criteria

- [x] The new `afk-guard` case fails before the change and passes after it (`node --test scripts/sandcastle/afk-guard.test.ts`).
- [x] The branch adds no file under `changelog/` (`git diff --name-only origin/main...HEAD`).
- [ ] `npm run check` passes, and an independent verifier rates these criteria at the final head.

## Out of scope

- Any change to `changelog:guard` or to what a branch must record: slice 2,
  [[Switch the changelog to per-branch fragments]].
- Retiring rule, prompt or runbook text that names `CHANGELOG.md`: slice 2.
- Changing ADR-0007 or ADR-0027 status: slice 2.
- The `governance:check` exclusion for `changelog/**`: slice 2, because the check refuses an
  exclusion that matches no file and this slice adds none (owner decision, 2026-10-17).
