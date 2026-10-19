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
| Purpose here | The engineering rules vendored under `.claude/rules/ecc/`, the TDD and review workflow the zeem rules build on, its review agents, and the `skill-comply` engine of the compliance evals | `CLAUDE.md`; `.claude/rules/zeem/` "Overrides of ECC" |
| Upstream | `https://github.com/affaan-m/ECC`, MIT licence | `.claude/settings.json`; the plugin's `.claude-plugin/plugin.json` |
| Revision | Tag `v2.2.3`, an annotated tag that resolves to commit `c05b2d6614f62f6db0047669aa4eefb223d478f9` | `git ls-remote https://github.com/affaan-m/ECC.git 'refs/tags/v2.2.3^{}'` |
| Pin limit | A marketplace source takes only a branch or tag `ref`, so upstream could move the tag; an update checks the commit again ([[ADR-0024 Claude Code is the only harness]]). A `sha` field exists for plugin sources, not for marketplaces (code.claude.com/docs/en/plugins/marketplace-reference) | Docs, read 2026-10-19 |
| Adds | 68 agents, 293 skills, 94 command shims; 24 hook commands on 7 events (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd), each a `node -e` command; an MCP server `chrome-devtools` started with `npx -y chrome-devtools-mcp@1.10.1` from the plugin's root `.mcp.json` | Counted in the marketplace clone at that commit; Claude Code loads a plugin's root `.mcp.json` together with `plugin.json`'s `mcpServers` (code.claude.com/docs/en/plugins/manifest-reference, read 2026-10-19) |
| Compatibility | The plugin declares no Claude Code version; its `package.json` requires Node `>=18`. Observed only with Claude Code 2.1.303 and Node 24 | `plugin.json`, `package.json` in the clone |
| Options | `hooks_enabled` (default true) and `hook_profile` (default `standard`), stored per user under `pluginConfigs`, which the settings reference lists for user or managed scope only | `plugin.json` `userConfig`; code.claude.com/docs/en/plugins/manifest-reference |
| Permissions | Hook commands and MCP servers run with the user's full permissions, outside the sandbox. Permission rules apply to the plugin's tool calls, but every deny rule in `.claude/settings.json` is a `Bash(...)` pattern and the merge-blocking hook matches only `Bash`: they cover Bash calls from any agent, and nothing here covers an MCP tool call (such as `mcp__chrome-devtools__*`) or the plugin's own hook commands | code.claude.com/docs/en/plugins/security, read 2026-10-19; `.claude/settings.json` |
| Also used by | `.claude/rules/ecc/` vendors its rules (held to the pin by `rules:check`); `evals/compliance/run_comply.py` runs `skill-comply` from the cached copy under the user's plugin cache | `config/ecc-rules.json`; `run_comply.py` line 45 |

**Status, 2026-10-19:**

- Registered: yes (`extraKnownMarketplaces.ecc`, tag `v2.2.3`).
- Enabled: yes (`enabledPlugins` `ecc@ecc: true`).
- Evaluated: its rules were vendored and pinned, and its `skill-comply` ran the compliance baseline
  ([[Zimi migration]]). Its hooks, agents and MCP server have no recorded evaluation.
