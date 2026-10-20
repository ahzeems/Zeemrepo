---
type: ticket
title: Restore machine-account publication access
summary: Superseded by the publication issue because authentication blocks delivery, not the map's design decisions.
tags: [area/auth, area/github, tool/gh]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: superseded
superseded_by: "[[Planning pull request publication is blocked]]"
owner: human
priority: P1
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: prerequisite
map: "[[Repository audit remediation map]]"
depends_on: []
evidence:
  - "VERIFIED: npm run pr on 4cb19802c18914e707fbd39d2a45342d9b6a0158 passed the full check and then refused before pushing because gh auth status reported an invalid stored account."
  - "VERIFIED: the active gh login matched .github/CODEOWNERS during the authoring-prerequisite work, so it also fails the separate code-owner publication refusal."
---

## Question

Can the planning branch be published using a valid machine-account session through `npm run pr`?

## Evidence

GitHub publication is independent of the LLM provider. The preceding authoring change removed
the provider barrier, but the repository's machine-account publication rule still applies.
No token, credential file or account identifier needs to be copied into these records.

## Options

- The owner repairs authentication on this machine and selects the intended machine account.
- The owner uses another checkout with a valid machine-account session after transferring and
  verifying the intended commits through an authorized route.

## Recommendation

Repair the current authentication session and use the existing PR tool. Recheck `gh auth status`,
the active login, the target repository and the actual branch before publication. The agent
should not remove credentials, switch identities or bypass the refusal on the owner's behalf.

## Resolution

Superseded on 2026-10-16 by [[Planning pull request publication is blocked]]. Authentication
blocks publishing the plan and obtaining its owner-merged approval; it does not block finishing
the design map. The issue now owns the blocker and its verification. No authentication repair
or publication is claimed by this change in tracking.
