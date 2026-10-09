---
type: lesson
title: Wiki validation needs parsed metadata
summary: A line-based frontmatter parser accepted malformed metadata because it checked strings without parsing YAML.
tags: [area/typescript, area/docs, area/wiki, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Wiki frontmatter must accept Windows line endings]]", "[[Documentation checkers need counterexamples]]"]
---

## What happened

During a 2026-09-20 audit of Zimi, isolated copies of the vault still passed validation after
adding duplicate `status` fields, replacing the closing marker with `---oops`, or making
`related` a scalar. The parser split lines, overwrote duplicate keys, and accepted a prefix of
the closing delimiter. The existing checks exercised only the real, valid vault.

## Fix

Parse an exactly delimited frontmatter block with the declared `yaml` dependency. Treat its
output as unknown until checked. Validate required strings, real dates, YAML lists, links, and
supported note types. Keep the validator separate from its CLI so tests can exercise disposable
vaults without rewriting repository notes.

In Zeemrepo the parser is `parseFrontmatter` in `scripts/lib/frontmatter.ts`, shared by every
script that reads frontmatter. It requires an exact `---` fence, parses with `yaml` with
duplicate keys rejected and alias expansion capped, and returns `none`, `invalid` (with a
reason) or `ok`. "None" and "invalid" are distinct, so a record cannot opt out of checking by
corrupting its own frontmatter. `scripts/lib/frontmatter.test.ts` covers duplicate keys and
unterminated or near-miss fences. `scripts/wiki/wiki-validation.ts` then checks types, required
strings, real `YYYY-MM-DD` dates, lists and links.

## How to apply

Run `npm test` to exercise valid and malformed inputs, then `npm run wiki:lint` for the real
vault. Do not equate a passing valid-input example with proof that a validator rejects bad
input: give every validator malformed cases (duplicate keys, wrong types, broken delimiters)
alongside the valid ones. Both inline and block YAML lists are valid; the requirement is typed
values, resolvable links and real dates, not one spelling.

Ported from Zimi `wiki/lessons/Wiki validation needs parsed metadata.md` at 9fb36b2.
