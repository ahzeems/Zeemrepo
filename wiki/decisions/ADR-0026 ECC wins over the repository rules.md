---
type: decision
title: ADR-0026 ECC wins over the repository rules
summary: ECC is the foundation; where a zeem rule, a repository skill or a wiki page disagrees with ECC, ECC wins, every ECC rule set loads, and nothing in the repository may block the plugin.
tags: [area/agents, tool/ecc, kind/architecture]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[ADR-0024 Claude Code is the only harness]]", "[[Context loading]]", "[[Integration admission]]"]
---

## Context

Until 2026-10-19, `CLAUDE.md` said the `zeem` rules won over ECC, and five `zeem` files listed
"Overrides of ECC": merging `main` instead of rebasing a pushed branch, a three-to-six-line plan
instead of ECC's planner and planning documents, the standard library before a dependency,
validation only at boundaries, research only before a dependency or subsystem, 70% branch
coverage, the repository skill winning over an overlapping ECC skill, and a reading of ECC's
"Approve" verdict. Phase 2 of the agent workflow review had also stopped 19 ECC rule sets from
loading with `claudeMdExcludes`.

The owner installed the ECC plugin at project scope the same day and decided: "the ecc skill is the
foundation baseline of this repo, nothing should block or restrict the ECC plugin, ECC always win".
Asked how far that goes, the owner chose "ECC wins everywhere", including over the 2026-10-09
landing rules on rebasing and force-pushing, and "Yes, load all ECC rules" (OWNER DECISION,
2026-10-19).

## Decision

ECC wins: where a `zeem` rule, a repository skill or a wiki page disagrees with an ECC rule or skill,
ECC's text applies and the other text is fixed. Every vendored ECC rule set loads, and nothing in the
repository may block or restrict the ECC plugin.

## Consequences

- The `zeem` rules keep what ECC does not cover (owner-only merging on GitHub, change records, the
  wiki, evidence labels). Their "Overrides of ECC" sections are replaced by notes on how ECC applies.
- `governance:check` refuses text that ranks the `zeem` rules or a repository skill above ECC
  (claim `zeem-over-ecc`).
- All 22 ECC rule sets load where their paths match, so a `.ts` read also loads the ArkTS, React
  Native, Vue and Angular testing rules ([[Context loading]]).
- Coverage thresholds are 80% for lines, functions and branches.
- Rebasing follows ECC's own `git-workflow` conditions: a branch only you use may be rebased and
  pushed with `--force-with-lease`, and a branch others have based work on is not. The owner lifted
  the pre-push rewrite refusal and the `--force-with-lease` deny rule for branches other than `main`
  (OWNER DECISION, 2026-10-19: "Allow on non-main branches"); under
  [[ADR-0027 One integration branch per piece of work]] the shared integration branch still merges `main`.
  The imported `manage-branch` and `resolve-conflicts` skills say so (revisions in
  `.claude/skills/import-baseline.json` cite this decision).
- GitHub reviews follow the owner too: agents post findings as pull request comments and never
  submit a formal review, approving or requesting changes (OWNER DECISION, 2026-10-19: "Comments
  only"), although ECC's `/ecc:code-review` publishes one; a deny rule refuses `gh pr review`.
- `eslint.config.ts` measures functions without blank lines and comments and exempts test files,
  where ECC counts lines. It stays: ECC's own config-protection hook refuses edits to it, and the owner
  kept the config (OWNER DECISION, 2026-10-19: "Keep the current config").
- Merging and approving on GitHub stay the owner's (OWNER DECISION, 2026-10-19: "You merge it"),
  although ECC's `/pr` command lists `gh pr merge` as a next step; `CLAUDE.md` names this as the one
  exception. The GitHub ruleset also refuses direct pushes to `main` and merges without the owner's
  approval.
