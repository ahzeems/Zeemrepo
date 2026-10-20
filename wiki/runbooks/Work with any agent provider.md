---
type: runbook
title: Work with any agent provider
summary: Load the shared rules and skills, attribute notes to the actual agent, and use independent reviewers with the capabilities available in the current harness.
tags: [area/agents, area/planning, kind/convention]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: active
related: ["[[ADR-0026 Any provider may work under shared rules]]", "[[Idea to execution]]", "[[Verify a repository change]]"]
---

## When to use

Start here when planning, implementing or reviewing work through a different agent harness or
model provider. The authoring policy was adopted on 2026-10-16; inspect the current rule files
and each tool's installed capabilities before relying on its native discovery or permissions.

## Prerequisites

- A checkout identified by path, branch, HEAD and working-tree state.
- Node from `.nvmrc` and dependencies installed with `npm ci` for repository checks.
- Access to `CLAUDE.md`, `.claude/rules/zeem/` and the relevant canonical skills.
- The chosen provider's own authentication when its model needs it. General repository work
  does not require Claude authentication or the ECC plugin.

## Steps

1. Read `AGENTS.md`, then `CLAUDE.md` and the area rules it names. Point a harness that does
   not discover these files at the same sources explicitly.
2. Load the relevant `.claude/skills/<name>/SKILL.md` through native discovery or a direct read.
   Observe user-only skill flags and explicit permission denials. Adapter files reference the
   canonical method rather than copying it into a second library.
3. Use tools available in the current harness. For a named ECC capability, apply an equivalent
   method when available and identify the substitution. If the required capability is absent,
   report that operation as blocked instead of pretending it ran.
4. For planning, follow [[Idea to execution]]: clarify with `wayfinder` and `grill-plan`, record
   settled decisions with `write-plan`, then use `plan-tickets` after the owner approves the
   plan through its merged pull request. ECC's planner or architect can assist when available.
5. Write new notes with the actual authoring harness or agent, for example `agent: opencode`.
   Any nonempty kebab-case identifier is accepted without registration. Keep existing notes'
   original authors; identify the actual model and provider in review evidence.
6. Build test-first and run the repository checks. Use separate reviewer contexts with the
   finder and verifier briefs in `.claude/agents/`, or available ECC reviewers. A builder cannot
   supply its own independent verdict; name blocked review capabilities when necessary.
7. Follow [[Land a change]] for commits and publication. GitHub authentication is separate from
   model authentication. Agents publish through the machine account; the owner approves and merges.

## Verify

- `npm run wiki:lint` accepts truthful author attribution and validates the rest of the note.
- `npm run skills:lint` checks the canonical library and its provenance; adapter filenames do
  not constitute a failure. Adapter runtime semantics require their own observed checks.
- `npm run check` runs the shared controls. Instruction and adapter changes also need the
  operating documentation required by [[Change records]].
- Evidence names the actual tools, model, commands and results. Repository checks do not prove
  another provider's authentication, native discovery or model behavior.
- Claude-specific PreToolUse hooks belong to the Claude Code integration. Git hooks apply when
  installed, and the required GitHub checks and owner-review rules apply to all providers.
