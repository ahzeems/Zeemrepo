# Zeemrepo

## Claude Code setup: ECC

This repo uses the official [ECC](https://github.com/affaan-m/ECC) plugin (`ecc@ecc`), **scoped to this project only**. It is not installed globally.

What's included:
- **Plugin `ecc@ecc`**: 68 agents, about 290 skills and 94 commands (as `/ecc:<name>`), lifecycle hooks (standard profile), and the chrome-devtools MCP server. Declared in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`), so anyone who opens this repo in Claude Code is offered the plugin.
- **Rules**: the complete ECC rule set (`common/` plus every language pack) in `.claude/rules/ecc/`. Plugins can't ship rules, so they're vendored here. Language rules apply only to matching file paths.

Requirements: Claude Code ≥ 2.1, Node.js ≥ 18, git. Python 3 is optional and used by the continuous-learning observer.

### Update
```bash
claude plugin marketplace update ecc
claude plugin update ecc@ecc --scope project
# then refresh the rules from the same checkout:
rm -rf .claude/rules/ecc && cp -R ~/.claude/plugins/marketplaces/ecc/rules .claude/rules/ecc && rm .claude/rules/ecc/README.md
```

### Configure hooks
Run `/plugin configure ecc@ecc` inside Claude Code and set `hooks_enabled` (true/false) and `hook_profile` (`minimal` | `standard` | `strict`).
For per-session overrides, use the env vars `ECC_HOOK_PROFILE` and `ECC_DISABLED_HOOKS`.

### Not used
- ECC's `install.sh` / manual install. Don't run it on top of the plugin, or the hooks will run twice.
- Codex, Cursor, Gemini, OpenCode and other harness integrations, plus the `multi-*` commands, which need the external ccg-workflow runtime.
- Hermes is deferred (later: `install.sh --target hermes`).
