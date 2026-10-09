---
type: decision
title: ADR-0024 Claude Code is the only harness
summary: Zeemrepo targets Claude Code alone, with the pinned ECC plugin, rules in CLAUDE.md and .claude/rules/, and native user-only skills.
tags: [area/agents, tool/claude-code, tool/ecc, kind/architecture]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0008 Owner merges pull requests on GitHub]]", "[[Skill standards]]"]
---

## Context

Zimi supported three agent harnesses: Claude Code, OpenCode and Codex. Supporting all three
coupled the skill and branch rules to each of them:

- a single shared instruction file that every harness read, grown to 32 KB;
- an OpenCode JSON config, and an `openai.yaml` twin for each skill that had to agree with it;
- a Codex-specific branch prefix;
- a user-only skill confirmed in three places (skill frontmatter, the `openai.yaml` twin and the
  OpenCode config), with a check that the three agreed.

Only Claude Code ever had a launch adapter, so the other two harnesses cost configuration and
checks without being exercised the same way.

## Decision

Zeemrepo targets Claude Code only.

- The official ECC plugin (`ecc@ecc`) is enabled in `.claude/settings.json`, with its
  marketplace pinned to tag `v2.2.3`. ECC's rules are vendored under `.claude/rules/ecc/`.
- Repository rules live in `CLAUDE.md` and `.claude/rules/zeem/`. Skills live in
  `.claude/skills/`.
- A user-only skill sets Claude Code's native `disable-model-invocation: true` in its
  frontmatter. `config/skill-standards.json` `userOnly` is the single list of such skills, and
  `npm run skills:lint` refuses a skill whose frontmatter disagrees with it.

This replaces Zimi ADR-0002 (one shared instruction file for all agents) and Zimi ADR-0004
(shared native skill discovery across harnesses). Neither was migrated.

## Consequences

- Less configuration: one instruction surface, one skill location, one user-only list.
- Native Claude Code features become available to the workflow: hooks (for example the
  PreToolUse hook that blocks agent merges), permission deny rules, and subagents for review.
- Supporting another harness would need a new ADR, not a config file.
- ECC updates arrive by changing the pinned ref in a reviewed pull request. The pin is a tag, which
  upstream could move, so an update also checks which commit the tag names (Claude Code cannot pin
  a marketplace to a commit).

Numbering: Zimi had an unrelated ADR-0024 ("Verify checkout form before loading
instructions"). It was not migrated (its enduring rule is in
[[ADR-0021 Authority comes from an identified checkout]]), so the number is reused here
deliberately.
