---
type: decision
title: ADR-0021 Authority comes from an identified checkout
summary: Instructions, skills and the vault come from a checkout the agent has identified (path, worktree, branch, HEAD, clean state); parallel sessions use separate worktrees.
tags: [area/git, area/agents, area/docs, kind/architecture]
created: 2026-10-06
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[ADR-0011 The vault is the interface, Obsidian is optional]]", "[[Bare worktree records are not checkouts]]", "[[Land a change]]"]
---

## Context

A client reads whatever is on disk where it starts. Claude Code loads `CLAUDE.md` from its
launch directory and the directories above it, plus that checkout's `.claude/` rules and skills.
Correct files on `main` do not help a session that never reads them.

In Zimi on 2026-10-06, the files at the repository root were out of date: the root instruction
file differed from main, four skill files differed, and the root `wiki/` differed from main in
nine places. A session launched there loaded the stale instructions. Every one of those files
was recoverable from Git; none held unique content.

At that time Zimi's root was bare repository storage (`core.bare=true`) with stale loose files
left in it, so a session launched there loaded files no checkout owned. At a bare root,
`git rev-parse --show-toplevel` fails with `fatal: this operation must be run in a work tree`,
which is the quickest way to tell. Zimi's ADR-0021 then made the bare layout a permanent rule and
told sessions to stop there. By 2026-10-08 the root had become an ordinary work tree again, so
that rule was false (Zimi ADR-0024, "Verify checkout form before loading instructions"). Two
failures, then: acting on a checkout nobody had identified, and writing a layout assumption into
a rule as if it could not change.

## Decision

Authority comes from an explicitly identified checkout. Before acting, an agent identifies it
and reports:

- path (`git rev-parse --show-toplevel`) and which worktree it is (`git worktree list`);
- branch and full `HEAD`;
- whether the tree is clean (`git status --porcelain`);
- which instruction files it loaded (`CLAUDE.md` here and in any directory above it, and
  `.claude/`). A stale `CLAUDE.md` in a parent directory is still loaded.

If an instruction source is stale or conflicts with the identified checkout, stop and report it
instead of choosing one.

Current main is read from a clean checkout whose `HEAD` matches a freshly fetched
`origin/main`. Feature work uses its own branch, whose `CLAUDE.md`, `.claude/` and `wiki/`
govern that work and may differ from main until it lands by pull request. The canonical vault is
`wiki/` at the identified revision.

Parallel sessions use separate worktrees under `.worktrees/` (gitignored). One writer per
checkout: a session never edits a checkout another session is working in. Before removing a
worktree, run `npm run worktree:guard`, which reports uncommitted or unpushed work in each one.

## Consequences

- The rule is layout-independent. Whether the root is a normal checkout (as it is in Zeemrepo)
  or something else later, the same inspection answers which files are authoritative, and no
  permanent assumption about the layout needs to be kept true.
- The rule is stated in `.claude/rules/zeem/branch-and-merge.md`. It is an instruction, so it
  reaches only a session that loaded current instructions; nothing here proves which files a
  client actually loaded.
- Worktree removal has a mechanical check against losing work; whether a session respects
  one-writer-per-checkout is not checked.

Ported from Zimi `wiki/decisions/ADR-0021 The bare root is storage, authority comes from an identified checkout.md` at 9fb36b2, rewritten with Zimi `wiki/decisions/ADR-0024 Verify checkout form before loading instructions.md` (Zimi main at f600680, after 9fb36b2): the bare layout Zimi's version made permanent had changed by 2026-10-08, so the storage clause and the stop-at-the-bare-root instruction were removed, and the enduring rule (identify the checkout; separate worktrees; one writer each) was kept with Zeemrepo's paths and commands.
