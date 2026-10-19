# Zeemrepo

A Claude Code workspace for agent governance: rules, compliance checks and a typed wiki. Claude Code is the only
harness, with the ECC plugin (`ecc@ecc`, pinned in `.claude/settings.json`).

## Non-negotiable

- **Nothing is pushed to `main`.** Each piece of work lives on one integration branch until it is complete,
  then gets one pull request through `npm run pr`. Only the owner approves and merges on GitHub; never merge
  or approve a pull request, even where an ECC command suggests `gh pr merge`.
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

ECC is this repository's foundation. Where a `zeem` rule, a repository skill or a wiki page disagrees
with an ECC rule or skill, ECC wins; fix the other text (OWNER DECISION, 2026-10-19: "ECC wins
everywhere"). The `zeem` rules add what ECC does not cover, and nothing in the repository may block or
restrict the ECC plugin. The one exception is GitHub reviews and merges: only the owner approves,
requests changes or merges, and agents post review findings as pull request comments (OWNER DECISION,
2026-10-19: "You merge it", "Comments only"), even where an ECC command such as `/pr` or
`/ecc:code-review` would merge or submit a review.

## Working here

- Node from `.nvmrc`; `npm ci`, then `npm run hooks:install` once per checkout.
- `npm run check` runs everything CI runs: lint, typecheck, tests with coverage, `evals:test`, `wiki:lint`, `skills:lint`,
  `governance:check`, `rules:check`, `wiki:compliance`, `changelog:guard`, `memory:guard`.
- Scripts are TypeScript run directly by Node, under `scripts/<area>/`, each with a sibling `*.test.ts`. The one
  exception is the compliance harness in `evals/compliance/` (Python, because ECC's skill-comply is), tested by `evals:test`.
- The wiki starts at `wiki/Home.md`. Load the `wiki-memory` skill before writing under `wiki/`.
- Reviewers: the ECC review agents, plus `.claude/agents/finder.md` and `.claude/agents/verifier.md`.
