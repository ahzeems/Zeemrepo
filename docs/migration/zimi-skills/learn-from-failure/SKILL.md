---
name: learn-from-failure
description: "Turn failures into checks: name cause, add prevention, or record friction when no check fits."
---

A failure that produces only a fix produces nothing. The work is turning it into something that
fires next time without anyone remembering this conversation.

## When this runs

After anything went wrong and was fixed: a defect, a refused action, a gate failure, a review that
found something, a session that burned time on a wrong turn. Also when a review or audit surfaces a
finding nobody had recorded. Not on a clean run, and never to manufacture a finding â€” silence is a
valid outcome, and `No observations.` is a complete answer.

## Three lanes, and every finding takes exactly one

### Fix

Mechanical, low-risk, inside the work already in hand: something this session added that has no
caller, whitespace on a line this session touched, a missing trailing newline on a file this session
created. Apply it, re-run the same verification the primary work required, and list it in the PR
body.

Not in this lane: files this session did not touch, public interfaces, renames, reformatting, and
drive-by fixes in unrelated code. Those are observations.

### Observation

Findings that need judgement, or that cross files: report them, do not fix them. At most three per
pass, each with `file:line`, one line on what is wrong, one line on the proposed fix. If a check
already catches the pattern, the finding is that check firing â€” say so and stop.

### Prevention

The lane this skill exists for. A finding escalates when the same class has appeared before, when
closing it needs capability the repository does not have, or when a mechanical check could catch the
pattern and none does.

## Writing the prevention

The rule the record enforces: **a prevention names a check that exists, and that check fails on the
original defect.** Write the check, prove it red against the failure, then green with the fix
and retain both results. A prevention that exists as a file and executes never is worse than
an acknowledged gap, because it reports green.

When no check can catch it â€” the cause is a judgement, or the cost is out of proportion â€” say
`none: <what happened instead>` and record the friction. Do not repoint the prevention at a nearby
file to make the record look complete.

New checks must run through the actual test command for the changed behavior. Record where
and when they run; a check with no runner cannot prevent recurrence.

## Writing the entry

Use wiki-memory to write a lesson under wiki/lessons/ with its required metadata and
sections. Record date, symptom with evidence, cause, why it escaped, and prevention.
Two are usually wrong on the first attempt:

- **Cause is not the proximate error.** "The path was wrong" is a symptom. Ask what made a wrong
  path survive to that point â€” the missing check, the unstated assumption, the two sources of truth.
  Stop when the next "why" leaves the repository.
- **Prevention is a check, not an intention.** "Be careful with X" prevents nothing.

An entry describes what was true when it was written. Later work does not edit it; it appends a new
entry that supersedes it â€” except where a cited prevention has since been deleted, which is
corrected in place toward honesty and says so.

An observation in the same lesson records the class of finding, the `file:line` evidence,
and the check that would catch it if it existed, pointing at the work that would build it.

## Escalating to work

A finding that needs building becomes a work item citing an approved plan. When no
plan covers it, the plan comes first as `**Status:** proposed`, and the item follows once it is
approved. An item names its acceptance as conditions a command can settle, its next action as one
imperative sentence, and the capability it needs that does not exist yet.

Do not open an item for a class an open item already covers â€” link to it in the observation instead.

## What this skill never does

It does not close its own item, does not remove a draft marker, and does not record a verdict on
work it did. Judgement and repair stay in separate phases: report the finding, leave verification,
make authorized changes, then verify the new result. Self-review is not independent review.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
