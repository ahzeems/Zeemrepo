---
type: ticket
title: Choose the Sandcastle execution boundary
summary: The owner selected full-workflow isolation with a controlled host import; feasibility research must now establish the smallest supported design.
tags: [area/planning, area/agents, kind/architecture]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P1
next_action: Establish a feasible isolated handoff before the remediation plan names a topology or transfer mechanism.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: decision
map: "[[Repository audit remediation map]]"
depends_on: []
evidence:
  - "VERIFIED: at the audit baseline, .sandcastle/main.ts calls sandbox.close before scripts/sandcastle/afk.ts can run its post-loop tampering check."
  - "VERIFIED: the pinned Sandcastle 0.12.0 source inspected on 2026-10-16 mounts Git metadata into the sandbox and calls host-side git status during cleanup. Source links are in the audit inventory."
  - "UNKNOWN: an end-to-end Docker reproduction and the implementation cost of alternative boundaries have not been measured."
  - "OWNER DECISION: on 2026-10-16 the owner selected full-workflow isolation; the verbatim answer is recorded in Resolution. This resolves the target boundary, not implementation or plan approval."
---

## Question

Should the complete agent execution workflow be isolated from host Git metadata and execution,
or should the current host-side SDK workflow be retained and hardened?

## Evidence

See finding A01 in [[Repository audit findings 2026-10-16]]. The wrapper's check runs after SDK
cleanup, so changing only that wrapper's order cannot protect earlier host-side operations.
Giving each agent a different worktree is also insufficient when the worktrees share Git metadata.

[[Sandcastle runs unattended and lands by pull request]] also records a separate execution-policy
question: the landing step runs `npm run check` on the host. Its current default permits unattended
landing only for documentation; running agent-written code requires the owner's explicit
`SANDCASTLE_AFK_LAND_CODE=1` opt-in. Git hardening does not resolve that code-execution boundary.

## Options

1. **Isolate the complete workflow.** Put the coordinator, agent-side Git operations and checks
   inside a disposable execution environment. Transfer changes to the host through a defined,
   host-controlled import that does not adopt sandbox configuration or hooks. This provides a
   clearer boundary but needs a tested transfer and recovery design.
2. **Harden the current host workflow.** Keep the SDK architecture and disarm executable Git
   configuration and hooks at every host-side operation, including cleanup and failure paths.
   This may be a smaller initial change, but correctness depends on complete SDK coverage and
   maintaining it across upgrades. Preserve the current documentation-only landing default and
   explicit code opt-in unless the owner separately chooses and records a different policy.

## Recommendation

Target isolation of the complete workflow. Start the eventual implementation with a bounded,
reproducible test of the boundary and the smallest transfer design. A separate clone alone is
not enough if host processes later execute Git against its agent-controlled configuration.

The owner chooses the target and acceptable cost; feasibility must be established before the
plan promises a particular container topology or dependency change.

## Resolution

OWNER DECISION: on 2026-10-16 the owner answered:

> Isolate the complete workflow — recommended. Run the coordinator, agents, Git operations, and checks in a disposable environment, then import changes through a controlled host step. This gives a clearer boundary but requires more integration work.

The selected target isolates the complete workflow, with a controlled import into the host.
The owner accepts the additional integration work. This is a planning decision, not evidence
that isolation is implemented or that a particular runtime, transfer format or infrastructure
purchase is approved.

[[Establish a feasible isolated Sandcastle handoff]] now owns the factual design question.
The partial-failure and audit-history choices remain with their own decision tickets.
