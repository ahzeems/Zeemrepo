---
type: ticket
title: S26 Evidence-based token setup guidance
summary: Correct token setup guidance so identity, expiry and write permission are supported by the checks that actually establish them.
tags: [area/auth, area/docs, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P2
next_action: Owner reviews the pull request from branch docs/s26-token-setup-guidance; an independent verifier reviews its head first.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Sandcastle token setup lessons]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S26, finding A16 and its S01 safe-verification prerequisite."
  - "VERIFIED: gh pr view on 2026-10-18 showed PR 17 (job specs) merged by the owner on 2026-10-16 and PR 18 (S01) merged by the owner on 2026-10-17; the ticket's later revision landed through PR 30."
  - "VERIFIED: on 2026-10-18 the Token setup section of wiki/runbooks/Run Sandcastle on GitHub issues.md was rewritten: equal expiry is no longer read as proof of the old token or required to differ, the read check is identity evidence only, the expiry header is optional metadata, and an owner-approved comment is the only write check."
  - "VERIFIED: GitHub claims in that section cite eight GitHub Docs pages, fetched as Markdown from docs.github.com/api/article/body on 2026-10-18 (the 401 and failed-login 403 claims cite Authenticating to the REST API; Troubleshooting the REST API is cited only for Resource not accessible and the X-Accepted-GitHub-Permissions header), and the GitHub Changelog post of 2021-07-26 for the GitHub-Authentication-Token-Expiration header, fetched the same day; the docs pages read do not describe that header and the runbook says so."
  - "VERIFIED: the earlier runbook claim that editing an account-owned token cannot make it an organisation token found no support in the pages read; the runbook now marks it unknown and keeps the edit observation as dated history."
  - "VERIFIED: gh api --help (gh 2.102.0 on the host) states that gh api sends POST when parameters are added, which the write-check command relies on; the gh version inside the sandbox image was not checked."
  - "VERIFIED: npm run wiki:lint and npm run governance:check exited 0 on 2026-10-18 after the edits; npm run check exited 0 on 2026-10-18 at commit 0b99cba (round one) and again at 5e8b748 after the review fixes (1098 of 1098 Node tests, 60 of 60 evals tests each time); these are structural and selection results, not proof that the runbook steps work."
  - "INFERRED: relayed verifier report, review round one at d8a3f20: FAIL on one MEDIUM (source 2 was cited for a 401 section it does not contain) and LOWs (the pending-approval 403 joined to sources that do not state it, a leftover claim that the reads touch this repository, and an npm run check line naming no commit). Commit 5e8b748 fixes the runbook and this record names the commits; the verifier re-reviews the new head."
  - "INFERRED: two different tokens can carry the same expiry date, because the date is chosen at creation, so expiry cannot identify a token (audit A16)."
  - "UNKNOWN: no live read or write trial was run for this ticket; no token was created, viewed or used, and no owner authorization for a trial was sought. The commands in steps 5 and 6 are unexecuted in this form."
  - "UNKNOWN: whether GitHub still returns the expiry header today; only the 2021 announcement documents it."
---

## Goal

Provide token instructions whose identity, expiry and permission claims match their actual evidence.

## Inputs

- Plan S26, audit A16, the Sandcastle runbook's Token setup section and Sandcastle token setup lessons.
- Read current primary GitHub token/permission documentation and record the access date.

## Approach

1. Remove expiry-as-identity reasoning and distinguish a read-only diagnostic from proof of write capability.
2. Check version-sensitive resource-owner, permission and approval claims against primary sources; keep unverified observations labeled.
3. Preserve a clear, separately authorized write-capability trial without printing or storing token values.

## Acceptance criteria

- [x] Equal expiry is not presented as proof that the old token remains or as a required difference between tokens.
- [x] Instructions distinguish the authenticated identity, optional expiry metadata and a real write-permission result.
- [x] Primary sources and read dates support version-sensitive claims; unsupported categorical claims are corrected or explicitly uncertain.
- [x] Any live write trial has explicit owner authorization and records the observed actor/result without secrets; no mock is claimed as real permission proof.
- [x] Wiki/governance/full checks pass and the operating guidance agrees with its evidence record.

## Out of scope

Generating/revoking tokens, repairing local auth profiles, changing organization policy or conducting an unapproved live trial.

## Allowed files

- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `wiki/work/ideas/Sandcastle token setup lessons.md`.
- This ticket and a new `changelog/` fragment; update a directly affected memory-index summary only if its meaning changes.

## Forbidden files

All other files; credential stores, env-file values, repository/organization settings and historical decision/session bodies.

## Human checkpoints

Verify job approval and S01 landing. Ask before any authenticated write trial and name its exact target; the owner performs credential/organization changes.

## Secrets needed

None for source-based documentation work. An authorized trial uses an existing scoped credential through the documented environment without exposing its value.

## Tests and evals

- `npm run wiki:lint`; `npm run governance:check`; `npm run check`.
- Positive: a distinct token may share an expiry, and a valid identity read is described only as identity evidence.
- Broken reasoning control: a read-only token can pass read diagnostics but fail a comment; the instructions must require actual write evidence for the stronger claim.
- Review the final commands for failure handling and source support. Do not invent tests mirroring prose or claim an unperformed live permission check.

## Rollback and recovery

Correct current guidance with observed facts while preserving historical observations as history. No token or account rollback is performed by this documentation job.

## Evidence

Record primary URLs/access dates, the claims they support, documentation check exits and any explicitly authorized live result, with independent review.

## Wiki and doc updates

Update the current runbook and owning evidence record, retaining the distinction between observed history and verified current guidance.

## Outcome

- The runbook's Token setup section separates three checks: identity (`gh api user`), expiry
  (an optional header, for records only) and write permission (one owner-approved comment whose
  author is read back). Each GitHub claim names a numbered source read on 2026-10-18; claims from
  the 2026-10-15 swap say "observed".
- The Prerequisites bullet points at the read check (step 5) and the write check (step 6).
- No live trial was run. The "Any live write trial" criterion is met because none happened; step
  6 tells the reader to get the owner's approval for the comment first.
- Tests: none added. The ticket's Tests and evals forbid tests that mirror prose, and no repository
  check reads runbook meaning. Prevention: none, because wiki:lint and governance:check test note
  structure and replaced-rule text, not whether a runbook step is sound.

## Discovered work

- `wiki/work/ideas/Runbook prerequisites point at the token check.md` still says the check is
  "step 5" with its throwaway comment; after this change the comment is step 6. It is a dated
  record outside this ticket's Allowed files, so it was left as written.
- The governance guard could refuse the replaced claim ("expiry date must differ") if it were
  listed in `config/governance-alignment.json`; that file is outside this ticket's scope.
