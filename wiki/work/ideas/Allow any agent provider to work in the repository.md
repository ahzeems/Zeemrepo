---
type: idea
title: Allow any agent provider to work in the repository
summary: Remove provider-specific authoring barriers so the current agent can plan, document and verify work with truthful attribution and the shared repository checks.
tags: [area/agents, area/wiki, area/compliance]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P1
next_action: Continue the approved audit remediation plan through job-spec creation and owner approval.
related: ["[[ADR-0026 Any provider may work under shared rules]]", "[[Work with any agent provider]]", "[[Repository audit remediation map]]"]
evidence:
  - "OWNER DECISION: on 2026-10-16 the owner said: lets change the only claude code to any providor - remove these blocks"
  - "VERIFIED: before implementation, the five targeted Node test files reported 158 tests, 143 passing and 15 failing entries, including parent subtests; failures exposed author rejection, adapter-file rejection, missing workflow-critical paths and stale governance policy."
  - "VERIFIED: the checkout started clean at 616a4ea59f84885cae294f0aa5f31dd9dffac129; Node 24.22.0 was used for the targeted tests after installing the locked dependencies with npm ci --ignore-scripts."
  - "VERIFIED: npm run check exits 0 on the updated tree with Node 24.22.0: 762 Node tests, 56 Python tests, 99.31 percent line coverage, 92.83 percent branch coverage and 96.92 percent function coverage; every repository guard passes."
  - "VERIFIED: the wiki, skill, governance and ECC-rules guards from main at 616a4ea59f84885cae294f0aa5f31dd9dffac129 each exit 0 against the updated tree. The schema examples let the old wiki guard recognize this branch's author while the new guard accepts unregistered identifiers."
  - "VERIFIED: independent OpenCode standards and spec reviewers inspected 4cb19802c18914e707fbd39d2a45342d9b6a0158. The spec reviewer found stale registration guidance in Maintain the repository wiki and an implicit fallback for a harness built-in; this follow-up corrects both."
  - "VERIFIED: npm run pr at 4cb19802c18914e707fbd39d2a45342d9b6a0158 passed all checks, then refused before pushing because gh auth status reported an invalid stored account. The active login is also a code owner; publication requires a valid machine-account session."
  - "VERIFIED: separate OpenCode standards and spec reviewers reported no remaining findings at 7fd3faa86650ce6e2c4c7874e5204ab87c0b611a. An independent verifier ran npm run check at that head: 762 Node tests and 56 Python tests passed, all guards passed, and the checkout remained clean."
  - "VERIFIED: the provider-neutral change and planning records were published as PR 15 by the machine account on 2026-10-16; owner merge approval was pending at publication."
  - "VERIFIED: GitHub reports PR 15 merged by code owner ahzeems on 2026-10-16 as edb9e35da1284e7593bd62f6408cc719771d9b7d, landing the provider-neutral authoring change and approving the remediation plan."
  - "UNKNOWN: native skill discovery and model-backed behavior across providers have not been exercised by this change."
---

## Problem

Planning the audit remediation in the current harness was blocked by a closed author list and
a policy that required a different harness. The skill linter also rejected alternative adapter
files, the governance guard flagged their names, and the change-record guard ignored their
instruction paths.

## Desired outcome

Any provider or harness can follow the shared workflow, write correctly attributed notes and
use available equivalent tools. Author names remain kebab-case, malformed metadata is refused,
and adapter changes carry the same change records as other workflow-critical files.

The owner's instruction authorizes interface substitutions in `branch-review` and `write-skill`:
use available independent reviewer contexts and skill discovery or explicit reads rather than
requiring an installed ECC tool. The methods, ownership and review requirements remain defined
by their canonical skills. Their provenance records append the hashes of these substitutions.

## Next step

The authoring prerequisite landed through [PR 15](https://github.com/Zimfra/software_testing/pull/15).
Continue [[Repository audit remediation implementation plan]] through the fresh-session handoff:
verify its approval, create the agreed job specs and obtain their owner approval before implementation.
