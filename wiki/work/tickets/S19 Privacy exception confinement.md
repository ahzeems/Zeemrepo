---
type: ticket
title: S19 Privacy exception confinement
summary: Keep the sandbox-home exception confined to genuine role-name paths for every runtime identity, including traversal cases.
tags: [area/wiki, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify job approval and S01 completion, then reproduce traversal under role-name identities before repairing the exception.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S19, finding A15 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Allow genuine role-name sandbox paths without letting that exception hide a path outside the allowed home.

## Inputs

- Plan S19, audit A15, `scripts/wiki/redaction.ts` and its identity-injected tests.
- Read the existing allowed-path, look-alike, case and traversal cases before changing matching semantics.

## Approach

1. Add the escaping-path control under role-name identities, where the personal-login check cannot mask the gap.
2. Confine the exception using the actual path semantics while retaining valid sandbox paths.
3. Drive the result through the existing redaction/wiki validation path.

## Acceptance criteria

- [ ] Escaping traversal fails the baseline control under both role-name runtime identities.
- [ ] Genuine sandbox paths pass under role and personal identities; safe internal normalization has explicit coverage.
- [ ] Escaping paths, look-alike home names and nonallowed homes are detected without depending on the current login.
- [ ] Existing secret/identity checks remain active and diagnostics do not echo sensitive input.
- [ ] Redaction tests, wiki validation and the full check pass.

## Out of scope

Changing the general privacy policy, collecting real identifiers or widening other path exceptions.

## Allowed files

- `scripts/wiki/redaction.ts`, `scripts/wiki/redaction.test.ts`, relevant wiki-validation tests/fixtures.
- `.claude/skills/wiki-memory/references/writing-standards.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files, real credential files and real personal home paths in published test data.

## Human checkpoints

Verify approval and parent landing. Obtain owner agreement before changing which homes or identity classes are exempt.

## Secrets needed

None; construct synthetic paths/identities in tests rather than copying this machine's identifiers.

## Tests and evals

- `node --test scripts/wiki/redaction.test.ts scripts/wiki/wiki-validation.test.ts`; `npm run wiki:lint`; `npm run check`.
- Positive: permitted role home, exact boundary and valid nested paths.
- Broken: direct and nested traversal escaping that boundary, longer/suffixed names and other-case/nonallowed homes. Run the matrix across role and personal identities and prove the relevant path check catches it.

## Rollback and recovery

Keep newly detected published data out of new evidence. If a false positive is found, add its valid control and repair the narrow matcher rather than broadly disabling privacy checks.

## Evidence

Record the identity/path matrix, red/green findings and command exits using redacted or generated values, plus independent verification.

## Wiki and doc updates

Describe the implemented exception precisely and correct any affected claim without rewriting historical changelog entries.
