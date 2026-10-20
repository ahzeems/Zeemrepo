---
type: plan
title: ECC foundation plan
summary: Make the ECC plugin the foundation of the repository in four slices that retire the repository's overrides of ECC, with three questions left to the owner.
tags: [area/agents, area/planning, tool/ecc]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: human
priority: P1
next_action: Owner merges this plan's pull request, then agrees the test seams before slice 1 starts.
idea: "[[ECC is the foundation of this repository]]"
related: ["[[Merge gate contract]]", "[[Change records]]", "[[Land a change]]"]
---

Use evidence and owner decisions; do not invent approval. The plan is approved when the
owner merges the pull request that adds it; then set `approval_ref` to that PR.

## Problem

The rules rank the repository above ECC. VERIFIED: `CLAUDE.md` lines 30-31 say "the `zeem` rule
wins" over an ECC rule, skill or wiki page, and `.claude/rules/zeem/` lists 14 "Overrides of
ECC" entries in five files (read 2026-10-19). Several are enforced by code, so a rule change
alone would leave checks that still block ECC's way of working.

## Destination

ECC is the foundation. Nothing in this repository stops an ECC skill, agent or command from
loading or running, and where a repository rule disagrees with ECC, ECC wins and the repository
text is corrected. Which controls on individual merge and approve steps remain (for example
`gh pr merge` or `gh pr review --approve`, which ECC's `pr` and `code-review` commands include)
is the owner's first open question below; this destination does not settle it.

## Constraints

- The GitHub `protect-main` ruleset stays as it is: changing repository settings needs the owner's
  own action, and this plan does not propose it. INFERRED from `owner-authority.md`. Who may
  merge after slice 2 is part of the first open question; until then the owner merges these
  pull requests.
- Each slice lands by its own pull request with its own changelog fragment, work record and
  independent review, while those rules stand; slice 2 revisits how landing works.
- Each slice is built test first, which ECC also requires.

## Decisions

- ECC is the foundation and nothing added may block it: OWNER DECISION, 2026-10-19, on
  [[ECC is the foundation of this repository]].
- ECC wins everywhere over repository rules: OWNER DECISION, 2026-10-19, same note.

This reverses earlier decisions, and each slice names the ones it supersedes:

- Slice 1: the precedence paragraph in `CLAUDE.md` ("the `zeem` rule wins").
- Slice 2: parts of "Landing (OWNER DECISION, 2026-10-09)" in `branch-and-merge.md` and of
  [[ADR-0008 Owner merges pull requests on GitHub]] and
  [[ADR-0025 Agents use a machine account and the owner approves]]: at least the CLAUDE.md
  non-negotiable "finish with `npm run pr`" (line 8) and the refusal of rebase and force-push.
  Which of the merge and approve controls are superseded waits on the first open question below;
  this plan does not decide it.
- Slices 3 and 4: the OWNER DECISION of 2026-10-09 on TDD stays true, because ECC also makes
  test-first mandatory; only its "Overrides of ECC" entry is removed. So does "4, as ECC" in
  `design-principles.md`, which agrees with ECC.

Open owner questions, each blocking the slice that needs it:

- Before slice 2: what stays of the merge and approve controls. `.claude/settings.json` denies
  `gh pr merge` and `gh pr review --approve`, `scripts/claude/block-pr-merge.ts` refuses merging,
  approving and pushing to main, and `CLAUDE.md` lines 8-9 say "Never merge or approve a pull
  request". UNKNOWN whether each stays, goes, or is reworded.
- Before slice 4: the "Commit subjects" entry holds the OWNER DECISION of 2026-10-09 on how a
  merge of `main` may resolve conflicts (`branch-and-merge.md` lines 38-41). ECC says nothing on
  it. UNKNOWN whether it is superseded or moved out of the Overrides section to survive.
- Before slice 4: what end-to-end testing means here (see slice 4).

## Test seams

UNKNOWN: not yet agreed with the owner. Recommendation, to confirm before slice 1:

- Slice 1: `scripts/git/hooks.test.ts`, which already reads `.claude/settings.json`
  (VERIFIED: its "pins ECC to a release" and deny-rule cases), plus a refusing case for each
  planted blocker; and `scripts/governance/governance-guard.test.ts` for the new claim.
- Slice 2: `scripts/git/branch-policy.test.ts`, `scripts/claude/block-pr-merge.test.ts`, and
  `scripts/git/hooks.test.ts`, whose "denied merging and pushing main" case asserts the
  `Bash(git push --force:*)` rule (VERIFIED: line 175) and changes with it.
- Slice 3: the coverage and lint configuration itself, proven by `npm run check` at the new
  thresholds.
- Slice 4: `scripts/governance/governance-guard.test.ts`, with a claim that refuses an
  "Overrides of ECC" heading or its slice 1 rename anywhere in `.claude/rules/zeem/`.

## Implementation slices

1. **Foundation rule.** Write an ADR that ECC is the foundation; change the precedence paragraph
   in `CLAUDE.md` so ECC wins; add a claim to `config/governance-alignment.json` that refuses
   text still saying the `zeem` rule wins over ECC; rename each "Overrides of ECC" heading so no
   file claims to win over ECC while later slices retire the entries; add a guard that fails on a
   `Skill(ecc:…)` deny rule, `ecc@ecc` turned off, or any ECC switch in the project settings'
   `env` that turns hooks off or redirects their configuration. VERIFIED in ECC 2.2.3,
   `scripts/lib/hook-flags.js`: `ECC_DISABLED_HOOKS` (line 89); `ECC_HOOKS_ENABLED` and
   `ECC_HOOK_PROFILE` and their `CLAUDE_PLUGIN_OPTION_` fallbacks (lines 65-86); and a managed
   config whose `hooks.enabled` or `hooks.profile` can turn hooks off (lines 71-73 and 82), found
   through `ECC_HOOK_CONFIG`, `ECC_PLUGIN_ROOT` or `CLAUDE_PLUGIN_ROOT` (lines 43-47). VERIFIED in
   `scripts/hooks/gateguard-fact-force.js`: `ECC_GATEGUARD` set to `off`, `0`, `false`,
   `disabled` or `disable` (lines 53 and 1325, also `scripts/hooks/run-with-flags.js` line 98)
   and `GATEGUARD_DISABLED` (line 1321, also `run-with-flags.js` line 99), and
   `GATEGUARD_BASH_ROUTINE_DISABLED`, which turns off GateGuard's routine Bash checks (line 168). The guard refuses any
   false `ECC_HOOKS_ENABLED` or `CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED`, any `ECC_HOOK_PROFILE` or
   `CLAUDE_PLUGIN_OPTION_HOOK_PROFILE` other than `standard` or `strict` (the profiles standard
   hooks run under, `hook-flags.js` line 100), any `ECC_DISABLED_HOOKS`, `ECC_GATEGUARD` off
   value, `GATEGUARD_DISABLED` or `GATEGUARD_BASH_ROUTINE_DISABLED`, and any of the three
   config-path variables set in the project settings at all. Acceptance: the guard refuses each planted case, the
   governance claim refuses the old sentence, and `npm run check` passes. Blocked by: this plan's
   merge.
2. **Landing.** Retire Push and PR and Rebase and force-push, and the Approval entry only as
   far as the owner's answer to the first open question allows (`branch-and-merge.md`, including the rebase line in its "Branches and checkouts" section,
   line 21), update `CLAUDE.md`'s non-negotiables, repoint [[Land a change]] and
   [[Merge gate contract]], and add governance claims that refuse the retired text. VERIFIED: `scripts/git/branch-policy.ts` line 32 refuses
   rewriting a published branch, and `.claude/settings.json` denies `git push --force`, `-f` and
   `--force-with-lease`. INFERRED from `branch-and-merge.md` lines 35-37 and ECC's
   `commands/pr.md` (which rebases, pushes and runs `gh pr create`): both block ECC's
   `git-workflow` and `pr` steps. Acceptance: ECC's `pr` and `git-workflow` steps on a feature
   branch run without a repository refusal, except at any merge or approve step the owner
   chooses to keep refusing. Blocked by:
   slice 1 and the owner's answer on the merge and approve controls. Highest risk; it needs
   the owner's review of each removed control.
