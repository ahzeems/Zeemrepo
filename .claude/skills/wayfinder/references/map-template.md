# Map body

The body of a map note in `wiki/work/maps/`. It is the whole effort at low resolution, loaded
once per session. Each decision ticket is its own note in `wiki/work/tickets/`, holding its
question, evidence, options, recommended answer, and resolution; the map links to it.

Adapted from mattpocock/skills@3cca18b `skills/engineering/wayfinder` (MIT, Copyright (c) 2026
Matt Pocock).

```markdown
## Destination

<What reaching the end of this map looks like: the plan, decision or change this effort is
finding its way to. One or two lines. Every session reads it before choosing a ticket.>

## Notes

<The domain. Skills every session should load. Standing preferences for this effort. State here
that this map records decisions and never authorizes implementation.>

## Open decisions

<One line per open ticket: a link to its note by title, and who can settle it. Do not copy the
ticket body here; dependencies live in each ticket's depends_on.>

## Decisions so far

<One line per resolved ticket: its title, then the gist of the answer. Link to its note.>

- <resolved ticket title>: <one-line gist of the answer and link to its note>

## Not yet specified

<In-scope questions you can tell are coming but cannot state precisely yet. Write as loosely as
the view allows. Remove a patch when it becomes a ticket.>

## Out of scope

<Work ruled beyond the destination: one line each, with the reason and the closed ticket if one
existed. It never becomes a ticket under this map.>
```
