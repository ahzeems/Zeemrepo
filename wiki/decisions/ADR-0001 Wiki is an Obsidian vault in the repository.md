---
type: decision
title: ADR-0001 Wiki is an Obsidian vault in the repository
summary: Project memory is an Obsidian vault in wiki/ inside the repo, as plain Markdown with typed folders, YAML frontmatter and an enforced tag list.
tags: [area/docs, area/agents, tool/obsidian, kind/architecture]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0011 The vault is the interface, Obsidian is optional]]"]
---

## Context

The repository needs memory that outlives any one agent session, and that agent sessions and one human can all read and write. Options considered:

- A hosted web page. Good to read, but agents in a terminal cannot read or update it, and it is not versioned with the code.
- The whole repository as the vault. Obsidian would index `node_modules` and build output, and need ignore rules.
- A separate vault repository shared across projects. Useful later, but a second repository to keep in sync from day one.
- Flat notes with tags only, or a daily log. Natural in Obsidian, but gives agents little structure to retrieve by.

## Decision

Memory is an Obsidian vault in `wiki/` inside this repository. Notes are plain Markdown in five typed memory folders: sessions, runbooks, lessons, decisions and reference. Work records live beside them under `wiki/work/` (see [[ADR-0005 Work records live in the shared vault]]). Every note carries YAML frontmatter with type, summary, namespaced tags, dates, author agent and status. The schema and the allowed tag list live in the `wiki-memory` skill (`.claude/skills/wiki-memory/references/note-schema.md`) and are enforced by `npm run wiki:lint`.

The note types follow Diataxis. Decisions follow the ADR format. No Obsidian plugins are required, and the repository ships no `.obsidian/` settings.

## Consequences

- Notes are versioned, reviewed and published with the code. Anyone who clones the repo gets the memory.
- Agents need no Obsidian software. They use file reads and grep over frontmatter.
- The human gets graph view, backlinks, properties and templates for free.
- Because the repo is public, every note is public. This forces a strict redaction rule, and the linter scans every tracked file for secrets and personal identifiers.
- The tag list must be maintained by hand. That friction is deliberate, since it keeps tags consistent enough for retrieval.
- Cross-project memory is not solved. A shared vault can be added later, and would supersede this decision.

Ported from Zimi `wiki/decisions/ADR-0001 Wiki is an Obsidian vault in the repository.md` at 9fb36b2. Changed: the work folder and the schema's Zeemrepo location are named; links to unmigrated notes were removed.
