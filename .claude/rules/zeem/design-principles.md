# Design principles

Additions to ECC's `coding-style.md` and `patterns.md`. The size and nesting limits are ECC's (functions
under 50 lines, files under 800, nesting at most 4; OWNER DECISION, 2026-10-09: "4, as ECC"), and
`eslint.config.ts` enforces them, so they are not restated here.

## Before writing

- Read the nearest existing module that does something similar, in full, and match its conventions.
- Find the importers and callers of what you will change before editing it, not after.
- State the plan in three to six lines: what changes, which files, what could break. If it needs more, the
  task is too big; say so instead of building.
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

- Validate at real boundaries: user input, external APIs, the network, file and git content. Do not add
  defensive checks against your own code or guarantees the language or Node already makes. This narrows ECC's
  "validate all input" to where input actually enters.
- Repository CLIs validate every input and refuse before any side effect, reporting every refusal reason.
  Exit codes come from `scripts/lib/cli.ts`: 0 ok, 1 refused, 2 the tool failed.
- Comments are off by default. Write one only for a reason the code cannot show: a hidden constraint, a
  workaround, an invariant.
- Match each language's naming: camelCase in TypeScript, kebab-case file names and CLI flags.
