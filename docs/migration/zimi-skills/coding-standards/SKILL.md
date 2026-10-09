---
name: coding-standards
description: "Repo-wide coding standards: naming, structure, errors, tests, and dependencies. Load before code work or code-quality review."
---

## Naming

- Descriptive over clever; no unexplained abbreviations.
- Match the language's own convention rather than importing another language's style:
  `snake_case` (Python), `camelCase` (JS/TS), `kebab-case` (file/script names, CLI flags).

## Structure

- Small functions, single responsibility. Nesting past 3 levels is a signal to extract, not to
  add another `if`.
- No abstraction or interface until two real consumers need it — duplication is cheaper than
  the wrong abstraction. The rule's home is `architecture-principles` ("When to abstract").

## Error handling

- Fail loudly in scripts/tools — no silent `except: pass` / swallowed errors.
- Validate only at real boundaries (user input, external APIs, network). Trust internal code
  and stdlib/framework guarantees rather than defensive-checking everything.

## Comments

- Default to none. Write one only when the *why* isn't obvious from the code — a hidden
  constraint, a workaround for a specific bug, a non-obvious invariant.
- Never comment *what* the code does; a well-named identifier already says that.

## Testing

- Every new piece of logic needs a way to verify it's correct — a unit test for pure logic, a
  manual/smoke check is acceptable for small glue scripts at this repo's current scale.
- Don't add test scaffolding disproportionate to what's being tested (no unit-test harness for
  a 5-line shell script).
- These two rules decide *whether* something needs a test. For *how* to write one (test first,
  where the seam goes, what a test must not couple to), load `tdd` for a practical bug regression; use the approved plan
  and `verify-work` for other test seams. No general test-first skill is installed.

## Dependencies

- Prefer stdlib / no dependency for small scripts.
- Any added dependency needs a one-line justification in the commit that adds it.

## Growth

Open questions this skill doesn't yet have a first-principles answer to are recorded in
wiki/work/research/ and refined through `write-skill`. Answer from a primary source only
(the language's own docs, a specification, the tool's own source) — never a blog post's
summary of one. The source's Python/Ruff environment questions do not apply to this
TypeScript repository; no replacement question or answer is invented.

## Deep-dive references

(Empty — no research update has landed yet.)
