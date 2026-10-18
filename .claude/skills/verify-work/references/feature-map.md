# Feature map

This map is the verification interface for this repository. It lists recipes, not passed
results. A change review selects the affected entries; a full audit covers every entry and
reports any recipe it could not run as blocked.

## Launch and evidence

Run from the selected feature checkout. Before each recipe, inspect `git status --short`,
`node --version` and `npm --version`; use Node 24 (`.nvmrc`; package.json `engines`) and
dependencies installed with `npm ci`. Confirm the pinned tree from step 1 has not changed.

Every repo CLI exits 0 when the check passes, 1 when it refuses, and 2 when the tool itself
failed (scripts/lib/cli.ts). A 1 is a valid refusal; a 2 is a broken check, not a verdict.
Record commands, revision, named tests, exit codes and limits in the PR comment.

## Features and recipes

Paths are relative to the repository root.

| Feature | Source to inspect | Recipe and expected observation |
|---|---|---|
| Wiki validation | scripts/wiki/wiki-lint.ts, scripts/wiki/wiki-validation.ts, scripts/wiki/schema.ts, scripts/wiki/work-tracking.ts, scripts/wiki/redaction.ts, scripts/fixtures/valid/, scripts/fixtures/broken/ | Run `npm run wiki:lint`: it exits 0 on this vault. Run `npm test`: the wiki-lint CLI accepts scripts/fixtures/valid/ and refuses scripts/fixtures/broken/, and the validation and work-tracking tests prove invalid metadata, unresolved links, missing sections and work-record errors (for example a closed issue without root_cause) are refused. Do not corrupt live notes to test refusal. |
| Wiki commit rule and history | scripts/wiki/wiki-compliance.ts, scripts/wiki/wiki-compliance-validation.ts, scripts/wiki/wiki-history.ts | Run `npm run wiki:compliance` on the branch: it exits 0 when every commit touching wiki/ holds only wiki files with a `docs(wiki): ` subject and no note breaks its history rules, 1 naming each mixed or mis-titled commit and each `[body]`, `[renamed]`, `[deleted]`, `[metadata]`, `[immutable]` or `[updated]` finding, and 2 for a shallow clone or an unreadable earlier note. scripts/wiki/wiki-history.test.ts pins commit dates in disposable repositories. `node scripts/wiki/wiki-compliance.ts --staged` checks the index; `--json` gives structured output. Tests use disposable repositories; never rewrite real history to probe it. |
| Shared lib | scripts/lib/ (cli.ts, git.ts, frontmatter.ts, paths.ts, walk.ts, record.ts, change-policy.ts) | Run `npm test`. Each module has a sibling `.test.ts`; cli.test.ts pins the 0/1/2 exit codes. Read the changed module against its test: a passing suite that never loads the changed path proves nothing. |
| Toolchain checks | eslint.config.ts, tsconfig.json, package.json, scripts/toolchain/test-pairing.ts, scripts/toolchain/eslint-limits.test.ts | Run `npm run lint`, `npm run typecheck` and `npm test`. `npm test` enforces 80% line and function coverage and 70% branch coverage; test-pairing fails a script with no sibling test; eslint-limits proves the lint limits through the real config. |
| Sandbox containment | scripts/sandcastle/containment-smoke.ts, scripts/sandcastle/containment-smoke-guest.ts, .sandcastle/Dockerfile, .sandcastle/.dockerignore, .github/workflows/check.yml | Needs Docker. Run `npm run sandbox:smoke`: it exits 0 only when the guest reports Ubuntu 26.04 and Python 3.12 or later, the guest's checks pass, the planted `core.fsmonitor` fired inside the container during the SDK's `close()`, no marker appeared on the host, the host checkout's git state is unchanged and `docker inspect` showed no mounts, privilege or credential, and the verifier control (the Verification receipts row) passed on the same image. Without Docker it must exit 1 with "blocked"; that is blocked coverage, not a pass. `npm test` covers the verdict with a fake `docker` and runs the guest's SDK probe in a child process. On a pull request, read the required `check` job's "Prove the sandbox boundary" step. |
| Candidate quarantine | scripts/sandcastle/artifact.ts, scripts/sandcastle/quarantine.ts, scripts/test-support/artifact-fixture.ts | Run `node --test scripts/sandcastle/artifact.test.ts scripts/sandcastle/quarantine.test.ts`: real full and incremental bundles from disposable repositories are accepted with their exact SHA, and each broken control refuses (identity, prerequisite, size, digest, header, symlink, unexpected entry, executable file, unknown manifest key, forged phase label, a tree with a `.git` entry, a FIFO or unreadable file, a ref naming a tag, and a delta bomb stopped by `GIT_ALLOC_LIMIT`), with control characters escaped in refusal text. A Git command past its deadline or over its output cap is refused (exit 1) with its whole process group killed: the slow-import case checks that no process naming the quarantine survives, and `runGit` cases cover a kill that finds the group gone, output after git's exit and the exact cap boundary. The sentinel cases also show the planted guest fsmonitor, hooks and tracked hooks fire in the guest but never during quarantine, and that the host user's `uploadpack.packObjectsHook` does not run. For the CLI, build an artifact with `createCandidate` and run `node scripts/sandcastle/quarantine.ts --help` for the flags: 0 accepted, 1 refused (the quarantine directory is kept), 2 bad usage. Acceptance is not verification, review or publication. |
| Verification receipts | scripts/sandcastle/verifier-driver.ts, scripts/sandcastle/verification-receipt.ts, scripts/sandcastle/container-runtime.ts, scripts/sandcastle/verify-candidate.ts, scripts/sandcastle/verifier-driver-smoke.ts, scripts/test-support/verifier-fixture.ts | Run `node --test scripts/sandcastle/verifier-driver.test.ts scripts/sandcastle/verification-receipt.test.ts scripts/sandcastle/container-runtime.test.ts scripts/sandcastle/verify-candidate.test.ts scripts/sandcastle/verifier-driver-smoke.test.ts`: the driver, with a fake runtime and fake reviewer responses, issues a receipt for a passing candidate that validates from the host store, and each control refuses (forged or tampered receipt, wrong repository, task, run, base or candidate, changed check definitions, missing or mutated review, failing step claimed passed, a no-op check rewrite, a store inside the source or artifacts at issue or at validation, a repeated receipt key, an unsafe container, a forbidden host path in a Docker argument, package-manager delegation in a base check, and a reuse attempt across a changed repository, task, base, check definitions, runner, image or reviewer). `container-runtime.test.ts` also runs the real step script locally: a candidate `unittest` package exits 0 without `PYTHONSAFEPATH` and the guarded step still fails, and a tracked file the candidate's `.gitignore` covers stays tracked in the prepared checkout. `npm run sandbox:verify -- --help` lists the flags; run on a real candidate it must exit 1 with "blocked: no reviewer" until the owner authorises a live reviewer. The real-container path runs only inside `npm run sandbox:smoke` (needs Docker); read the CI `check` job. A receipt is not publication. |
| Sandcastle coordinator | .sandcastle/main.ts, scripts/sandcastle/coordinator.ts, scripts/sandcastle/coordinator-entry.test.ts, scripts/sandcastle/coordinator.test.ts, scripts/test-support/coordinator-fake-sdk.ts, scripts/test-support/coordinator-hooks.ts | Never run `npm run sandcastle` to verify: it starts real agents. Run `node --test scripts/sandcastle/coordinator-entry.test.ts scripts/sandcastle/coordinator.test.ts`. The entry tests import the real `.sandcastle/main.ts` in-process with `@ai-hero/sandcastle` resolved to the fake, in disposable Git repositories, and check the planner, sandbox, implementer, reviewer, close and merger calls, their options and the log lines; the first test fails unless the resolver returns the fake. To prove a control, change a transition in `coordinator.ts` (skip the reviewer, the merger or `close()`, or merge before executing) or make `main.ts` stop calling `coordinate`, and confirm a named test fails. `npm test` must list `.sandcastle/main.ts` and `coordinator.ts` in its coverage table. Not covered: the real SDK (worktrees, commit collection, `Output.object` parsing), Docker, models, prompt effects and GitHub. |
| Skill standards | scripts/skills/ (skill-lint.ts CLI, skill-validation.ts, provenance.ts, skill-standards.ts, markdown-references.ts), config/skill-standards.json, .claude/skills/import-baseline.json | Run `npm run skills:lint`: it exits 0 when every skill meets the standard, 1 naming each refused rule (frontmatter, size, citations, em dashes, user-only flag, baseline provenance), and 2 when the tool itself failed. Run `node scripts/skills/skill-lint.ts --root scripts/fixtures/broken/skill-lint`: it must exit 1. Run `npm test`: scripts/skills/*.test.ts cover each rule, the fixture libraries and landed-provenance history in disposable repositories. Do not break live skills to test refusal. |

## Coverage boundaries

`npm run check` runs lint, typecheck, tests with coverage, `evals:test`, `wiki:lint`,
`skills:lint`, `governance:check`, `rules:check`, `wiki:compliance`, `changelog:guard` and
`memory:guard` (the list in `package.json`; CI runs `check:base`, the same without the last two, for
Dependabot). CI also runs `npm run sandbox:smoke`, which needs Docker and is not in `npm run check`. The compliance harness (`evals/compliance/`) is tested by `evals:test` without a model;
a live compliance run spends model time and needs the owner's approval.
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

`scripts/git/` (branch-guard, git-state, pr-ready, landing-audit, worktree-guard), `.githooks/`,
`.github/workflows/{check,guards}.yml`, and the Claude Code hook `scripts/claude/block-pr-merge.ts`.
Drive with `npm run pr -- --dry-run`, `npm run audit` and `npm run worktree:guard`; the hooks run
on commit and push once `npm run hooks:install` is done. CI can only be observed on a pull
request: `gh pr checks <n>`. Steps: `wiki/runbooks/Land a change.md`.
