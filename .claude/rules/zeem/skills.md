# Skills

Repository skills live in `.claude/skills/`, next to the ECC plugin's skills. The structural rules
(`config/skill-standards.json`, provenance hashes) are listed once in `wiki/reference/Skill standards.md` and
enforced by `npm run skills:lint`.

- There is one skill library: `.claude/skills/`. No copies, projections or per-harness twins
  (`wiki/decisions/ADR-0024 Claude Code is the only harness.md`).
- A skill only the user may start sets `disable-model-invocation: true` and is listed in `userOnly`; the two
  must agree. Do not invoke a user-only skill on your own initiative.
- If a skill is denied or unavailable, stop that line of work and say so. Reading the skill's file to follow
  it anyway does not get around a denial.
- Third-party skills are byte-preserved and hashed in `.claude/skills/import-baseline.json`. Change one only
  with an owner approval quoted in the revision record; never rewrite a landed entry.
- Adapting an imported skill keeps its method. Review interface substitutions (paths, commands, tool names)
  separately from changes to the method, and compare against the full source before accepting a restoration.
- A skill cites only paths that exist and checks that something runs. A step that names a check nothing runs
  reports false green.
- When a repository skill and an ECC skill overlap, the repository skill wins for this repository's
  workflow (wiki, branches, change records); ECC wins for general engineering practice.
- Agents may draft or revise skills; the owner approves by merging the PR.
