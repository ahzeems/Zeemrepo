---
name: find-deepenings
description: "Find architecture improvements: rank candidate deepenings, let the owner pick one, then grill it into a plan."
disable-model-invocation: true
---

Adapted 2026-09-18 from mattpocock/skills@3cca18b
`skills/engineering/improve-codebase-architecture` (MIT, Copyright (c) 2026 Matt Pocock).

This can open a broad change surface, so the owner starts it and chooses what it touches.

## 1. Scope

Ask the owner for an area, or find the hot spots: files that change most often are where friction
costs most.

```bash
git log --since="3 months ago" --name-only --format= | sort | uniq -c | sort -rn | head -30
```

## 2. Explore

Inspect the scope read-only. For ownership and abstraction rules, use the repository rules in
`.claude/rules/` (start with [coding-style](../../rules/ecc/common/coding-style.md)) and, for a
second view, the `ecc:architect` agent. Look for friction, not style:

- **Shallow modules:** an interface nearly as large as what it hides.
- **Leaky seams:** callers that know a module's internals, or one concept spread over several
  modules that must change together.
- **Untestable interfaces:** behaviour reachable only through a lower seam than it should need.
- **The deletion test:** if the module were deleted, would its complexity vanish, or reappear in
  every caller? If it would vanish, the module is not earning its place.

## 3. Present candidates

A numbered list, strongest first. For each:

- **Name** and the modules involved.
- **Friction:** what is hard today, with `file:line` evidence.
- **Deepening:** the smaller interface or the merged module, in two or three lines.
- **Strength:** strong, moderate or speculative, and why.
- **Blast radius:** modules and tests it touches.
- **Decision check:** any accepted decision in `wiki/decisions/` the change would contradict. A
  candidate that needs a decision reversed says so; it is not dropped silently, and it is not
  proposed as if the decision were absent.

Then stop. The owner picks **one**. Do not start on several.

## 4. Grill the chosen one

Load [grill-plan](../grill-plan/SKILL.md). Settle the new interface, what moves, what is deleted
and how it is tested. Where a term is unclear, resolve it with
[domain-modeling](../domain-modeling/SKILL.md). For a contested interface, design it twice and
compare before choosing.

## 5. Hand off

Write the result with [write-plan](../write-plan/SKILL.md). Sequence a wide change by the expand,
migrate, contract rule in [plan-tickets](../plan-tickets/SKILL.md#slicing).

## What this skill never does

It never edits code, never pursues more than one candidate at a time, and never treats a
recorded decision as an oversight.
