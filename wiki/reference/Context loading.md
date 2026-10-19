---
type: reference
title: Context loading
summary: Which repository instructions Claude Code loads into a session, why every ECC rule set loads, and how to measure what loads.
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
| Rule files with `paths:` frontmatter | When Claude reads, writes or edits a matching file, until compaction summarizes them away | The other 21 ECC sets. A `.ts` read loads TypeScript, ArkTS and React Native rules and Vue's hooks rule; a `*.test.ts` read adds Angular's testing rule; a `.py` read loads Python's |
| Rule files matched by `claudeMdExcludes` in `.claude/settings.json` | Never | None ([[ADR-0026 ECC wins over the repository rules]]) |
| Skills | Only the name and description, until a skill is invoked | `.claude/skills/`, and the ECC plugin's skills where the plugin is loaded ([[Integration admission]]) |

Source for the loading rules: the Claude Code memory documentation (code.claude.com/docs/en/memory,
read 2026-10-19). It says path-scoped rules load "when Claude uses the Read, Write, or Edit tool on a
matching file", and that `claudeMdExcludes` patterns "are matched against absolute file paths using
glob syntax".

## Why every ECC set loads

Several ECC sets declare globs that match this repository's TypeScript, although the frameworks they
describe are not used here: ArkTS and React Native take `**/*.ts`, Vue's hooks rule takes `**/*.ts`, and
Angular's testing rule takes test files. Those rule files hold 46,814 bytes (`wc -c`); bytes are not
tokens, and no per-file token count was measured. Phase 2 of the agent workflow review excluded 19 sets
on 2026-10-19. Later that day the owner made ECC the foundation that nothing may restrict and chose to
load all ECC rules ([[ADR-0026 ECC wins over the repository rules]]), so the exclusions were removed.

The files stay vendored and byte-identical, held to the plugin pin by `rules:check`.
`config/ecc-rules.json` lists every set in `loaded`. `rules:check` refuses a set that loads without
being listed there, a listed set that is excluded or does not exist, an exclusion that names no vendored
set, and any `claudeMdExcludes` entry not in the exact form `**/.claude/rules/ecc/<set>/**`. It reads only
the tracked `.claude/settings.json`; an exclusion in `.claude/settings.local.json` (untracked, per machine)
or in user or managed settings is outside what it can see.

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
