---
name: wayfinder
description: "Chart work too big or too unclear for one session as a map of decision tickets, then resolve them one at a time."
---

Adapted 2026-09-18 from mattpocock/skills@3cca18b `skills/engineering/wayfinder` (MIT, Copyright
(c) 2026 Matt Pocock).

When the way from here to the **destination** is not visible, planning produces fiction. Find
the way first: one map, and decision tickets that each state a **question**.

## Plan, do not do

Each ticket resolves a decision. The map is done when nothing is left to decide before someone
builds. The pull to start building is the signal that you reached the edge of the map: hand off.
If you can write acceptance criteria for a ticket, it is a build ticket and belongs in a plan
([plan-tickets](../plan-tickets/SKILL.md)), not on the map.

Refer to every map and ticket by its **title**, never by a bare id. The id rides inside the name.

## The map

A decision lives in exactly one place, its ticket note; the map's Open decisions links the
ticket, and Decisions so far gists it in one line and links it. The map body has six sections:
Destination, Notes, Open decisions, Decisions so far, Not yet specified, Out of scope.
Use [references/map-template.md](references/map-template.md).

Save the map through [wiki-memory](../wiki-memory/SKILL.md) as `wiki/work/maps/<Map title>.md`,
from [the map template](../../../wiki/templates/map.md), with `status: clarifying`. Commit wiki
files alone with a `docs(wiki): ` subject. The map and every ticket, like any non-idea work note, need the `idea`
link the [note schema](../wiki-memory/references/note-schema.md) requires.

## Tickets

One question each, sized to one session. Each ticket is its own note in `wiki/work/tickets/`,
from [the decision ticket template](../../../wiki/templates/decision-ticket.md), with its
`ticket_kind` and a `map` link. The body holds: the question in one sentence; the evidence, and
why it is open (what breaks if it goes either way); the options with their consequences; a
recommended answer with its reason; and the resolution, with where the answer will be recorded.
Where one answer changes what another question means, list the first in the second's
`depends_on`. The **frontier** is the open tickets that nothing blocks.

| Kind | Worked | Use when |
|---|---|---|
| Decision | with the owner | The default. A conversation decides it ([grill-plan](../grill-plan/SKILL.md), [domain-modeling](../domain-modeling/SKILL.md)). |
| Research | agent alone | A fact outside this repository decides it. |
| Prototype | with the owner | "How should it look or behave" decides it. |
| Prerequisite | either | Manual work blocks a decision: access, a sign-up, moved data. It does, not decides, and the answer records what was done. |

On a ticket worked with the owner, the agent never supplies the owner's side of the exchange.

## Fog, and out of scope

Do not chart what you cannot see yet. **Ticket** a question when you can state it precisely,
even if it is blocked. When you cannot phrase it that sharply, write it loosely under **Not yet
specified** and do not pre-slice it: one patch of fog may become several tickets, or none.

The destination fixes the scope. Work beyond it is not fog: close the ticket if one exists, and
leave one line under **Out of scope** with the reason. It never graduates. It returns only as a
new effort, if the destination is redrawn. It stays out of Decisions so far.

## Two ways to run it

Resolve at most **one ticket per session**; research tickets are the exception.

**Chart** (the owner brings a loose idea):

1. Name the destination with the owner: a plan to write, a decision to lock, or a change to
   make. It fixes the scope, so it comes first.
2. Grill breadth-first across the whole space, not deep on one thread. If no fog appears and
   the work fits one session, stop: no map is needed. Ask the owner how to proceed.
3. Create the map: Destination and Notes filled in, fog under Not yet specified.
4. Create the tickets you can state now, then link them in a second pass.
5. Stop. Charting resolves nothing.

**Work through** (the owner brings a map, and optionally a ticket):

1. Load the map, not every ticket body.
2. Take the named ticket, or the first frontier ticket.
3. Resolve it with the owner, opening related tickets only as needed.
4. Record the answer in the ticket's Resolution, mark it done with labelled evidence
   (`OWNER DECISION:` for the owner's words), and add its one-line gist to Decisions so far.
5. Create the tickets the answer made statable and clear them from Not yet specified. Rule out
   of scope whatever the answer put past the destination. Update tickets it invalidated.

## What this skill never does

It never answers its own decisions, never turns an open question into an assumption, and never
starts building from a map that is still open.
