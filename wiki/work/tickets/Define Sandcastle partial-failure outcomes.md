---
type: ticket
title: Define Sandcastle partial-failure outcomes
summary: The owner approved reviewed successes proceeding, failed work staying unintegrated, incomplete runs exiting nonzero, and retries resuming missing phases without duplicate notifications.
tags: [area/planning, area/agents]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P1
next_action: Carry the approved behavior into the isolated-handoff research, run-result design and eventual implementation slices.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: decision
map: "[[Repository audit remediation map]]"
depends_on: []
evidence:
  - "VERIFIED: the audit evaluated the actual loop with mocked SDK failures; ten rejected sandbox creations ended with All done, and the wrapper's unchanged-state path returned exit 0."
  - "VERIFIED: .sandcastle/main.ts can pass leftover branches to the merger, and the AFK work record acknowledges total-failure success and notification retry limits."
  - "OWNER DECISION: on 2026-10-16 the owner replied 'approved' to the four-part partial-failure policy recorded in Resolution. This resolves the behavior decision, not approval of a remediation plan."
---

## Question

What outcomes should make an unattended run successful, incomplete or failed, and which
unfinished results may a subsequent run integrate or retry?

## Evidence

Findings A10 and A11 in [[Repository audit findings 2026-10-16]] distinguish an empty or blocked
queue from failed execution. Produced commits do not establish reviewed or completed work.
The current AFK record also states that a failed issue comment is not retried on a quiet rerun.

## Options

1. **Explicit phase outcomes with guarded recovery.** Successful work may proceed independently,
   but failed review blocks that issue's automatic integration. A run with failed or incomplete
   work reports a non-success outcome and names the remaining work. Recovery preserves completed
   phases and retries eligible missing steps without duplicate notification.
2. **Best-effort integration.** Continue integrating available commits, including unreviewed
   leftovers, and rely on later owner inspection. This retains more current behavior but requires
   an explicit incomplete result so a partial run cannot be mistaken for completed work.

## Recommendation

Choose explicit phase outcomes with guarded recovery. Distinguish planned work, produced
commits, passed review, local integration, an open PR and delivered notification. Keep an empty
or wholly blocked queue separate from failed execution, and report the latter clearly.

## Resolution

OWNER DECISION: on 2026-10-16 the owner replied **"approved"** to this proposed policy:

- Successful, checked and reviewed issues may proceed into a PR.
- Failed or unreviewed issues remain unintegrated.
- The overall run reports incomplete with a nonzero exit, naming what failed.
- Retries resume missing phases, preserving completed work and avoiding duplicate notifications.

For example, if issue A passes review and issue B fails review, A may proceed while B stays
blocked and the run reports incomplete. Owner approval and merging of the resulting PR remain
separate from these execution outcomes.

The concrete run-result format, exit-code mapping and retry scheduling still need design and
tests. [[Establish a feasible isolated Sandcastle handoff]] must account for this approved policy.
