# Map body

The body of a map. It is the whole effort at low resolution, loaded once per session.
Open decision tickets live as titled sections here, with their question, evidence, options,
recommended answer, and dependencies.

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

<One titled ticket per question: question, evidence, options, recommended answer, consequences,
dependencies, and who can settle it. Keep the actual answer with its ticket when resolved.>

## Decisions so far

<One line per resolved ticket: its title, then the gist of the answer. Link to its detail below.>

- <resolved ticket title>: <one-line gist of the answer and link to its section>

## Not yet specified

<In-scope questions you can tell are coming but cannot state precisely yet. Write as loosely as
the view allows. Remove a patch when it becomes a ticket.>

## Out of scope

<Work ruled beyond the destination: one line each, with the reason and the closed ticket if one
existed. It never becomes a ticket under this map.>
```
