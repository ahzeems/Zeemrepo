---
name: architecture-principles
description: "Repository architecture: package boundaries, composition, abstractions, and decisions. For new packages or structural review."
---

## Package boundaries

- One package = one coherent concern (see `INTENT.md`). If a package needs
  "and" to describe its purpose, it's probably two packages.
- Shared tooling (skills under `.agents/skills/`, cross-cutting docs) lives at the repository
  root, never duplicated per-package.
- "Package boundary" is this repo's governance term and stays. For design *inside* a package
  (how deep a module is, where its seam goes, whether an adapter is real, the deletion test),
  name the interface, the complexity it hides, and the behavior tested through it.

## Composition over inheritance

- Prefer composing small, focused pieces over deep inheritance/plugin hierarchies — easier to
  reason about and test in isolation.

## When to abstract

- Don't design for hypothetical future requirements. Build for the concern in front of you.
- **Add an abstraction or interface only after two real consumers need it.** One consumer is a
  guess about the second. This applies the principle in `INTENT.md`.
- No feature flags or backwards-compat shims for code that can simply be changed. Inspect
  actual consumers before deciding that compatibility is unnecessary.

## Every change is a four-part workstream

**Nothing is "done" until all four parts land, in the same PR.** This is the repo's definition of
done. The most common way work goes wrong is finishing one part and calling it complete.

| Part | What it means | Where it lands |
|---|---|---|
| **Code** | The thing itself — a skill, script, module, config | The owning module or `.agents/skills/` for shared methods |
| **Dependencies** | Anything new it relies on: a binary, package, service, account, MCP connector | The package manifest and lockfile when code exists, in the **same commit** |
| **Documentation** | What it does, how to run it, what it costs, how to verify it | The README or documentation beside the changed behavior |
| **Work record** | The plan or task the work belongs to says what changed: created, updated, split, or closed | The owning plan, or the current task for a small change |

A change adding a tool without declaring its dependency, or leaving the work record stale,
is **incomplete** — not "to be tidied later".

**Corollary:** if a piece of work cannot carry all four parts, it is too big — split it into items
that can.

## Work is tracked before it is built

The owning plan records what is open, why, and what it is blocked on. It exists because the
failure mode in a repo like this is **scattered work** — a fix here, a feature there, each
individually reasonable, with no view of the whole and no way to tell what is finished.
A plan is created later when substantial work needs one; small work uses the current task.

Rules that make it useful rather than decorative:

- **Discovered work gets an entry, not an immediate fix.** Finding a defect while doing something
  else is normal and good. Fixing it inline mixes concerns and produces an unreviewable PR. Log it
  and carry on — *unless it blocks the current task*, in which case fix it and say so in the commit.
- **Every item names its blocker.** A blocker is something concrete: a missing
  credential, a dropped connector, an undecided question. An item that does not say what it is
  waiting on gets picked up and abandoned repeatedly.
- **A decision is an item.** "OpenTofu or Terraform?" is work, and it blocks other work.
- **A completed item cites the PR or merge commit that completed it.** Do not mark it
  complete from an implementer's summary alone.
- **Keep open work scannable.** Git history preserves accepted changes; avoid a second archive.

## Decision records

- Architectural decisions that aren't obvious from reading the code (why a package is split
  this way, why a dependency was chosen) get one paragraph in that package's `docs/`, not
  scattered as comments through the code.
- Repo-specific engineering constraints live with the behavior they constrain, not scattered
  as ad hoc rules. Inspect the current environment before recording a machine limitation.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
