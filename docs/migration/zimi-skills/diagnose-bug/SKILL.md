---
name: diagnose-bug
description: "Diagnose defects before fixing: reproduce, minimize, test hypotheses, fix cause, and prevent recurrence."
---

A fix applied to a symptom you have not reproduced is a guess with a commit message. The order
below is the skill; skipping a step is what produces the fix that has to be made twice.

## 1. Reproduce it

One command that fails, every time, on this seat. Write it down exactly. If it only fails
sometimes, say how often and under what conditions â€” an intermittent fault reproduced once is a
coincidence.

Where there is no command yet, build the smallest one that shows the fault, and keep it: it
becomes the failing test and, later, the replay case.

## 2. Minimise it

Cut inputs, config and code paths until removing anything more makes the fault disappear. What is
left is the fault's actual surface, which is usually much smaller than the bug report.

## 3. Rank the hypotheses, then test the cheapest discriminating one

Write down what could produce this symptom, ordered by likelihood times cost to check. Then pick
the check that eliminates the most possibilities, not the one that confirms your favourite. Each
check names what it would show if true and what if false, before you run it.

A hypothesis you cannot design a check for is a belief. Say so and move to one you can.

## 4. Fix at the cause, not at the symptom

The proximate error is rarely the root cause: a `KeyError` is a symptom, a contract that never
said which keys are required is a cause. Fix the one whose repair prevents the class.

## 5. Prove the fix

Run the same repro against the original defect and the corrected behavior in a safe fixture
or isolated checkout. Red before, green after, both logs kept. If there is no base commit,
record the original failing input and outcome rather than inventing a revision.

## 6. Record what stops it recurring

Use wiki-memory to add a lesson under wiki/lessons/: date, symptom with
evidence, root cause, why it went unnoticed (the field that generalises), and a prevention
that names a check that exists, or `none: <reason>` stating plainly why it cannot be
mechanically prevented. "Be more careful" is not prevention.

Where the cause could recur after a tool, model, or skill change, keep a replay case with
the behavior's tests so the same failure can be detected again.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
