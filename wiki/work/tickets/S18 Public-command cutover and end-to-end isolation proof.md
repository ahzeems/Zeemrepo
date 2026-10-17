---
type: ticket
title: S18 Public-command cutover and end-to-end isolation proof
summary: Route the public Sandcastle commands through the complete isolated pipeline and retire replaced host-execution paths only after end-to-end proof.
tags: [area/agents, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P1
next_action: Verify approval and S14-S17 completion, then exercise and switch the complete public workflow with its retirement checks.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S14 Isolated coordinator preparation and export]]", "[[S15 Independent isolated verification receipts]]", "[[S16 Trusted publication of verified candidate refs]]", "[[S17 Durable recovery and notification reconciliation]]"]
related: ["[[Repository audit findings 2026-10-16]]", "[[Docker-capable containment proof is unavailable locally]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S18, A01/A10/A13/A14 integration and its four named prerequisites."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make the public commands use the verified isolated workflow end to end, with accurate outcomes and no surviving unsafe replacement path.

## Inputs

- Plan S18 and all landed parent implementations, receipts and matching-head container evidence.
- Read current `sandcastle`/`sandcastle:afk` scripts, `.sandcastle/main.ts`, AFK and branch/reflog callers before retiring anything.

## Approach

1. Exercise a complete fake-agent run through preparation, verification, eligible integration, controlled publication and recovery.
2. Switch the public entry points to the completed path and document manual versus AFK outcomes explicitly.
3. Retire replaced host-execution/reflog/bypass paths and repoint all active guidance in the same change, preserving history records.

## Acceptance criteria

- [ ] Public commands reach the intended verified handoff through a real container and fake external services, without paid model calls.
- [ ] Mixed success/failure, blocked work, interrupted delivery and restart satisfy the approved outcomes.
- [ ] No candidate script, hook or Git configuration executes on the host; changed integration SHAs are independently verified.
- [ ] Missing runtime, verification or authority cannot choose an old host-execution or unchecked opt-in path.
- [ ] Active callers/docs reference the new path; retired code is removed only after caller inspection and equivalent refusal controls are retained.
- [ ] Required CI executes the real end-to-end control at the final SHA.

## Out of scope

New model-provider runtime ports, unrelated cleanup and authenticated external acceptance trials without separate authorization.

## Allowed files

- `.sandcastle/main.ts`, relevant `.sandcastle/*-prompt.md` files and `scripts/sandcastle/*.ts` for the explicit cutover/retirement only.
- `package.json`, `eslint.config.ts`, `tsconfig.json`, `.github/workflows/check.yml` as required to keep executed code checked.
- `scripts/lib/change-policy.ts` and its test for newly declared runtime surfaces.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `wiki/runbooks/Verify a repository change.md`, `.claude/skills/verify-work/references/feature-map.md`, `README.md`, `CLAUDE.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no generic verification skips, owner-approval changes, credential-store edits or fallback to host execution.

## Human checkpoints

Verify approval and every parent landing/evidence. Obtain an owner decision if retirement would change behavior outside the approved contract. A real service/model trial requires separate authorization.

## Secrets needed

None for required fake-agent CI proof. Production prerequisites are documented without embedding credential values.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts" "scripts/git/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Positive: full public-command flow with fixed fixture identities, trusted receipts and correct fake publication.
- Broken: host sentinels, malformed/forged results, failed review, changed integration SHA, absent runtime and interrupted notification acknowledgement. Assert both final result and forbidden side effects.

## Rollback and recovery

Preserve run artifacts and refuse automation if the new boundary fails. Do not restore an unsafe host fallback as an emergency shortcut. Roll forward or use a reviewed revert that retains a safe refusal state.

## Evidence

Record the public command, exact candidate/integration/reviewer identities, CI URL, host-sentinel results, failure/recovery matrix and independent final verification.

## Wiki and doc updates

Update every active command recipe and retirement reference, record remaining live-service limits and advance project progress only for actually completed findings.
