# Zeemrepo

A Claude Code workspace for agent governance: rules, compliance checks and a typed wiki. Claude Code is the only
harness, with the ECC plugin (`ecc@ecc`, pinned in `.claude/settings.json`).

## Non-negotiable

- **Nothing is pushed to `main`.** Work on a branch, finish with `npm run pr`, and leave merging to the owner on
  GitHub. Never merge or approve a pull request.
- **Test first.** ECC's TDD workflow is mandatory.
- **Every branch records itself:** a `CHANGELOG.md` entry, an updated work record under `wiki/work/`, and an
  operating doc when workflow-critical files change. `npm run check` refuses a branch without them.

## Where the rules live

Each rule has one home. Read the file before acting in its area.

| Area | File |
|---|---|
| Branches, worktrees, landing | `.claude/rules/zeem/branch-and-merge.md` |
| Changelog, work records, scope | `.claude/rules/zeem/change-records.md` |
| Evidence labels, verification, review | `.claude/rules/zeem/evidence-and-review.md` |
| Owner decisions and authorization | `.claude/rules/zeem/owner-authority.md` |
| Design and code shape | `.claude/rules/zeem/design-principles.md` |
| Wiki and documentation | `.claude/rules/zeem/wiki-and-docs.md` |
| Skills | `.claude/rules/zeem/skills.md` |
| General engineering (vendored ECC) | `.claude/rules/ecc/` |

Where a `zeem` rule disagrees with an ECC rule, a skill (ECC or repository) or a wiki page, the `zeem`
rule wins; fix the other text or record why it stays. A `zeem` file that overrides
ECC says so under "Overrides of ECC".

## Working here

- Node from `.nvmrc`; `npm ci`, then `npm run hooks:install` once per checkout.
- `npm run check` runs everything CI runs: lint, typecheck, tests with coverage, `evals:test`, `wiki:lint`, `skills:lint`,
  `governance:check`, `rules:check`, `wiki:compliance`, `changelog:guard`, `memory:guard`.
- Scripts are TypeScript run directly by Node, under `scripts/<area>/`, each with a sibling `*.test.ts`.
- The wiki starts at `wiki/Home.md`. Load the `wiki-memory` skill before writing under `wiki/`.
- Reviewers: the ECC review agents, plus `.claude/agents/finder.md` and `.claude/agents/verifier.md`.
