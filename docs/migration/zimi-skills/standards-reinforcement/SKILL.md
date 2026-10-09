---
name: standards-reinforcement
description: "Day Work: improve existing code against current standards without adding features. Use when no new behavior is wanted; not for feature work."
---

Day Work reinforces the standards the repository already holds. Its single constraint is
scope: enhance the existing codebase, do not expand it. Everything else routes to skills that
already own their subject, listed in the [skill matrix](../../../wiki/reference/Skill%20flow%20matrix.md).

The failure this prevents is drift dressed as improvement — a cleanup PR that quietly ships a
feature, so the review has no spec to judge it against and the work record describes something
that did not happen.

## The scope test

Before each change, name which side it falls on. A change that needs an argument is out.

| In scope | Out of scope |
|---|---|
| Refactor for clarity and consistency | New product feature or user-facing behavior |
| Strengthen an existing test | A new architectural pattern no standard requires |
| Add a missing test for existing behavior | Rewriting a large area because it could be nicer |
| Narrow a type, delete dead code | Changing business logic not covered by a standard or a test |
| Align code with a documented standard | Anything whose justification is "while I was here" |
| Update docs describing existing behavior | Approving, merging, or deploying the result |

A standards violation that is also a behavior bug stays in scope: fix the violation, keep the
behavior. When a change would alter behavior, stop and raise it as separate work.

## Method

Follow the general coding method under `fullstack-engineer` and the TypeScript bindings in
[AGENTS.md](../../../AGENTS.md). Read the code and the standard before editing; a rule you have
not read is a rule you are about to invent.

Take the smallest coherent slice. Where behavior is involved, `tdd` governs: write or update
the test first, confirm it fails for the intended reason, make the smallest change, confirm it
passes. When a failing test is impractical, say so and name the check used instead — never skip
the step silently.

Prove the gap before closing it. A rule that looks unenforced may simply be enforced elsewhere;
plant the offending value, run the check, and confirm it passes before you change anything.

Then run `npm run check`, update the documentation the change affects, and record what changed
and why in the owning work record.

## Definition of done

Every line, or the task is not done:

- The change stayed inside the scope test above.
- Tests were added or updated for the behavior touched.
- `npm run check` passes: lint, typecheck, tests, and the vault linter.
- Documentation describing the changed behavior is current.
- The owning work record names what changed and why.
- A branch review ran and its findings are recorded.

## Review and handover

Review is a separate phase with separate eyes: `branch-review` pins the base and head SHAs and
runs the standards and spec axes apart, so a pass on one cannot mask a failure on the other.
The spec axis matters most here, because its question is the one Day Work can fail silently —
did anything new arrive that nobody asked for.

Reviewers report findings with a severity and nothing else. They do not edit, approve, or
merge. `verify-work` turns findings into a verdict. Landing goes through `npm run gate`, which refuses
a Blocker and records evidence for the tree it verified, per
[ADR-0008](../../../wiki/decisions/ADR-0008%20Agents%20merge%20through%20an%20audited%20gate.md).

State plainly that the branch appears ready for human review. Never state that it is approved.
