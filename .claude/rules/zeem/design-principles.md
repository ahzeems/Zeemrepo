# Design principles

Additions to ECC's `coding-style.md` and `patterns.md`. The size and nesting limits are ECC's (functions
under 50 lines, files under 800, nesting at most 4; OWNER DECISION, 2026-10-09: "4, as ECC"), and
`eslint.config.ts` enforces them, so they are not restated here.

## Before writing

- State the outcome and the acceptance criteria as observable results, what is out of scope, and the open
  questions. A question only the owner can answer is marked awaiting input (`owner-authority.md`). For a
  small, settled change this is one line of the plan below.
- Read the nearest existing module that does something similar, in full, and match its conventions.
- Find the tests, importers and callers of what you will change before editing it, not after. Re-read a
  file before relying on it when it changed since you read it or the read was truncated.
- Plan as ECC's development workflow says (the `planner` agent or `/ecc:plan`, with its planning
  documents for a feature), and state what changes, which files and what could break.
- Challenge a brief that duplicates an existing capability or crosses an ownership boundary before the first
  edit.

## Shape of the change

- Make the smallest diff that solves the problem. When refactoring, prefer deleting code to adding it.
- Integrate a new requirement as if it had been there from the start: update every type, doc, example and
  rationale it touches. Design the whole, deliver it in slices.
- When a task seems to need a new signal threaded through types, schemas or pipelines, look for a more direct
  path first.
- Put a repeated decision behind one source of truth instead of repeating it.
- Add an abstraction or interface only when two real consumers need it. No feature flags or
  backwards-compatibility shims for code that can simply be changed; check the actual consumers first.
- Collapse wrappers with one caller, adapters with one implementation, and pass-through layers.
- Keep state as narrow as possible: return values over mutation, locals over fields, fields over module
  state, module state over globals. Derive values instead of keeping copies in sync.
- A new reader should be able to answer "where does X come from?" and "what can change X?" in under 30
  seconds.

## Boundaries and side effects

- Validate at system boundaries (user input, external APIs, the network, file and git content) and
  handle errors explicitly at every level, as ECC's `coding-style.md` says.
- Repository CLIs validate their inputs and refuse before changing the repository or a remote, saying why;
  report independent refusals together. Exit codes come from `scripts/lib/cli.ts`: 0 ok, 1 refused, 2 the
  tool failed or was called wrongly.
- Comments are off by default. Write one only for a reason the code cannot show: a hidden constraint, a
  workaround, an invariant.
- Match each language's naming: camelCase in TypeScript, kebab-case file names and CLI flags.

## ECC

ECC wins where this file and ECC disagree (`CLAUDE.md`): its research step before any implementation,
its planning workflow, its input validation and error handling, and its size limits apply as written.
`eslint.config.ts` still skips blank lines and comments when it measures a function and lifts the
function limit for test files; aligning it with ECC's line count is open work.
