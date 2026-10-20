# Skills

Repository skills live in `.claude/skills/` for every harness. The structural rules
(`config/skill-standards.json`, provenance hashes) are listed once in `wiki/reference/Skill standards.md` and
enforced by `npm run skills:lint`.

- There is one canonical skill library: `.claude/skills/`. Harness-specific entry points and adapter
  files may refer to it; keep the method in one place (`wiki/decisions/ADR-0026 Any provider may work under shared rules.md`).
- A skill only the user may start sets `disable-model-invocation: true` and is listed in `userOnly`; the two
  must agree. Do not invoke a user-only skill on your own initiative.
- If native discovery is unavailable, read the canonical skill file directly. An explicit permission
  denial still stops that line of work; reading a file does not override it. If a named tool or agent,
  including an ECC tool or harness built-in, is unavailable, use an available equivalent that preserves
  the method, separate contexts and tool limits, and report the substitution. Report the capability
  as blocked when there is no equivalent.
- Third-party skills are byte-preserved and hashed in `.claude/skills/import-baseline.json`. Change one only
  with an owner approval quoted in the revision record; never rewrite a landed entry.
- Adapting an imported skill keeps its method. Review interface substitutions (paths, commands, tool names)
  separately from changes to the method, and compare against the full source before accepting a restoration.
- A skill cites only paths that exist and checks that something runs. A step that names a check nothing runs
  reports false green.
- Agents may draft or revise skills; the owner approves by merging the PR.
- Adapter and instruction files are workflow-critical. Register a newly introduced loader path in
  `scripts/lib/change-policy.ts` when its existing patterns do not cover it.

## ECC

- **Overlapping skills.** When a repository skill and an ECC skill cover the same ground, the ECC skill
  wins (`CLAUDE.md`); fix the repository skill or retire it.
