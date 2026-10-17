---
type: ticket
title: S22 Historical wiki integrity
summary: Enforce protected historical note bodies and immutable author/creation fields while allowing documented same-day and supersession updates.
tags: [area/wiki, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P2
next_action: Verify approval and S01 completion, then reproduce historical rewrites in disposable Git history before adding enforcement.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S22, finding A21 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Make the existing historical-note and immutable-field rules mechanically verifiable against Git history.

## Inputs

- Plan S22, audit A21, wiki rules, note schema and current wiki-compliance/history helpers.
- Read existing immutable-date/author statements and permitted supersession behavior; use parsed frontmatter.

## Approach

1. Build dated disposable history demonstrating currently accepted forbidden changes.
2. Compare the relevant historical record/body and immutable fields with explicit date and rename semantics.
3. Wire enforcement into the canonical check path and explain standalone/no-history validation limits.

## Acceptance criteria

- [ ] Valid same-day changes and permitted supersession metadata updates pass.
- [ ] Later decision/session body rewrites, original author/creation-date changes and required update-date omissions refuse.
- [ ] Rename/deletion/history-boundary controls cannot silently bypass protection; legitimate documented migration cases have explicit behavior.
- [ ] Missing/unreadable required history produces an unverified/error outcome rather than a false pass.
- [ ] Canonical checks run the history control; current legitimate notes still pass.

## Out of scope

Rewriting real historical notes, changing the immutability policy or trusting timestamps/approval claims without the specified evidence.

## Allowed files

- `scripts/wiki/wiki-compliance*.ts`, `scripts/wiki/wiki-validation*.ts`, and bounded new `scripts/wiki/wiki-history*.ts` with sibling tests.
- `scripts/lib/frontmatter.ts`, `scripts/lib/git.ts` and their sibling tests only if a required reusable capability is missing.
- `package.json`, `.github/workflows/guards.yml` and `CLAUDE.md` only if a separate canonical guard is necessary.
- `.claude/skills/wiki-memory/references/note-schema.md`, `wiki/runbooks/Maintain the repository wiki.md`, `wiki/runbooks/Verify a repository change.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; especially real historical session/decision bodies, original author fields and real Git history used as test data.

## Human checkpoints

Verify approval and parent landing. A legitimate correction that conflicts with the policy needs an owner decision or a superseding note, not an undocumented exception.

## Secrets needed

None; use synthetic notes, identities and commit dates.

## Tests and evals

- `node --test "scripts/wiki/*.test.ts"`; `npm run wiki:lint`; `npm run wiki:compliance`; `npm run check`.
- Positive: same-day body edit and later permitted supersession.
- Broken: later body edit, immutable-field change, unchanged required update date and rename/deletion escape. Inject/control time so CI day changes do not alter the verdict.

## Rollback and recovery

Repair the guard on a new PR if it rejects legitimate history. Preserve original note bodies; record corrections through the repository's supersession method rather than resetting history.

## Evidence

Record fixture commit/date relationships, exact changed fields, red/green exits, standalone limits and independent verification.

## Wiki and doc updates

Document which command enforces each history rule and its boundaries. Update this ticket without rewriting historical evidence to improve the result.
