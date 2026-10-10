---
type: lesson
title: Wiki frontmatter must accept Windows line endings
summary: The wiki linter must normalize CRLF before parsing frontmatter so valid notes pass on Windows and WSL checkouts.
tags: [area/docs, area/typescript, area/wiki, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Wiki validation needs parsed metadata]]"]
---

## What happened

In an earlier repository, after importing `main` into a Windows checkout, wiki lint reported missing or
unterminated frontmatter for 15 existing notes. Their metadata was present, but the parser
required LF line endings while the checkout contained CRLF. A valid document was rejected
because its line separators differed, not because required fields were absent.

## Fix

Normalize CRLF to LF at the start of frontmatter parsing. Keep the metadata and schema checks
intact. Do not rewrite historical note bodies to work around a parser limitation.

In Zeemrepo, `parseFrontmatter` in `scripts/lib/frontmatter.ts` strips a leading byte-order
mark and replaces `\r\n` with `\n` before matching the fences. `scripts/lib/frontmatter.test.ts`
parses a CRLF note and expects the same data and an LF body.

## How to apply

Test any line-based parser with LF and CRLF variants of a valid input; both must pass. Keep a
control without its opening delimiter, which must still fail. Then run `npm run wiki:lint` on
the actual checkout.
