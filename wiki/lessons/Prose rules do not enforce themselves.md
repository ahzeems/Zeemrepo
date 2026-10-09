---
type: lesson
title: Prose rules do not enforce themselves
summary: A repository rule written only in a skill was broken by the agent that had not yet loaded the skill; only a check running in the canonical path stopped it.
tags: [area/agents, area/docs, area/git, area/wiki, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0009 Workflow-critical Markdown is an interface]]", "[[A refused commit leaves its staging behind]]"]
---

## What happened

In Zimi, the wiki-memory skill and the repository instruction file both said wiki files are
committed alone, with a fixed subject prefix. Every commit of two features in a row broke that
rule: eleven wiki files sat beside fourteen code files in one commit, and three more commits
mixed the two again.

The cause was ordering. The skill that carries the rule was loaded at the end of the work, when
the notes were reviewed, instead of before the first wiki write. Nothing in the canonical check
knew the rule existed, so the full check passed, the landing passed, and the audit recorded a
landing that had broken a documented requirement.

An audit found it afterwards. That is the failure mode: the rule was correct, written down, and
in two places, and it still had no effect on what landed.

## Fix

A wiki compliance check was added that refuses a branch whose commits mix `wiki/` with anything
else, or whose wiki-only commits lack the required subject prefix. It runs inside the full
check, and therefore at pre-push, which sees the commit that pre-commit cannot. Later
pre-commit also ran it against the index, refusing a mixed staging before the commit exists;
see [[A refused commit leaves its staging behind]]. There are no exceptions: a commit that would
mix them is split, and a move across the boundary is an add in one commit and a delete in the
next.

The same session found a second instance of the pattern. The wiki linter checked that `agent`
was kebab-case but not that it was a known author, so `claude` accumulated beside
`claude-code` on nine notes. The note schema gained an allowed-agent list, read by the linter
exactly as the tag list already was.

Zeemrepo keeps both. `npm run wiki:compliance` (`scripts/wiki/wiki-compliance.ts`) refuses a
mixed commit or a wiki-only commit whose subject does not start `docs(wiki): `; it runs in
`npm run check`, so at pre-push and in CI, and with `--staged` in pre-commit. The allowed tags
and agents live between marker comments in the wiki-memory skill's `note-schema.md`, and
`npm run wiki:lint` rejects any value outside them.

## How to apply

When a rule matters enough to write down, ask what runs it. A rule that lives only in prose
depends on the reader having read it first, which is exactly what fails under time pressure or
when a skill is loaded late.

Load the skill that owns a surface before writing to that surface, not before reviewing it. And
when a check accepts a shape rather than a value (kebab-case rather than a known name), it is
enforcing spelling, not meaning. Close the set.

Ported from Zimi `wiki/lessons/Prose rules do not enforce themselves.md` at 9fb36b2.
