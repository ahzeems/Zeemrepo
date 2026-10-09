---
type: reference
title: Change records
summary: What every branch must record before it lands, which guard checks it, and how to satisfy each.
tags: [area/git, kind/convention]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: active
---

Three guards in `npm run check` decide whether a branch records itself. Each judges the
branch as it stands (commits since the fork from main, plus staged and unstaged edits), so
the commit that satisfies a rule is never refused for lacking it. Exit codes: 0 pass,
1 refused, 2 the guard could not run.

| Guard | Requires | Satisfy it by |
|---|---|---|
| `changelog:guard` | An entry in `CHANGELOG.md` for any branch that changes a non-exempt file | A `- ` line under a `## YYYY-MM-DD` heading dated between the fork point and today (UTC), citing no post-merge facts |
| `memory:guard` | An updated work record under `wiki/work/` | A changed `status` or `next_action`, and an added `VERIFIED:` or `OWNER DECISION:` evidence item |
| `memory:guard` | An operating document when workflow-critical files change | Update a note in `wiki/decisions/`, `wiki/reference/` or `wiki/runbooks/`, or write `[no-doc-change: reason]` in the work record |
| `governance:check` | No declared surface asserts a replaced rule | Reword the line, or add an allowance with a reason to `config/governance-alignment.json` |

Exempt paths (no changelog entry or work record needed): `wiki/sessions/`, `.gitignore`
files and `package-lock.json`, unless the path is workflow-critical. Workflow-critical paths:
`.githooks/`, `.github/`, `scripts/`, `config/`, any `.claude/` folder, `CLAUDE.md`,
`README.md`, and root tooling files. The single source is `scripts/lib/change-policy.ts`.

A new file must be staged before the guards see it.
