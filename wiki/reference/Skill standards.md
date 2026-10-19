---
type: reference
title: Skill standards
summary: What npm run skills:lint enforces on .claude/skills (limits, user-only list, provenance hashes, citations, em dashes) and what stays convention.
tags: [area/agents, tool/claude-code, kind/convention]
created: 2026-09-21
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[Skill integration must preserve the method]]", "[[Skill restoration needs source comparison]]"]
---

`npm run skills:lint` (`scripts/skills/`) checks `.claude/skills/` in `npm run check` and the
`guards` workflow. Structure only: whether a skill is selected and helps needs observed trials
(ECC `skill-comply` or an equivalent observed trial in the chosen harness).

## Enforced

| Rule | Detail |
|---|---|
| Configuration | `config/skill-standards.json` parses and has only `note`, `descriptionLimit` (160), `bodyLimit` (6000), `allowances` and `userOnly`. |
| Shape | Each folder has a `SKILL.md` with parsable frontmatter, `name` equal to the folder name, and a description. The root holds only skill folders, `import-baseline.json` and `THIRD-PARTY-NOTICES.md`. No symbolic links. Harness adapter files may accompany a skill; this check does not validate their runtime semantics. |
| Limits | Description at most 160 characters, body at most 6000, frontmatter keys only `name`, `description` and `disable-model-invocation`. Skills in the import baseline are exempt from these three. |
| Allowances | Each excuses one limit for one skill with a reason of at least 12 characters. An allowance that excuses nothing is an error. |
| User-only skills | `disable-model-invocation`, when present, is a boolean. Every skill in `userOnly` is installed and sets it to `true`, and every skill that sets it to `true` is in `userOnly`. |
| Citations | Relative links and images in a skill body resolve, and a `#heading` fragment into a Markdown file names a real heading. Code and comments are skipped; external URLs are not checked. |
| No em dashes | No line of any `.md` file under `.claude/skills/` contains U+2014. |
| Provenance | See below. |

## Import baseline

`.claude/skills/import-baseline.json` records, per imported or owner-approved skill, a `source`,
the `sourceSha256` of the original and the `installedSha256` accepted at import, hashed as UTF-8
with LF line endings and no BOM. `revisions` holds the approved `SKILL.md` changes made before
S21 and is now closed: appending one breaks the inventory chain check below and fails. Every new
change, to `SKILL.md` or a companion, is an inventory revision.

Each entry also needs an `inventory`: a list of records, each with a `basis`, a `files` map from
every path in the skill folder (relative, `/`-separated, no `.` or `..` segment) to its hash, a
`reason` and an `approval`. Every file in the folder, dot files included, must match the latest
record: an edited, added or deleted file fails, and so does a symbolic link, an unreadable file or
text that is not valid UTF-8. The first record's basis is `migration-baseline` (hashes of the files
as installed when it was taken, not verified upstream text) or `import`, and its `SKILL.md` hash
must equal the last revision (or `installedSha256`), so the inventory continues the recorded
chain. Every later record has basis `revision`. To change an imported file, append a revision
record listing the whole folder; the S21 baseline (2026-10-19) is the first record for all twelve
imported skills, and [[S21 Complete imported-skill provenance]] lists its hashes.

Each revision and inventory record needs an `approval`: a record path inside the repository and
a verbatim quote (12+ characters) that the record contains, in a record that names the skill.
Landed entries are append-only: against the merge base with main, no entry is removed and its
`source`, hashes, landed revisions and landed inventory records are unchanged. An unreadable
landed copy fails.

This proves only that the text matches a record. A branch can write its own record, so a
reviewer compares the quote with the owner's actual words.

## Convention, not checked

- Legacy revisions cite their owner approvals in `docs/migration/skill-stocktake.md` or the
  idea note that recorded them; the S21 migration-baseline inventory records cite
  [[S21 Complete imported-skill provenance]]. A later inventory revision cites the record
  holding the owner's approval for that change. The linter accepts any existing record file
  that holds the quote and names the skill, so it cannot tell a fresh approval from a reused one.
- `THIRD-PARTY-NOTICES.md` carries the licence for attributed third-party text. The linter
  only permits the file; it does not read it.
- Removing a name from `userOnly` fails `skills:lint` while the skill still sets
  `disable-model-invocation: true`. Making a skill model-invocable takes both edits, a
  `config/` change the owner reviews.
- Harnesses may discover skills natively or read their canonical files explicitly. Adapters refer
  to the same source. User-only invocation remains a rule even where a harness does not enforce
  the frontmatter flag itself. See [[Work with any agent provider]].
