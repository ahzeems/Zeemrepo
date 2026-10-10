---
type: lesson
title: Skill integration must preserve the method
summary: Adapting imported skills to local style changed their methods; keep source wording and review each interface substitution separately from the method.
tags: [area/agents, area/docs, tool/claude-code, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Skill restoration needs source comparison]]", "[[Skill standards]]"]
---

## What happened

In an earlier repository, the owner found that imported skills had lost their original wording. The `teach` skill
had replaced the supplied parallel orchestration with sequential source and rationale passes, and
another imported skill had replaced its parallel mining step the same way. Descriptions, examples
and metadata had been rewritten to fit local style and loading budgets. Review checked file paths
and skill discovery, but did not separate method changes from interface substitutions.

## Fix

The supplied files were restored as the source baseline. Method wording, including the parallel
work, was kept intact; only interfaces missing in the local harness were adapted. The owner
explicitly authorized the original prescribed parallel work.

Zeemrepo carries this forward as code. Third-party and owner-approved skill text is recorded in
`.claude/skills/import-baseline.json`: each entry names its source and holds a `sourceSha256` and
an `installedSha256`. Any later change to a `SKILL.md` must be an appended revision with its hash,
a reason, and an approval record that quotes the owner verbatim and names the skill.
`npm run skills:lint` (`scripts/skills/provenance.ts`) fails when an installed `SKILL.md` does not
match its latest recorded hash, when an approval record is missing or lacks the quote, and when a
landed entry or revision is rewritten or removed.

## How to apply

- Before accepting an import or an edit to imported text, compare it with the supplied source.
  Require a reason for every changed hunk, and keep operating steps even when the prose is long or
  awkward.
- Review interface substitutions (paths, tool names, harness features) one by one, apart from the
  method itself.
- Know what the check covers. `skills:lint` detects that text drifted from an approved hash. It
  cannot decide whether a revision preserved the method, and it hashes only `SKILL.md`, not
  companion files.
- Prevention: no automatic semantic check exists. Source comparison by a separate reviewer is the
  manual control; discovery and lint alone do not establish fidelity.