3. **Engineering.** Retire Size limits, Coverage, Dependencies, Input validation, Research before
   building and Planning (`design-principles.md`, `change-records.md`, `evidence-and-review.md`).
   Add governance claims that refuse the retired text. VERIFIED: `package.json` sets branch
   coverage at 70% against ECC's 80%, and ECC's TypeScript
   style asks for Zod (`.claude/rules/ecc/typescript/coding-style.md` line 180), so this slice
   adds Zod as a dependency. Acceptance: `eslint.config.ts` and the coverage thresholds follow
   ECC and `npm run check` passes. Blocked by: slice 1. UNKNOWN: how much code falls below the new
   bar; measure first, and split the slice if the fixes are large.
4. **Docs and skills.** Retire E2E tests, TDD, Overlapping skills, Commit subjects and Attribution
   (`evidence-and-review.md`, `skills.md`, `branch-and-merge.md`) and repoint the runbooks that
   restate them, with governance claims that refuse the retired text. ECC's TypeScript testing rule names Playwright for E2E
   (`.claude/rules/ecc/typescript/testing.md` line 14) and this repository has no UI. UNKNOWN:
   what end-to-end testing means here once the override is gone; an owner question before this
   slice. Acceptance: no "Overrides of ECC" entry remains, the runbooks match, and
   `npm run check` passes. Blocked by: slice 1 and the E2E and merge-conflict questions.

## Acceptance criteria

- No file in `.claude/rules/zeem/` has an "Overrides of ECC" entry, and `CLAUDE.md` says ECC wins.
  Text the owner keeps under the open questions (part of Approval, or the merge-conflict
  decision) moves out of that section into an ordinary rule.
- A check in `npm run check` fails when the repository turns ECC off, denies an ECC skill, or
  turns ECC hooks off (the slice 1 cases), and was shown failing on a planted case. Controls on
  merge and approve steps follow the owner's answer to the first open question.
- `npm run check` passes after each slice.

## Out of scope

- Changing the GitHub ruleset or other repository settings: only the owner does that.
- Upgrading ECC past v2.2.3: a separate change to the pinned release.
- The ECC hook profile: OWNER DECISION, 2026-10-19, "Keep all" (recorded on the idea); nothing
  to change.
