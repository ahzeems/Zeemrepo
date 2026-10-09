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
branch as it stands (commits since the fork from main, plus staged, unstaged and untracked
files), so the commit that satisfies a rule is never refused for lacking it. Exit codes: 0 pass,
1 refused, 2 the guard could not run.

| Guard | Requires | Satisfy it by |
|---|---|---|
| `changelog:guard` | An entry in `CHANGELOG.md` for any branch that changes a non-exempt file | An added `- ` line (by position, outside code fences) under a `## YYYY-MM-DD` heading dated between the day the branch started (its first commit's author date, so a rebase does not move it) and today (UTC), citing no post-merge facts |
| `memory:guard` | An updated work record under `wiki/work/` | On one record's frontmatter, compared with main: a changed `status` or `next_action`, and a new `evidence` item starting `VERIFIED:` or `OWNER DECISION:` that does not say the check did not happen (not run, pending, TBD, n/a...) |
| `memory:guard` | An operating document when workflow-critical files change | Add content to a note in `wiki/decisions/`, `wiki/reference/` or `wiki/runbooks/`, or newly write `[no-doc-change: <reason of 10+ characters>]` in the work record's prose (not in code) |
| `governance:check` | No text file asserts a replaced rule; every exclusion has a reason | Reword the line, or add an allowance (exact quoted span, the claim ids it excuses, a reason) to `config/governance-alignment.json`. Claims match across line wraps and look-alike characters. |

Exempt paths (no changelog entry or work record needed): `wiki/sessions/`, `.gitignore`
files and `package-lock.json`, unless the path is workflow-critical. Workflow-critical paths:
`.githooks/`, `.github/`, `scripts/`, `config/`, any `.claude/` folder, `CLAUDE.md`,
`README.md`, and root tooling files. The single source is `scripts/lib/change-policy.ts`.

Guards are code on the branch they judge, so a branch could weaken them; running them from
main's copy in CI closes that gap (Phase 6).
