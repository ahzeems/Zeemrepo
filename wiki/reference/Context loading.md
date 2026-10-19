---
type: reference
title: Context loading
summary: Which repository instructions Claude Code loads into a session, which ECC rule sets are excluded and why, and how to measure what loads.
tags: [area/agents, tool/claude-code, tool/ecc, kind/overview]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[ADR-0024 Claude Code is the only harness]]", "[[Verify a repository change]]"]
---

Captured 2026-10-19 with Claude Code 2.1.303 and ECC v2.2.3. To re-check, run `npm run rules:check`,
open a new session, have it read a `.ts` file and run `/context`. The method under "Measuring" gives a
check that does not rely on the model.

## What loads

| Source | When it loads | In this repository |
|---|---|---|
| `CLAUDE.md`, and rule files without `paths:` frontmatter | At launch | `CLAUDE.md`, the 7 `.claude/rules/zeem/` files, the 10 `.claude/rules/ecc/common/` files |
| Rule files with `paths:` frontmatter | When Claude reads, writes or edits a matching file, until compaction summarizes them away | `.claude/rules/ecc/typescript/` (`**/*.ts`), `.claude/rules/ecc/python/` (`**/*.py`) |
| Rule files matched by `claudeMdExcludes` in `.claude/settings.json` | Never | The other 19 ECC sets |
| Skills | Only the name and description, until a skill is invoked | `.claude/skills/` and the ECC plugin's skills |

Source for the loading rules: the Claude Code memory documentation (code.claude.com/docs/en/memory,
read 2026-10-19). It says path-scoped rules load "when Claude uses the Read, Write, or Edit tool on a
matching file", and that `claudeMdExcludes` patterns "are matched against absolute file paths using
glob syntax".

## Why 19 ECC sets are excluded

Several ECC sets declare globs that match this repository's TypeScript, although the frameworks they
describe are not used here: ArkTS and React Native take `**/*.ts`, Vue's hooks rule takes `**/*.ts`, and
Angular's testing rule takes test files. On 2026-10-19 a session that read `scripts/changes/repo-memory-validation.ts`
loaded the ArkTS, React Native, TypeScript and Vue rules, and reading test files loaded Angular's testing
rule. Those four sets add 46,816 bytes of rule text (`wc -c`). Bytes are not tokens, and no per-file token count
was measured.

The owner kept every ECC rule set vendored and unchanged (2026-10-10) and chose, on 2026-10-19, to
exclude every set except `common`, `typescript` and `python` from loading. The files stay byte-identical,
so `rules:check` still holds them to the plugin pin. `config/ecc-rules.json` lists the loaded sets in
`loaded`. `rules:check` refuses a set that loads without being listed there, a listed set that is
excluded, a listed set that does not exist, and an exclusion that names no vendored set. An exclusion
counts only in the exact form `**/.claude/rules/ecc/<set>/**`. After an ECC pin bump, a new set loads
until it is excluded or listed, and `rules:check` refuses the branch until one of the two is done.

## Measuring

| Measure | Where | Limit |
|---|---|---|
| Which rule text a session received | Search its transcript, `~/.claude/projects/<project>/<session-id>.jsonl`, for each rule's heading | The format is internal to Claude Code and changes between versions |
| Per-message token usage | The same transcripts record `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens` | Not a documented interface; nothing attributes tokens to a single rule file |
| One run's usage and estimated cost | `claude -p --output-format json` returns `usage` and `total_cost_usd` | The cost is an estimate at list price; for a subscription it is not a charge |
| Telemetry | OpenTelemetry metrics `claude_code.token.usage` and `claude_code.cost.usage`, when `CLAUDE_CODE_ENABLE_TELEMETRY=1` is set | Not configured for this repository |
| What loaded at launch | `/context` in an interactive session | Per-file token counts are not documented |

The 2026-10-19 check: one `claude -p` run on Haiku, made with the exclusions in place, read
`scripts/lib/cli.ts`. Its transcript holds the TypeScript and zeem rules and none of the ArkTS, React
Native, Vue or Angular headings.
