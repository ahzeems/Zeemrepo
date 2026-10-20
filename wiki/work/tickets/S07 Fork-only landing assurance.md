---
type: ticket
title: S07 Fork-only landing assurance
summary: Audit this fork after its verified boundary and validate exact main-branch PR landings against the relevant historical owner policy.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges its pull request; with A07 fixed, npm run audit on main is expected to pass.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S03 Fresh pinned main revisions]]"]
related: ["[[Choose the landing audit history scope]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S07, findings A07/A08 and its S03 prerequisite."
  - "OWNER DECISION: job-spec approval is PR 17, merged after an APPROVED code-owner review; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parent S03 landed as PR 25, squash commit 4b64bcc, whose tree equals the reviewed head 6182ebd; this branch starts from 4b64bcc."
  - "VERIFIED: before the fix, npm run audit on main 4b64bcc exited 1 and reported every fork merge (PR 2 to PR 25) as unverified-pr, because config/landing-audit.json named ahzeems/Zeemrepo (A07)."
  - "VERIFIED: at 204cd29, node --test on landing-audit, code-owners and pr-ready tests passed 52 of 52. Removing the base check, the merger check, the boundary check or the strict gh parsing, reading CODEOWNERS at the landing commit instead of its parent, or comparing logins case-sensitively each failed at least one test."
  - "VERIFIED: fixture coverage: a direct update after the boundary is reported and the boundary commit is not; a boundary on a merged side branch or a missing commit is an error before GitHub is asked; a PR into another branch is wrong-base; an open PR, another merge commit or no PR is unverified-pr; a merger outside the CODEOWNERS of the time, or none, is unauthorized-merger; a CODEOWNERS handover passes earlier merges by the old owner and fails a later one by them; malformed or partial gh answers and gh failures are errors."
  - "VERIFIED: a live read-only run of the new classification with gh as the machine account on 2026-10-17 found f9c1b9d on main's first-parent line and all 20 commits after it, bf3e407 (PR 2) to 4b64bcc (PR 25), ok: merged into main as that commit by ahzeems, the code owner at each parent."
  - "INFERRED: the policy each landing is held to is CODEOWNERS at its first parent on main, which itself landed through a reviewed PR; .github/CODEOWNERS named only @ahzeems at every parent in range, so no fixture used a real historical rotation."
  - "VERIFIED: an independent verifier (Claude Code, Opus 5.5, separate context) rated head b96ef52 PASS with all five criteria MET and four LOW findings. Fixed after it: tests now drop state or baseRefName from the gh answer and audit a parent without CODEOWNERS, and each of the three mutations it found surviving now fails a test; the contract states the CODEOWNERS limits; the project record edit outside this ticket's allowed files was reverted. Left open: config/landing-audit.json is not pinned to the owner's boundary, because moving it already needs an owner-merged PR."
  - "UNKNOWN: npm run audit itself reads its config from the fetched main, so the end-to-end pass on the real repository is only observable after this PR merges; independent review of this head is pending and the PR body records it."

---

## Goal

Make a passing landing audit establish the approved fork-only main-branch PR provenance guarantee.

## Inputs

- Plan S07, audits A07/A08 and the boundary evidence in Choose the landing audit history scope.
- Target `Zimfra/software_testing`; exclusive start `f9c1b9d3853226fe8a1a3181703f884106393ad0`; first included merge `bf3e4073f32ae593d02c55eae1f003ba711bd41e`.
- Inspect `landing-audit.ts`, its tests, `config/landing-audit.json` and the merge-gate contract.

## Approach

1. Configure the fork and exclusive boundary, verifying that it belongs to the freshly fetched main history.
2. Validate each in-scope landing's merged state, exact SHA, main base and authorized merger under the relevant trusted historical policy.
3. Report unverifiable provenance as an error/refusal, not a clean audit, and state the excluded inherited scope.

## Acceptance criteria

- [x] The first fork merge is included; history at and before the inherited boundary is excluded.
- [x] Wrong/missing/nonancestor boundaries and failed external queries cannot pass.
- [x] A direct update, non-main PR, mismatched SHA or unauthorized merger is detected.
- [x] A historical owner change does not invalidate a previously authorized landing merely because today's owner differs.
- [x] Correct fork fixtures pass and output explicitly states the scope of assurance.

## Out of scope

Auditing inherited upstream history, rewriting Git history or changing who may approve/merge.

## Allowed files

- `scripts/git/landing-audit.ts`, `scripts/git/landing-audit.test.ts`, `config/landing-audit.json`.
- Bounded `scripts/git/code-owners*.ts` with sibling tests if shared policy parsing is required; `scripts/git/pr-ready.ts` and `scripts/git/pr-ready.test.ts` only to reuse that same parser.
- `wiki/reference/Merge gate contract.md`, `wiki/runbooks/Land a change.md`, this ticket and `CHANGELOG.md`.

## Forbidden files

All other files; do not edit historical owner policy, current CODEOWNERS, branch rules or real refs as fixtures.

## Human checkpoints

Verify approval and S03 landing. If historical authority cannot be resolved under the recorded policy, report it and ask the owner rather than inventing an identity.

## Secrets needed

None for fixtures. Read-only GitHub verification may use the configured machine account; no write trial is needed.

## Tests and evals

- `node --test "scripts/git/*.test.ts"`; `npm run check`.
- Positive: fork-only chain, correct merge and historical owner rotation.
- Broken: boundary errors, direct main update, release-branch PR with a matching SHA, wrong merger, malformed answer and unreachable service. Use local Git history and controlled GitHub responses.

## Rollback and recovery

Keep the selected historical boundary immutable unless the owner explicitly revises the decision. Repair an audit defect through a new PR; never rewrite history to satisfy the audit.

## Evidence

Record boundary inclusion/exclusion, policy revision used for each fixture, command exits and independent verification; identify live queries separately.

## Wiki and doc updates

Update the audit command's documented guarantee and limitations. Link completion to its owner-merged implementation PR.
