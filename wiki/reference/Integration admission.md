---
type: reference
title: Integration admission
summary: Each admitted external plugin or tool, with its exact revision, contents, permissions, registered, evaluated, enabled and loaded status, and disable and removal steps.
tags: [area/agents, tool/claude-code, tool/ecc, kind/convention]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[ADR-0024 Claude Code is the only harness]]", "[[Context loading]]", "[[Skill standards]]"]
---

One section per integration. The status words mean different things and are kept apart:

| Status | Meaning | Where it shows |
|---|---|---|
| Registered | The repository declares the source and revision | `.claude/settings.json` (plugins), `.claude/skills/import-baseline.json` (imported skills) |
| Evaluated | A recorded check ran against it, here or in a work record | This page, with the date and the record |
| Enabled | The repository's settings ask Claude Code to use it | `enabledPlugins` in `.claude/settings.json` |
| Loaded | It is installed and active on a given machine | `claude plugin list --json` on that machine; never in the repository |

Enabled is not loaded. Claude Code does not fetch a plugin that only a project's settings enable
(code.claude.com/docs/en/plugins/loading, read 2026-10-19), so each machine installs it once.

Imported skills keep their provenance and approvals in `.claude/skills/import-baseline.json`
([[Skill standards]]); this page does not repeat them.

## ECC plugin (`ecc@ecc`)

Captured 2026-10-19 on one machine with Claude Code 2.1.303. To re-check, run the commands in the
"Source" column.

| Field | Value | Source |
|---|---|---|
| Upstream | `https://github.com/affaan-m/ECC`, MIT licence | `.claude/settings.json`; the plugin's `.claude-plugin/plugin.json` |
| Revision | Tag `v2.2.3`, an annotated tag that resolves to commit `c05b2d6614f62f6db0047669aa4eefb223d478f9` | `git ls-remote https://github.com/affaan-m/ECC.git 'refs/tags/v2.2.3^{}'` |
| Pin limit | A marketplace source takes only a branch or tag `ref`, so upstream could move the tag; an update checks the commit again ([[ADR-0024 Claude Code is the only harness]]). A `sha` field exists for plugin sources, not for marketplaces (code.claude.com/docs/en/plugins/marketplace-reference) | Docs, read 2026-10-19 |
| Adds | 68 agents, 293 skills, 94 command shims; 24 hook commands on 7 events (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd), each a `node -e` command; an MCP server `chrome-devtools` started with `npx -y chrome-devtools-mcp@1.10.1` from the plugin's root `.mcp.json`, which Claude Code loads alongside `plugin.json`'s empty `mcpServers` | Counted in the marketplace clone at that commit |
| Options | `hooks_enabled` (default true) and `hook_profile` (default `standard`), stored per user under `pluginConfigs`, which the settings reference lists for user or managed scope only | `plugin.json` `userConfig`; code.claude.com/docs/en/plugins/manifest-reference |
| Permissions | Hook commands and MCP servers run with the user's full permissions, outside the sandbox. The project's deny rules and the merge-blocking PreToolUse hook still apply to tool calls the plugin's agents and MCP tools make | code.claude.com/docs/en/plugins/security, read 2026-10-19 |
| Also used by | `.claude/rules/ecc/` vendors its rules (held to the pin by `rules:check`); `evals/compliance/run_comply.py` runs `skill-comply` from the cached copy under the user's plugin cache | `config/ecc-rules.json`; `run_comply.py` line 45 |

**Status, 2026-10-19:**

- Registered: yes (`extraKnownMarketplaces.ecc`, tag `v2.2.3`).
- Enabled: yes (`enabledPlugins` `ecc@ecc: true`).
- Evaluated: its rules were vendored and pinned, and its `skill-comply` ran the compliance baseline
  ([[Zimi migration]]). Its hooks, agents and MCP server have no recorded evaluation.
- Loaded on the machine checked: no. `claude plugin list --json` printed `[]`, and none of its
  agents or skills was offered in that day's sessions. The marketplace clone and a cached 2.2.3 copy
  are on disk.

So on that machine the ECC review agents the [[Verify a repository change]] runbook names were not
available, and reviews used the repository's `finder` and `verifier`.

**Install** (each machine, the owner's decision, because it turns on the hooks and the MCP server):
`claude plugin install ecc@ecc --scope project`. Before that, the owner can set `hooks_enabled` to
false in `/plugin` to keep the agents and skills without the hooks.

**Disable:** `claude plugin disable ecc@ecc --scope project` sets `ecc@ecc` to `false` in
`.claude/settings.json` and leaves the marketplace pin, so `rules:check` still passes. Checked on a
scratch copy on 2026-10-19: the command reported success, the setting flipped (the command also
reorders the file's keys), and `rules:check` exited 0. A disable lands like any other change, by
pull request.

**Remove:** not a settings-only change. Deleting the marketplace and `enabledPlugins` entries makes
`rules:check` refuse ("pins ECC (none) but config/ecc-rules.json records v2.2.3"; checked on a scratch
copy, 2026-10-19). A removal also has to retire `.claude/rules/ecc/`, `config/ecc-rules.json` and
`rules:check`, the ECC overrides in `.claude/rules/zeem/`, the ECC mentions in `CLAUDE.md`, `README.md`,
the Verify runbook, the `branch-review` and `write-skill` skills, and the compliance harness's
`skill-comply` dependency. On each machine, `claude plugin marketplace remove ecc` then uninstalls the
plugin. That is a branch of its own, on an owner decision.
