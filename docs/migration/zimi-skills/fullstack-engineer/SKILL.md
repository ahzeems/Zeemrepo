---
name: fullstack-engineer
description: "Implement one task from scope to evidence-backed handoff: inspect, scope blast radius, and work in slices."
---

One ticket, one deliverable, one branch. The ticket's acceptance criteria are the contract; the
handoff is what proves you met them.

## Before writing code

1. **Read the nearest neighbour in full.** The package or module already doing something similar for the current behavior. Conventions live in the code as much as in the skills; match them even where you would have chosen differently.
2. **State the plan in three to six lines**: what changes, which files, what could break. Longer than that and the ticket is too big â€” say so on the ticket rather than building it anyway.
3. **Name the blast radius.** `rg` for importers before editing, not after.
4. **Say when the brief is wrong.** A request that duplicates a capability, crosses a package boundary or conflicts with `INTENT.md` gets challenged before the first edit, not after the review.

When the ticket uses the controlled admission path, do not write until the coordinator has
validated the revision-pinned canonical-wiki pointers and admitted the exact clean feature
worktree. Refusal ends the edit-capable run; it never authorizes a fallback checkout or client.

## While writing

- **A change is a workstream**: code, dependency declarations, documentation and work record in the same PR. A PR that changes behaviour and leaves the work record stale is unfinished. Same branch, but not the same commit: wiki files are committed alone with a `wiki:` subject, so plan the split before you stage. The work record is not optional paperwork — `npm run memory:guard` refuses a branch whose work record carries no verification evidence.
- **Test where it counts** (see the TypeScript standards in `AGENTS.md`): parsing, prompt construction, token counting, config resolution, branching, and anything that has broken before. Not thin wrappers or layout.
- **A defect needs a red-then-green record.** Run the repro against the original defect and the corrected behavior. Keep both results; do not discard working changes to obtain the earlier state.
- **This machine's limits are real.** Inspect the current machine and dependencies before assuming a capability or constraint.

## Before handing off

Run the checks that exist for the changed behavior: npm test, npm run typecheck, and
npm run wiki:lint for wiki changes. Keep their actual scripts in package.json.

Open the files you changed and compare them with the ticket. A passing check on the wrong change
is still the wrong change.

Then write the handoff: what changed, acceptance criteria, the evidence, and anything that
could not be checked. Make the result ready for review.

Name the boundary actually observed. Fake-launch admission controls support the verdict
**shared admission controls verified** only. They do not demonstrate real-client confinement,
cross-client recall or handoff, website freshness, or completed foundation stabilization; keep
those claims UNKNOWN until their separate trials run.

## What this skill never does

It never merges by hand, never completes its own ticket, and never writes its own verdict: the
builder does not certify the build. Landing runs through `npm run gate`, which counts Blockers
from reviewers the builder did not run.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
