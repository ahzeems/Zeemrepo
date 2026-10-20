# Zeemrepo

A workspace for agent governance: rules, compliance checks and a typed wiki. Any agent harness and model
provider may work here under the same rules. `AGENTS.md` points to this shared constitution.

## Non-negotiable

- **Nothing is pushed to `main`.** Work on a branch, finish with `npm run pr`, and leave merging to the owner on
  GitHub. Never merge or approve a pull request.
- **Test first.** Reproduce the failure, write a failing test, then implement and run the checks. Use ECC's TDD
  workflow when available, or the same method with the current harness's tools.
- **Every branch records itself:** a new changelog fragment, `changelog/<YYYY-MM-DD>-<slug>.md`, an updated work record
  under `wiki/work/`, and an operating doc when workflow-critical files change. `npm run check` refuses a branch without them.

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

## Harnesses and providers

- Use the tools and credentials of the current harness. General planning, authoring and verification do not
  require Claude Code, its login or the ECC plugin. The integration for Claude Code pins `ecc@ecc` in
  `.claude/settings.json`; the vendored ECC engineering rules apply to every agent.
- Keep one canonical skill library in `.claude/skills/`. When native discovery is unavailable, read the
  relevant skill file and follow its method. Use available equivalent reviewer contexts and report substitutions.
- Attribute new notes to the actual authoring harness or agent with a kebab-case `agent` value. Any provider
  is accepted; record model and provider details in review evidence. See
  `wiki/runbooks/Work with any agent provider.md` and ADR-0026.

## Working here

- Node from `.nvmrc`; `npm ci`, then `npm run hooks:install` once per checkout.
- `npm run check` runs everything CI runs: lint, typecheck, tests with coverage, `evals:test`, `wiki:lint`, `skills:lint`,
  `governance:check`, `rules:check`, `wiki:compliance`, `changelog:guard`, `memory:guard`. The one exception is
  `npm run sandbox:smoke`, the real container control, which needs Docker and runs in the required CI `check` job.
- Scripts are TypeScript run directly by Node, under `scripts/<area>/`, each with a sibling `*.test.ts`. The one
  exception is the compliance harness in `evals/compliance/` (Python, because ECC's skill-comply is), tested by `evals:test`.
- The wiki starts at `wiki/Home.md`. Load the `wiki-memory` skill before writing under `wiki/`.
- Reviewers: available independent contexts following `.claude/agents/finder.md` and
  `.claude/agents/verifier.md`, or the ECC review agents when installed.
