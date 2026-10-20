---
type: decision
title: ADR-0026 Any provider may work under shared rules
summary: Any agent harness or model provider may plan, author and verify work under one shared set of repository rules, with truthful attribution and capability-specific integrations.
tags: [area/agents, kind/architecture]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: active
related: ["[[Allow any agent provider to work in the repository]]"]
---

## Context

The repository's author allowlist and harness-specific guard rules prevented an OpenCode session
from recording an audit remediation map. Installing or authenticating a different harness became
a prerequisite for general planning even though the current session could read, write and check
the repository. On 2026-10-16 the owner requested provider-neutral authoring; the originating
work record contains the verbatim instruction.

## Decision

Any model provider or agent harness may plan, author and verify work under the shared repository
rules. This supersedes ADR-0024.

- `CLAUDE.md` remains the shared constitution, with `AGENTS.md` as a short entry point. The
  filename identifies an instruction entry, not a required runtime.
- `.claude/rules/zeem/` and `.claude/skills/` remain canonical. Harness adapters may refer to
  them. A missing native skill loader is handled by reading the same skill file directly.
- ECC's engineering methods apply with available equivalent tools. The ECC plugin and Claude
  authentication are prerequisites only for operations that actually invoke those integrations.
- New notes identify their actual authoring harness or agent with a nonempty kebab-case `agent`
  value. The validator accepts new identifiers without an allowlist. Existing authors remain
  attributed as written; reviews identify their actual model and provider in their evidence.
- Independent review means a separate reviewer context. Available reviewers may use the
  repository's finder and verifier briefs; substitutions and unverified capabilities are named.
- Provider choice grants no extra permissions. Test-first work, explicit user-only skill
  invocation, change records, machine-account publication and owner-only approval and merging
  apply to every agent.

## Consequences

General repository work can continue in the current harness without a provider migration.
Skill adapter files and other harness configuration names are accepted. Known instruction and
adapter paths are workflow-critical and require the usual records and operating documentation.

The tradeoff is that each harness's discovery, permissions and hooks must be described honestly.
Claude-specific hooks run only in Claude Code; git hooks, repository checks and GitHub rules are
the shared controls. Sandcastle and the live compliance runner still select their existing Claude
runtime. This decision permits authoring with other providers; it does not establish runtime
interoperability or claim live tests of every provider.