- Loaded on the machine checked: no at first. `claude plugin list --json` printed `[]`, and none of
  its agents or skills was offered, so the Phase 1 to 3 reviews used the repository's `finder` and
  `verifier`. Later that day the owner installed it (`/plugin install ecc@ecc`); `claude plugin list
  --json` then gave `ecc@ecc`, version 2.2.3, scope `project`, enabled, the session offered the ECC
  agents and skills, and its hooks ran (a GateGuard PreToolUse hook asked for the request and the
  command's purpose before the first Bash command, and a cost hook reported a session estimate).
  The install rewrote `.claude/settings.json` with the same content in a different key order. It
  also reported a `dependencies-refused` note: the npm packages the plugin's `package.json` lists were
  not installed, because that file sets `overrides`, which a plugin install does not apply. Which ECC
  hooks or skills need those packages is not established.

**GateGuard** (ECC's `gateguard-fact-force` hook, on by the owner's choice: OWNER DECISION,
2026-10-19, "Leave it as is"). It is not an error: it holds an action until the agent states facts,
then lets the same action through on retry. It holds:

| Action | Hook id | The agent states |
|---|---|---|
| The first Bash command of a session | `pre:bash:gateguard-fact-force` | The current request in one sentence, and what the command checks or produces |
| The first Edit or Write of each file | `pre:edit-write:gateguard-fact-force` | The file's importers or callers, the API it affects, the data shapes it reads or writes, and the owner's instruction verbatim |
| A command its classifier judges destructive, such as `rm -rf`, `git branch -D` or `git push --force` (not `git push --delete` or posting to GitHub) | `pre:bash:gateguard-fact-force` | Every file or piece of data it modifies or deletes, a one-line rollback, and the owner's instruction verbatim |

The Bash id is defined in the plugin's `scripts/hooks/bash-hook-dispatcher.js`, which `hooks.json`
reaches through `pre-bash-dispatcher.js`; the Edit/Write id is in `hooks.json`. Which commands count as
destructive is decided by `classifyDestructiveCommand` in `scripts/hooks/gateguard-fact-force.js`, so
test a command against it rather than guessing: a single Bash call that holds one destructive part is
held as a whole.

Agents answer with the real facts and retry the same call. They never set `ECC_GATEGUARD`,
`GATEGUARD_DISABLED`, `GATEGUARD_BASH_ROUTINE_DISABLED`, `GATEGUARD_EXEMPT_GLOBS`,
`GATEGUARD_BASH_EXTRA_DESTRUCTIVE`, `GATEGUARD_STATE_DIR` or `ECC_DISABLED_HOOKS` to get past it or
change what it holds: those switches (read in `scripts/hooks/gateguard-fact-force.js` and
`scripts/lib/hook-flags.js`) are the owner's. Captured 2026-10-19 from ECC v2.2.3; re-check with
`grep -n "process.env" scripts/hooks/gateguard-fact-force.js` in the plugin's marketplace clone.

**Install** (each machine, the owner's decision, because it turns on the hooks and the MCP server):
`claude plugin install ecc@ecc --scope project` (code.claude.com/docs/en/plugins/install, read
2026-10-19; not run here). Setting `hooks_enabled` to false does not stop the hook commands: Claude
Code still launches all 24, and ECC's own scripts read the option (`scripts/lib/hook-flags.js`) after
their bootstrap has run. Turning the hooks off completely means not installing or disabling the plugin.

**Disable:** `claude plugin disable ecc@ecc --scope project` sets `ecc@ecc` to `false` in
`.claude/settings.json` and leaves the marketplace pin, so `rules:check` still passes. Checked on a
scratch copy on 2026-10-19: the command reported success, the setting flipped (the command also
reorders the file's keys), and `rules:check` exited 0. A disable lands like any other change, by
pull request.

**Remove:** not a settings-only change, and not specified in full here. On a scratch copy
(2026-10-19), deleting the marketplace and `enabledPlugins` entries made `rules:check` refuse ("pins
ECC (none) but config/ecc-rules.json records v2.2.3") and `npm test` fail ("pins ECC to a release" in
`scripts/git/hooks.test.ts`). The guard, its test, `package.json`'s `rules:check`, the `guards` workflow
(which runs main's copy, so a removal lands in two steps), `config/ecc-rules.json`,
`config/governance-alignment.json`, the `claudeMdExcludes` list and `.claude/rules/ecc/` all go with it,
and 38 live files outside history mention ECC. List them with
`git grep -il ecc -- . ':!CHANGELOG.md' ':!docs' ':!wiki/decisions' ':!wiki/work' ':!.claude/rules/ecc'`
when planning it. On each machine, `claude plugin marketplace remove ecc` uninstalls the plugin and
removes its `enabledPlugins` entries (code.claude.com/docs/en/plugins/cli-reference, read 2026-10-19;
not run here). A removal is a branch of its own, on an owner decision.
