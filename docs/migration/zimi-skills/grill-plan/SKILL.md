---
name: grill-plan
description: "Stress-test plans or decisions: one owner question per turn, with recommendation and evidence."
---

One question per turn. Each question carries a recommended answer and the evidence for it, so the
owner is choosing rather than composing. Facts about repository state come from files, checks, and records. The owner's stated
intent and approvals remain valid evidence of decisions.

## The loop

1. **Read first.** The plan, the map, the code it touches, the checks that would enforce it. A question you could have answered by reading wastes the owner's turn.
2. **Ask the question that most changes what gets built.** Not the easiest, not the first that occurs to you: the one whose answer reshapes the rest.
3. **Offer a recommendation with its reason**, plus the realistic alternatives and what each costs. "Which do you prefer?" with no recommendation hands the work back.
4. **Record the answer** where it belongs — a line in the map or plan, or the current task — before asking the next one.
5. **Stop when the remaining questions do not change the build.** More interview past that point is theatre.

## What makes a question worth asking

- Its answers lead to **different work**, not different words.
- It cannot be settled by a command. If it can, run the command instead.
- It is about **this** repository: its constraints, its budget, its seat, its rules — not about software in general.

## On a decision

A decision is resolved only by the owner's actual answer or the evidence that settles it.
Mark it as awaiting input in the map while it waits. Record the answer when it arrives.
Never resolve one by inferring what the owner would say. Reuse an answer already given.

## Plain language

The owner may not know the slice names, the ADR numbers or the internal vocabulary. Explain what
the decision changes in terms of what will happen, then ask. A question the owner has to decode is
a question you asked badly.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
