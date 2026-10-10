---
type: lesson
title: Skill restoration needs source comparison
summary: A valid skill entry point can still lose the original method and its companion files; compare the full supplied source before accepting a restoration.
tags: [area/agents, area/docs, tool/claude-code, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Skill integration must preserve the method]]", "[[Skill standards]]"]
---

## What happened

In an earlier repository, the `domain-modeling` skill's `SKILL.md` had become a local rewrite, and its two linked
format guides were missing. The supplied original showed what had been lost: the context-boundary
examples and the glossary format. The skill still loaded and passed the repository's checks,
because those checks validated code and wiki structure, not fidelity to an external source. Why the
earlier author replaced the method is unknown; the observable cause was replacement during local
adaptation.

## Fix

The original entry point and companion files were restored. Attribution went into a separate
footer and repository bindings into the repository instructions, leaving the method text alone.
Direct text and hash comparisons passed after the repair.

In Zeemrepo the skill lives at `.claude/skills/domain-modeling/` with its companions
`CONTEXT-FORMAT.md` and `ADR-FORMAT.md`. What `npm run skills:lint` checks today, read from
`scripts/skills/skill-validation.ts` and `scripts/skills/provenance.ts`:

- the installed `SKILL.md` matches the latest hash recorded for it in
  `.claude/skills/import-baseline.json`;
- every relative link in `SKILL.md` points to a file that exists, and every heading anchor it cites
  exists in that file.

So a deleted companion file fails the lint, but a rewritten one does not: companion files are not
hashed.

## How to apply

- For a restoration, inventory the supplied source folder, compare the full method, and compare
  every companion file's text or hash, not only `SKILL.md`.
- Check relative links before reviewing any integration changes.
- Record the comparison command and the reference hashes in the work record for the restoration.
- Prevention: partly automated. The source is not committed as a second copy solely for equality
  tests, so the manual comparison must be repeated whenever a new source is supplied. A passing
  `npm run check` does not establish source fidelity or model behavior.
