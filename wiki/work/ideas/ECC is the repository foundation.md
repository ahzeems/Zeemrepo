---
type: idea
title: ECC is the repository foundation
summary: ECC wins over the zeem rules, repository skills and wiki pages, every ECC rule set loads, and nothing in the repository blocks or restricts the ECC plugin.
tags: [area/agents, tool/ecc]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: human
priority: P1
evidence:
  - "VERIFIED: PR #30 merged by the owner (gh pr view 30: mergedBy ahzeems, merge commit 7f75ad3), carrying ADR-0026, the pinned branch-and-merge spec reworded for one integration branch, and the force-push and review-comment decisions."
  - "OWNER DECISION: on aligning eslint.config.ts with ECC's line count, which ECC's own config-protection hook refuses to let an agent edit, \"Keep the current config\" (2026-10-19); design-principles.md and ADR-0026 record the gap (under ECC's count no source function and two test functions exceed 50 lines)."
  - "OWNER DECISION: \"the ecc skill is the foundation baseline of this repo, nothing should block or restrict the ECC plugin, ECC always win, add this baseline to make sure going foward nothing blocks or restricts cc\" (2026-10-19)."
  - "OWNER DECISION: asked how far it goes, \"ECC wins everywhere\", and for the Phase 2 exclusions, \"Yes, load all ECC rules\" (2026-10-19)."
  - "VERIFIED: with claudeMdExcludes removed, rules:check refused 19 sets as loading unrecorded, then passed after node scripts/governance/ecc-rules.ts --write listed all 22 in loaded; the vendored rule files are unchanged."
  - "VERIFIED: the new governance claim zeem-over-ecc passes on this branch and, run against a copy of origin/main with the new config, refuses the four old precedence statements (CLAUDE.md, branch-and-merge.md, skills.md, README.md)."
  - "VERIFIED: npm test passes 584 tests with branch coverage about 92.5% overall (92.44% to 92.56% across runs), above the raised 80% branch threshold; lint, typecheck, evals:test, wiki:lint, skills:lint, governance:check and rules:check pass."
  - "VERIFIED: separate-context review of e0cb3a9: the read-only verifier returned VERIFIED on all six slice A criteria; ECC's code-reviewer returned WARNING with one HIGH (the precedence line had no exception for merging, while ECC's /pr command lists gh pr merge), fixed by the owner's decision below, and two MEDIUM (the rebase rule dropped ECC's own conditions; the governance claim missed plural and override forms), both fixed."
  - "OWNER DECISION: on merging, \"You merge it (Recommended)\" (2026-10-19); CLAUDE.md names merging and approving on GitHub as the one exception to ECC winning."
  - "OWNER DECISION: on ECC's force-with-lease after a rebase, \"Allow on non-main branches\", and on ECC's /ecc:code-review publish step, \"Comments only (Recommended)\" (2026-10-19)."
  - "VERIFIED: branch-policy.test.ts and hooks.test.ts were changed first and failed (a non-main rewrite was refused; gh pr review was not denied and --force-with-lease was), then pass after branch-policy.ts and .claude/settings.json changed; main is still refused in every form."
  - "VERIFIED: separate-context review of PR #30 at 2ce26a2 - the verifier returned VERIFIED on all seven criteria; ECC's code-reviewer returned Approve (ready for the owner) with three MEDIUM; ECC's TypeScript reviewer two MEDIUM; ECC's Python reviewer blocked on two HIGH (an outcome check with a syntax error that could never pass; an observer error that could hide the scenario's error). Each was fixed test first or in the docs on this branch."
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

Slice B (same branch, test first): `eslint.config.ts` counts function lines as ECC does, and the
pinned `branch-and-merge` compliance spec expects one integration branch. The rebase guards need no
change: ECC's own `git-workflow` skill never rebases a shared branch, and under
[[ADR-0027 One integration branch per piece of work]] the shared integration branch merges `main`.

## Next step

None: done with the evidence above. The ESLint line count stays as it is by the owner's decision.
