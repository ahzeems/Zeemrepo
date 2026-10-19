---
type: ticket
title: S16 Trusted publication of verified candidate refs
summary: Publish only receipt-bound candidate refs through pinned host tooling while preserving actor, repository, branch and owner-review protections.
tags: [area/git, area/github, area/agents]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges its PR. S17 and S18 build on scripts/sandcastle/isolated-publication.ts; the S09 afk fix becomes a new build ticket after PR 50 merges (owner decision below).
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S05 Checked-commit publication invariant]]", "[[S06 Exact PR destination and head identity]]", "[[S13 Candidate artifact contract and quarantine]]", "[[S15 Independent isolated verification receipts]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S16, the A01 publication boundary and A04/A05 invariants, with its four named parents."
  - "VERIFIED: job-spec approval is PR 17, and the parents landed: S05 as PR 32 (640786a), S06 as PRs 38 (5385769) and 42 (801eb53), S13 as PR 37 (fdd46ff), S15 as PR 49 (caa99e3); gh pr view on 2026-10-18 reported PRs 17 and 49 MERGED, the commits are on origin/main and all four parent tickets are status done. This branch starts from origin/main caa99e3. Implemented by Claude Code (claude-opus-5-5)."
  - "VERIFIED: red at 6002c98 (tests and a typed stub, needed because the pre-commit hook runs lint and typecheck): node --test scripts/sandcastle/isolated-publication.test.ts failed 18 of 18. Green at 1204d46: 18 of 18. pr-ready.ts was first refactored at c2688ac to export actorRefusals and handoff (with an explicit title and body), and scripts/git/pr-ready.test.ts still passed 111 of 111."
  - "VERIFIED: a mutation run at 1204d46 planted 18 mutants, each restored: 17 failed tests (candidate git hooks not disabled 2 of 18; control fetch hooks not disabled 1; human review ignored 1; receipt ref not compared 1; imported SHA not compared 1; manifest digest not compared 1; destination repository not compared 1; main freshness not checked 1; actor checks dropped 1; remote tip ignored 1; ancestry always true 1; early main policy dropped 1; gh fills title and body 1; dirty control accepted 1; pushed note dropped 1; push failure claims nothing reached origin 1; receipt not validated 3). The survivor removed the bundle digest comparison, which the manifest digest already implies (quarantine checks the bundle against the manifest's SHA-256), so d5545ad deleted that code instead of adding a test."
  - "VERIFIED: at d5545ad node --test over scripts/git/*.test.ts and scripts/sandcastle/*.test.ts passed 645 of 645."
  - "VERIFIED: the tests run real Git (a fresh quarantine import, ls-remote and push over the file transport to a local bare repository routed by insteadOf, with protocol.allow=never) and a faked gh. Refusal matrix, each asserting nothing was pushed: missing, tampered and failed receipts; another run, task, base, candidate, ref or repository; another candidate's artifact and an edited manifest; origin and pushurl naming another repository; the owner's and a code owner's login; main moved past the base; a dirty control checkout; refs/heads/main even with a forged receipt naming it; a remote branch holding other work (unchanged afterwards)."
  - "VERIFIED: executable provenance in the tests: every recorded call is git or gh (HOST_EXECUTABLES), every git on the quarantine repository carries core.hooksPath=/dev/null, nothing checks out, and sentinel hooks in a hooks directory set in the control checkout and injected as config, plus a candidate .githooks/pre-push and package.json check script, never fire. The candidate changing that machinery is refused for human review."
  - "VERIFIED: post-push behaviour in the tests: a pull request with another head, base or a fork refuses and says the SHA is already pushed; a failed gh pr create after the push throws with the same note; a push rejected by the remote says it may or may not have reached origin; a rerun reuses the exact open pull request."
  - "VERIFIED: at 2252281 npm run check exited 0: 1265 of 1265 tests, coverage all files 99.13% lines and 91.42% branches, isolated-publication.ts 100% lines and 88.89% branches, pr-ready.ts 100% lines and 90.71% branches, plus evals and every lint, wiki, skills, governance, rules, compliance, changelog and memory guard."
  - "OWNER DECISION: 2026-10-19, relayed by the coordinator: \"New ticket after #50 (Recommended)\". The S09 afk fix (verifier LOW-1 on PR 53: no open work item owned it) becomes a new build ticket, built after PR 50 merges and drafted in a separate records PR."
  - "VERIFIED: npm run pr refused twice before opening PR 53, each time with 'npm run check changed this repository's git state ... refs changed', because other agents' worktrees share this .git; origin/main had not moved (caa99e3). The third run opened PR 53 at 83acd3d. CI at 83acd3d: check and guards passed (runs 39174257280 and 39174257296, headSha read with gh run view on 2026-10-19)."
  - "INFERRED: relayed verifier report (coordinator message, 2026-10-19): an independent verifier passed PR 53 at 83acd3d with no CRITICAL, HIGH or MEDIUM finding and four LOWs: no open work item owned the afk fix (LOW-1), a control checkout on an unpushed local commit published (LOW-2), a base strictly ahead of origin/main passed (LOW-3), and dropping consistencyRefusals in verification-receipt.ts survived S16's tests (LOW-4)."
  - "VERIFIED: review fixes test first. At e591005 three new tests ran: the LOW-2 and LOW-3 tests failed (2 of 21), and the LOW-4 self-inconsistent receipt test (a failed step under outcome passed, rewritten canonically so its digest is valid) passed, since validateReceipt already refuses it. Green at 5f5fca1: 21 of 21. Replanted mutants, each restored, each failing exactly its new test (1 of 21): control HEAD reachability dropped, base-on-main check dropped, and consistencyRefusals dropped in verification-receipt.ts (the verifier's M3)."
  - "VERIFIED: what pinned means as enforced at 5f5fca1: the control checkout has no uncommitted changes to tracked files and its HEAD is contained in the freshly fetched origin/main; the verified base must be on origin/main and origin/main must not have moved past it, so the base is origin's main itself."
  - "VERIFIED: correction to the round-one record. The unrelated-history test is not equivalent to a base strictly ahead of main: with unrelated history the moved-past check refuses too, so that test told the two checks apart only by message, and reversing the base check's arguments survived it (the re-review's probe published a candidate on an unreviewed base commit). At 9bef016 a new test builds a base one commit ahead of origin's main, verifies a candidate on it to a valid receipt and asserts publication refuses with 'the verified base <sha> is not on origin's main' and nothing pushed. It passes on 5f5fca1's code (22 of 22); with the arguments reversed (N3) it alone fails, 1 of 22, and with the base check dropped it and the unrelated-history test fail, 2 of 22."
  - "OWNER DECISION: 2026-10-19, relayed by the coordinator. Asked 'S16 (#53): may the builder change scripts/test-support/verifier-fixture.ts, outside the ticket's allowed files, to export two helpers so a test can build a base one commit ahead of main?', the owner answered \"Allow the export (Recommended)\". Scope exception: that file only, for exporting guestOn and exportArtifact; 9bef016 adds export to those two functions and changes nothing else in it."
  - "VERIFIED: npm run pr in the review-fix round: at 58f0d9b npm run check failed wiki:compliance (the runbook's updated date) and refs changed; at 33cc404 refs changed, then GitHub still reported head 83acd3d after the push, then refs changed again. 33cc404 reached origin and PR 53; CI check and guards passed there (runs 39178212650 and 39178211039)."
  - "INFERRED: relayed re-review (coordinator message, 2026-10-19): PR 53 passed at 33cc404 with one LOW, no test for a base strictly ahead of origin/main, closed by 9bef016."
  - "INFERRED: no real receipt can exist yet (no live reviewer is authorised, per S15's owner decision), so publication has run only against fake receipts, a faked gh and a local bare remote; no live publication trial was run or requested. This machine has no Docker, so npm run sandbox:smoke runs only in CI; it does not exercise publication."
---

## Goal

Hand the intended independently verified commit to the correct PR using trusted host tooling, never candidate scripts or hooks.

## Inputs

- Plan S16, landed publication-state and PR-identity checks, S13 artifact validation and S15 receipt authority.
- Inspect `pr-ready.ts`, branch-policy/guard logic and `.githooks/pre-push` to identify every host executable.
- Read the recorded machine-account environment limitation before any authorized publication.

## Approach

1. Publish from a pinned trusted control checkout, accepting only the validated ref and receipt context.
2. Reuse the existing actor/repository/branch checks without pretending control-checkout tests verify candidate code.
3. Integrate the hook/check contract explicitly; no generic unchecked skip or `--no-verify` path.
4. Preserve post-push recovery information if PR creation or lookup fails.

## Acceptance criteria

- [x] Unverified refs, stale/forged receipts, wrong destinations or PR identities cannot publish successfully.
- [x] Owner/code-owner credentials, main pushes, history rewrites and protection bypasses remain refused.
- [x] A valid receipt-bound candidate creates or reuses the exact intended PR.
- [x] Tests prove the source of each host-side executable; planted candidate scripts/hooks never run on the host.
- [x] Candidate verification is distinguished from control-checkout checks, and a post-push failure is reported accurately.

## Out of scope

Owner approval/merging, credential-profile repair, notification retries and public CLI cutover.

## Allowed files

- New `scripts/sandcastle/isolated-publication*.ts` with sibling tests; `scripts/sandcastle/artifact*.ts`, `scripts/sandcastle/quarantine*.ts`, `scripts/sandcastle/verification-receipt*.ts` for explicit integration.
- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`, `.githooks/pre-push`, `scripts/git/hooks.test.ts`, `scripts/git/branch-guard.test.ts`, `scripts/git/branch-policy.test.ts` for preserved invariants.
- `wiki/reference/Merge gate contract.md`, `wiki/runbooks/Land a change.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; particularly CODEOWNERS, GitHub rulesets, owner credentials and candidate-supplied host executables.

## Human checkpoints

Verify approval and all parent landings. Request explicit authorization for an additional live publication trial; ordinary implementation-PR publication follows the existing workflow. Stop if hook compatibility would require bypassing protections.

## Secrets needed

None for fake-service/local-remote tests. Authorized publication uses the machine account in a validated context; no credential is copied into the guest, repository or evidence.

## Tests and evals

- `node --test "scripts/git/*.test.ts" "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Positive: real local Git transport with a valid receipt and controlled correct GitHub response.
- Broken: each identity/receipt/actor/ref violation, planted candidate executables and failure after push. Assert no forbidden remote write and preserve truthful partial-state reporting.

## Rollback and recovery

Inspect remote state before retrying an ambiguous push/PR result. Preserve verified refs and receipts; never force-push or repeat a write blindly. Repair through a new PR.

## Evidence

Record checked/published SHAs, actor/repository checks, executable provenance, hook behavior, fake/live boundaries and independent verification.

## Wiki and doc updates

Update the merge-gate contract and publication recovery instructions to match the isolated path without claiming the manual path changed unless it actually did.

## Discovered work

- S09's MEDIUM verifier finding is still open: after a loop exit 2, `scripts/sandcastle/afk.ts`
  (`main` and `classify`) lands every `sandcastle/issue-<N>` branch Git shows merged, so a merger
  that merges a held branch it was not handed gets that branch landed. Closing it means changing
  `afk.ts` to land only the issues the coordinator handed the merger, which needs the coordinator's
  RunResult to reach afk (`scripts/sandcastle/coordinator.ts`, which S11 is editing). Both files are
  outside S16's Allowed files, so nothing was changed here. OWNER DECISION, 2026-10-19, relayed by
  the coordinator: "New ticket after #50 (Recommended)". The afk fix becomes a new build ticket,
  built after PR 50 merges and drafted in a separate records PR.
- Isolated publication has no npm script; the public commands still land through `npm run pr`
  from the host. S18 owns the cutover.
- A second verified candidate for a branch that already holds an earlier candidate refuses as a
  rewrite: the fresh quarantine does not hold the old tip, so its ancestry cannot be confirmed.
  Publishing a successor needs a new branch name, or fetching the old tip into quarantine first.
- GitHub can report the previous head just after a push (S06's head lag); a rerun of
  publication then refuses as a stale head in the same way as `npm run pr`.
