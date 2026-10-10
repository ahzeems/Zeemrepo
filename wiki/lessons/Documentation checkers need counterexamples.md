---
type: lesson
title: Documentation checkers need counterexamples
summary: A checker tested only on current prose can pass negated claims or reject valid prohibitions; replay both broken and valid documents through the real checker.
tags: [area/agents, area/typescript, area/docs, kind/pitfall]
created: 2026-09-21
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Wiki validation needs parsed metadata]]"]
---

## What happened

In an earlier repository, a review of a documentation checker (one that asserted the docs described the vault
location and the optional viewer correctly) had already found three assertions that matched
vocabulary without proving the named claim. A replay against the merged checker found more:
negated location and viewer claims passed, while CRLF wrapping and a valid prohibition failed.

The cause was not a missing keyword. Testing only the current documents gave no signal for what
the checker should reject or tolerate.

## Fix

A replay test called the same checker function as the live repository test, with valid and
broken controls and a named expected failure for each. The initial replay had four failures; the
corrected checker and live contract then passed together, through `npm test`.

A first replay ran the checker in a disposable child process. It inherited Node's test-runner
context and skipped nested tests, so it counted nothing. Clearing `NODE_TEST_CONTEXT` made that
replay meaningful; the kept replay calls the function in process and avoids the problem.

That specific documentation checker was not ported to Zeemrepo. The method was, and made
structural: each repository checker has a pair of fixture trees under `scripts/fixtures/valid/`
and `scripts/fixtures/broken/` (today for `wiki-lint`, `skill-lint` and `governance-guard`).
Their tests run the real CLI against both and assert that the valid tree passes and the broken
tree fails with the named problems (for example `scripts/wiki/wiki-lint.test.ts`).

## How to apply

For each new rule, show a valid input and a broken input that differs in the relevant claim.
Assert that the mutation happened and that the intended rule failed. Exercise the real checker,
not a copied expression. Keep known failures as regression inputs after correcting them. For a
new checker in Zeemrepo, add its `valid/` and `broken/` fixture pair.

If a test spawns a nested `node --test`, clear `NODE_TEST_CONTEXT` in the child's environment,
or the child's tests may be skipped and a skipped child will look like a pass.

Known phrases are a bounded check: they cannot establish general semantic correctness. A
positive result is evidence for the inputs tried, not a claim that every future contradiction
will be caught.
