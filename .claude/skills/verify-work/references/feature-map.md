# Feature map

This map is the verification interface for this repository. It lists recipes, not passed
results. A change review selects the affected entries; a full audit covers every entry and
reports any recipe it could not run as blocked.

## Launch and evidence

Run from the selected feature checkout. Before each recipe, inspect `git status --short`,
`node --version` and `npm --version`; use Node >=22.18 (package.json `engines`) and
dependencies installed with `npm ci`. Confirm the pinned tree from step 1 has not changed.

Every repo CLI exits 0 when the check passes, 1 when it refuses, and 2 when the tool itself
failed (scripts/lib/cli.ts). A 1 is a valid refusal; a 2 is a broken check, not a verdict.
Record commands, revision, named tests, exit codes and limits in the PR comment.

## Features and recipes

Paths are relative to the repository root.

| Feature | Source to inspect | Recipe and expected observation |
|---|---|---|
| Wiki validation | scripts/wiki/wiki-lint.ts, scripts/wiki/wiki-validation.ts, scripts/wiki/schema.ts, scripts/wiki/work-tracking.ts, scripts/wiki/redaction.ts, scripts/fixtures/valid/, scripts/fixtures/broken/ | Run `npm run wiki:lint`: it exits 0 on this vault. Run `npm test`: the wiki-lint CLI accepts scripts/fixtures/valid/ and refuses scripts/fixtures/broken/, and the validation and work-tracking tests prove invalid metadata, unresolved links, missing sections and work-record errors (for example a closed issue without root_cause) are refused. Do not corrupt live notes to test refusal. |
| Wiki commit rule | scripts/wiki/wiki-compliance.ts, scripts/wiki/wiki-compliance-validation.ts | Run `npm run wiki:compliance` on the branch: it exits 0 when every commit touching wiki/ holds only wiki files with a `docs(wiki): ` subject, and 1 naming each mixed or mis-titled commit. `node scripts/wiki/wiki-compliance.ts --staged` checks the index; `--json` gives structured output. Tests use disposable repositories; never rewrite real history to probe it. |
| Shared lib | scripts/lib/ (cli.ts, git.ts, frontmatter.ts, paths.ts, walk.ts, record.ts, change-policy.ts) | Run `npm test`. Each module has a sibling `.test.ts`; cli.test.ts pins the 0/1/2 exit codes. Read the changed module against its test: a passing suite that never loads the changed path proves nothing. |
| Toolchain checks | eslint.config.ts, tsconfig.json, package.json, scripts/toolchain/test-pairing.ts, scripts/toolchain/eslint-limits.test.ts | Run `npm run lint`, `npm run typecheck` and `npm test`. `npm test` enforces 80% line and function coverage and 70% branch coverage; test-pairing fails a script with no sibling test; eslint-limits proves the lint limits through the real config. |
| Skill standards | scripts/skills/ (skill-lint.ts CLI, skill-validation.ts, provenance.ts, skill-standards.ts, markdown-references.ts), config/skill-standards.json, .claude/skills/import-baseline.json | Run `npm run skills:lint`: it exits 0 when every skill meets the standard, 1 naming each refused rule (frontmatter, size, citations, em dashes, user-only flag, baseline provenance), and 2 when the tool itself failed. Run `node scripts/skills/skill-lint.ts --root scripts/fixtures/broken/skill-lint`: it must exit 1. Run `npm test`: scripts/skills/*.test.ts cover each rule, the fixture libraries and landed-provenance history in disposable repositories. Do not break live skills to test refusal. |

## Coverage boundaries

`npm run check` runs lint, typecheck, tests with coverage, `wiki:lint`, `skills:lint` and
`wiki:compliance`.
It does not prove Obsidian rendering, model behavior, or GitHub permissions. A recipe that
could not run stays blocked coverage, not a pass.

Add a feature only with its real source path, prerequisite, and observable recipe. Product
defects go to wiki issues; never rewrite behavior to make this map pass.

## Change records and governance

`scripts/changes/` (changelog-guard, repo-memory-guard, branch-diff) and `scripts/governance/`
with `config/governance-alignment.json`. Drive with `npm run changelog:guard`,
`npm run memory:guard` and `npm run governance:check` (exit 0 ok, 1 refused, 2 failed);
`node scripts/governance/governance-guard.ts --root scripts/fixtures/broken/governance-guard`
must exit 1. Rules: `wiki/reference/Change records.md`.

## Landing path

`scripts/git/` (branch-guard, pr-ready, landing-audit, worktree-guard), `.githooks/`,
`.github/workflows/{check,guards}.yml`, and the Claude Code hook `scripts/claude/block-pr-merge.ts`.
Drive with `npm run pr -- --dry-run`, `npm run audit` and `npm run worktree:guard`; the hooks run
on commit and push once `npm run hooks:install` is done. CI can only be observed on a pull
request: `gh pr checks <n>`. Steps: `wiki/runbooks/Land a change.md`.
