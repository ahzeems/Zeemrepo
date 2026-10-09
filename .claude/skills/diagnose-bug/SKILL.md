---
name: diagnose-bug
description: "Diagnose defects before fixing: reproduce, minimize, test hypotheses, fix cause, and prevent recurrence."
---

A fix applied to a symptom you have not reproduced is a guess with a commit message. The order
below is the skill; skipping a step is what produces the fix that has to be made twice.

## 1. Reproduce it

One command that fails, every time, in this checkout. Write it down exactly. If it only fails
sometimes, say how often and under what conditions: an intermittent fault reproduced once is a
coincidence.

Where there is no command yet, build the smallest one that shows the fault, and keep it: it
becomes the failing regression test.

## 2. Minimise it

Cut inputs, config and code paths until removing anything more makes the fault disappear. What is
left is the fault's actual surface, which is usually much smaller than the bug report.

## 3. Rank the hypotheses, then test the cheapest discriminating one

Write down what could produce this symptom, ordered by likelihood times cost to check. Then pick
the check that eliminates the most possibilities, not the one that confirms your favourite. Each
check names what it would show if true and what if false, before you run it.

A hypothesis you cannot design a check for is a belief. Say so and move to one you can.

## 4. Locate the cause

The proximate error is rarely the root cause: a `KeyError` is a symptom, a contract that never
said which keys are required is a cause. Ask what let the wrong value survive to that point (the
missing check, the unstated assumption, the two sources of truth), and stop when the next "why"
leaves the repository. Decide which repair prevents the class; do not apply it yet.

## 5. Write the failing test, then fix

Hand off to `/ecc:orch-fix-defect` (or `ecc:tdd-workflow`) and turn the repro into a regression
test. Run it and confirm it fails for the right reason: the defect, not a typo or a missing
fixture. Only then apply the repair from step 4 and confirm the test passes. Run the same repro against the original defect
and the corrected behavior in a safe fixture or isolated checkout. Red before, green after, both
logs kept. If there is no base commit, record the original failing input and outcome rather than
inventing a revision.

## 6. Triage what else you found

Every finding from the defect and its fix takes exactly one lane. Not on a clean run: silence is
a valid outcome, and `No observations.` is a complete answer.

- **Fix:** mechanical, low-risk, inside the work in hand (code this change added with no caller,
  whitespace on a line it touched). Apply it, re-run the same verification, list it in the PR body.
  Files this change did not touch, public interfaces, renames and reformatting are observations.
- **Observation:** needs judgement or crosses files. Report, do not fix. At most three per pass,
  each with `file:line`, one line on what is wrong, one on the proposed fix. If a check already
  catches the pattern, the finding is that check firing: say so and stop.
- **Prevention:** the same class has appeared before, closing it needs capability the repository
  lacks, or a mechanical check could catch it and none does. Write it up as in step 7.

## 7. Record what stops it recurring

**A prevention names a check that exists and fails on the original defect.** Write the check,
prove it red against the failure, then green with the fix, and retain both results. It must run
through an existing test or check command (`npm test` / `npm run check`); a check with no runner
prevents nothing, and one that never executes is worse than an acknowledged gap because it
reports green. When no check can catch it, write `none: <reason>` and the manual control instead.
Never repoint a prevention at a nearby file to make the record look complete. "Be more careful"
is not prevention.

Use [wiki-memory](../wiki-memory/SKILL.md) to record a wiki issue under wiki/work/issues/: its
Root cause and Prevention sections, and before it closes the `root_cause`, `fix_ref`,
`regression_evidence` and `prevention` fields with evidence labelled `VERIFIED:`, `INFERRED:`,
`UNKNOWN:` or `OWNER DECISION:`. Add or update a lesson (What happened / Fix / How to apply) only
if the trap generalises beyond this defect; lessons are updated in place, not appended.

Where the cause could recur after a tool, model, or skill change, keep the regression test with
the behavior's tests so the same failure can be detected again.

A finding that needs building becomes a wiki work record with acceptance a command can settle;
link to an open record that already covers the class instead of opening another.

## What this skill never does

It does not close its own work item or record a verdict on work it did. Judgement and repair stay
in separate phases; independent verification is [verify-work](../verify-work/SKILL.md).

Repository integration: the repository rules in .claude/rules/.
