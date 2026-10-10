# Zeemrepo

A Claude-Code-only repository for agent governance, compliance and evaluation work, migrated
from the earlier Zimi repository with every kept rule enforced by a check and reviewed by
[ECC](https://github.com/affaan-m/ECC). The migration audit is in `docs/migration/`.

## Rules that never bend

- Nothing is pushed to `main`. Every change is a branch and a pull request; only the owner
  merges, on GitHub. The `main` ruleset, the git hooks and Claude Code settings all enforce it.
- `npm run check` must pass. CI runs it, and runs main's copy of the guards against each PR.

## Setup

Requirements: Node 24 (`.nvmrc`; `package.json` engines `>=24.0.0`), git 2.36 or later, `gh` logged in.

```bash
npm ci
git config --get core.hooksPath   # inspect first; then:
npm run hooks:install
npm run check
```

## Working here

| Command | What it does |
|---|---|
| `npm run check` | Lint, types, tests (80% lines and functions, 70% branches) and the repository guards |
| `npm run pr` | Checks the branch, pushes it and opens or reports its pull request; never merges |
| `npm run audit` | Confirms every commit on main since the PR-only rule landed by merged pull request |
| `npm run worktree:guard` | Reports checkouts holding the only copy of some work |

The full path from branch to merge is the runbook `wiki/runbooks/Land a change.md`. What each
branch must record (changelog, work record, operating docs) is `wiki/reference/Change records.md`.

## Layout

| Path | Contents |
|---|---|
| `scripts/` | The guards and their tests (`node:test`, run as TypeScript directly) |
| `config/` | Guard configuration: governance claims, skill standards, landing audit |
| `wiki/` | Shared memory: notes, decisions, lessons, runbooks and work records (`wiki-memory` skill) |
| `.claude/skills/` | Repository skills migrated from Zimi; provenance in `import-baseline.json` |
| `CLAUDE.md` | The constitution: three non-negotiables and where each rule lives |
| `.claude/rules/zeem/` | This repository's rules, distilled from Zimi; they override ECC where they disagree |
| `.claude/rules/ecc/` | Every ECC rule set, vendored unchanged (without ECC's rules README, with its LICENSE) and held to the plugin pin by `npm run rules:check` |
| `.claude/agents/` | No-edit review agents: `finder` (reads only) and `verifier` (also runs checks) |
| `.github/workflows/` | `check` (the change's own checks) and `guards` (main's guards, `pull_request_target`) |
| `CHANGELOG.md` | One entry per branch |

## ECC

The ECC plugin (`ecc@ecc`) is enabled for this project only, pinned to the `v2.2.3` release tag
in `.claude/settings.json`. To update: change that `ref`, then run
`claude plugin marketplace update ecc` and `claude plugin update ecc@ecc --scope project`, and
refresh `.claude/rules/ecc/` from the same checkout. Do not also run ECC's `install.sh`, or its
hooks run twice.
