---
type: decision
title: ADR-0005 Work records live in the shared vault
summary: Use linked vault records and native Bases to track idea-to-execution work alongside durable agent memory.
tags: [area/planning, area/agents, tool/obsidian, kind/architecture]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0001 Wiki is an Obsidian vault in the repository]]", "[[Idea to execution]]"]
---

## Context

The owner requested metadata-backed tracking for ideas, projects, backlogs, plans,
tickets, specs, and research, with internal links for an interactive knowledge graph.
Planning files outside `wiki/` would not belong to the existing vault. Research done in
Zimi at the time confirmed that native Obsidian Properties, Bases, and links cover this
without plugins.

## Decision

Keep canonical work artifacts under `wiki/work/` and link them to their originating idea
and project. Maps and plans keep their original skill sections; ticket bodies have their
own notes so their metadata is visible in views. The owning map or plan links to those
notes instead of copying their content. A backlog is a filtered view, not another store.

Native Bases use the same Markdown properties. Internal links join work to sessions,
lessons, decisions, and research, making the vault a shared graph for human and agent memory.
[[Idea to execution]] describes the flow from idea to delivered work.

The storage bindings are stated once, in the `wiki-memory` skill and its note schema.
Original skill bodies remain unchanged. Plan approval (the owner merging the pull request
that adds the plan), read-only review, and preservation of historical notes still apply.

## Consequences

The owner can follow work in Obsidian while agents use the same files without the app.
Properties accept native YAML list forms. The validator checks typed relationships and
common invalid states; evidence fields never manufacture authorization. Current guidance
and templates use this binding. Historical sessions and decisions remain records of
what was true then.

Ported from Zimi `wiki/decisions/ADR-0005 Work records live in the shared vault.md` at 9fb36b2. Changed: Zimi's multi-harness skill-discovery binding and its hub and matrix notes were not migrated, so those references were replaced with the wiki-memory skill and [[Idea to execution]]; the author `codex` maps to `claude-code`.
