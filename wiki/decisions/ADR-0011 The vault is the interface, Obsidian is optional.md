---
type: decision
title: ADR-0011 The vault is the interface, Obsidian is optional
summary: The repository wiki is the source of truth for documentation and memory; no editor is part of the architecture, and the Windows UNC route failed validation.
tags: [area/docs, area/agents, tool/obsidian, kind/architecture]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0001 Wiki is an Obsidian vault in the repository]]", "[[ADR-0021 Authority comes from an identified checkout]]"]
---

## Context

In Zimi, an earlier decision (ADR-0010, not migrated) named one vault and said Windows would
open it over `\\wsl.localhost`. It was adopted with that premise recorded as unverified,
because the route had already been seen failing with `EISDIR` and no way existed to test it from
the repository: Windows interop was disabled in that WSL instance.

The owner validated it manually. It still failed.

That settled the narrower question and exposed a wider one. ADR-0010 reasoned about where the
vault lives as though the answer depended on what a particular desktop application could open.
It does not. The wiki's job is to be the repository's documentation, decision, runbook and
work-record interface for agents and humans. An editor is how a person looks at it, and a web
frontend over the same files would serve the same job.

Choosing the location of the memory by the capabilities of one viewer is the error. The vault
sits in the repository because that is where the guards, the required checks and the audit can
reach it.

## Decision

The canonical source of truth is `wiki/` in this repository, read from an identified checkout
([[ADR-0021 Authority comes from an identified checkout]]). Agents update it, `npm run check`
verifies it, the required pull request checks refuse a branch that does not record itself in
it, and `npm run audit` reports anything that reached `main` without a merged pull request.

No editor is part of the architecture. Obsidian is one optional viewer. Opening the vault from
Windows Obsidian over `\\wsl.localhost` failed validation, is not required, and is not to be
presented to a reader as the intended or proven route. A later web frontend over the same files
is a viewer too, and needs no change here.

A separate copy, such as a Windows checkout kept for local Obsidian access, may exist as a
manually synced convenience. It is not the source of truth and it is not the active checkout.
In Zimi such a copy drifted twice, and the repository wiki is authoritative over it in every case.

## Consequences

The architecture no longer depends on a capability nobody controls. The guards, the checks and
the audit are unchanged, because they were never about the viewer.

The cost falls on the person: reading the vault on Windows means either a manually synced
convenience copy, which drifts unless kept current, or reading the files another way. That is a
real cost and it is not solved here, deliberately: a synchronisation tool was rejected in Zimi
and the reasoning has not changed.

The general point: a path that resolves says the filesystem can reach it, not that a program can
open it as a vault. Two Zimi decisions were made on that assumption before validation caught it.

Ported from Zimi `wiki/decisions/ADR-0011 The vault is the interface, Obsidian is optional.md` at 9fb36b2. Changed: the Zimi home-directory path became `wiki/` at an identified checkout; the merge gate became the pull request checks; links to unmigrated notes became plain history.
