---
type: idea
title: ECC is the repository foundation
summary: ECC wins over the zeem rules, repository skills and wiki pages, every ECC rule set loads, and nothing in the repository blocks or restricts the ECC plugin.
tags: [area/agents, tool/ecc]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: Owner reviews the slice A pull request (precedence, rule texts, all ECC rules loading); slice B then changes, test first, the guards and docs that still refuse ECC's rebase-then-force-push and the lint limit's line counting.
evidence:
  - "OWNER DECISION: \"the ecc skill is the foundation baseline of this repo, nothing should block or restrict the ECC plugin, ECC always win, add this baseline to make sure going foward nothing blocks or restricts cc\" (2026-10-19)."
  - "OWNER DECISION: asked how far it goes, \"ECC wins everywhere\", and for the Phase 2 exclusions, \"Yes, load all ECC rules\" (2026-10-19)."
  - "VERIFIED: with claudeMdExcludes removed, rules:check refused 19 sets as loading unrecorded, then passed after node scripts/governance/ecc-rules.ts --write listed all 22 in loaded; the vendored rule files are unchanged."
  - "VERIFIED: the new governance claim zeem-over-ecc passes on this branch and, run against a copy of origin/main with the new config, refuses the four old precedence statements (CLAUDE.md, branch-and-merge.md, skills.md, README.md)."
  - "VERIFIED: npm test passes 584 tests with branches at 92.56% overall, above the raised 80% branch threshold; lint, typecheck, evals:test, wiki:lint, skills:lint, governance:check and rules:check pass."
---

Use evidence and owner decisions; do not invent approval.

## Problem

`CLAUDE.md` put the `zeem` rules above ECC, five `zeem` files overrode ECC, and 19 ECC rule sets were
excluded from loading. The owner wants ECC to be the foundation that nothing in the repository blocks
or restricts ([[ADR-0026 ECC wins over the repository rules]]).

## Desired outcome

Slice A (this branch): the precedence in `CLAUDE.md` and the rule texts say ECC wins, every ECC rule
set loads, coverage meets ECC's 80% for branches, and a governance claim stops the old precedence from
returning.

Slice B (next branch, test first): the pre-push branch guard and the `--force-with-lease` deny rule
allow ECC's `git rebase origin/main` then `git push --force-with-lease` on a feature branch (never on
`main`); the Land a change runbook and the imported `manage-branch` and `resolve-conflicts` skills stop
forbidding it (an imported-skill revision quoting this owner decision); `eslint.config.ts` counts
function lines as ECC does.

## Next step

Owner reviews slice A. Until slice B lands, the pre-push guard and the deny rule still refuse a
rebased branch's force-push, so keep branches current by merging `main`.
