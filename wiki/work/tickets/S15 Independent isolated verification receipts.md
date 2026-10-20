---
type: ticket
title: S15 Independent isolated verification receipts
summary: Produce trusted verification receipts in fresh isolated contexts, bound to the actual candidate, inputs, check runner and reviewer.
tags: [area/agents, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P1
next_action: None. It landed as PR 49 (caa99e3); S16 is eligible. A live reviewer waits for the owner's authorization, and the discovered work continues as idea notes that link this ticket.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S12 Reproducible runtime and real containment control]]", "[[S13 Candidate artifact contract and quarantine]]"]
related: ["[[Establish a feasible isolated Sandcastle handoff]]", "[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S15, findings A01/A13 and its S12/S13 prerequisites."
  - "VERIFIED: job-spec approval is PR 17 and the parents landed: S12 as PRs 34 (c0f2e48) and 40 (c11dfa7), S13 as PR 37 (fdd46ff); gh pr view on 2026-10-18 reported each MERGED, and both parent tickets are status done. This branch starts from origin/main a6b69c5."
  - "OWNER DECISION: 2026-10-18, relayed by the coordinator from a question dialog. Receipt authority: \"Host-only store (Recommended)\". Check source: \"Base commit's checks (Recommended)\". Reviewer: \"Fake reviewer only (Recommended)\"."
  - "VERIFIED: at red commit 5fcbe89 (tests, the verifier fixture and typed stubs, needed because the pre-commit hook runs lint and typecheck) node --test on the six affected test files failed 47 of 99."
  - "VERIFIED: at 2cd1eef the same six files pass 99 of 99, npm test before that commit failed 1 of 1145 (the fixture-env rule: the smoke test's tar call lacked cleanGitEnv), fixed in the same commit; coverage from that run: verifier-driver.ts 98.11% lines and 86.96% branches, verification-receipt.ts 99.22% and 86.01%, container-runtime.ts 91.15% and 100%, verify-candidate.ts 97.00% and 67.27%, verifier-driver-smoke.ts 100% and 73.53%."
  - "VERIFIED: at e303583 npm run check exited 0: 1145 of 1145 tests with all files at 98.99% lines and 91.05% branches, 60 evals tests, and every lint, wiki, skills, governance, rules, compliance, changelog and memory guard."
  - "VERIFIED: a mutation run at 2cd1eef planted 16 mutations and all 16 failed a test: skipping the digest check, dropping the run binding, dropping the verdict and response consistency check, reading checks from the candidate, never flagging machinery, reuse ignoring the candidate SHA, an unchecked store mode, skipping container inspection, not blocking a missing reviewer, the smoke ignoring the verifier control, an outcome ignoring the verdict, reusing failed receipts, allowing a forbidden host path, an unchecked store placement, the CLI running without a reviewer and the control accepting a passing no-op. The first run had two survivors: one was a wrong mutant (it left half the condition in place), the other passed because a later check also refused; the test now names the exact refusal."
  - "VERIFIED: the refusal matrix runs through the real driver with a fake runtime and fake reviewer responses: a forged receipt under a digest the store does not hold (this did not prove that only the store counts; see the review round below), tampered bytes, wrong repository, task, run, base or candidate, changed check definitions, missing review, a mutated verdict or response even after re-hashing, a failing step or failed install claimed passed, a hidden human review flag, unknown keys, wrong issuer or version, a symlinked, group-writable or oversized receipt, a store inside the source or artifacts, a malformed review response, a builder claiming success with a failing check, and a no-op test script (the base command still ran and failed, and package.json was flagged)."
  - "VERIFIED: isolation observations from the tests: the runtime receives only the candidate's tracked files (no .git, manifest, bundle or recovery data), the verifier container's create arguments pass S12's launchRefusals with no mount or environment, an inspection showing a mount is refused before start, a Docker argument naming the store is refused before create, and the container is removed on every path."
  - "VERIFIED: the in-container shell steps ran on this host against the two smoke fixtures (a local simulation, not containment): prepare exited 0, npm ci exited 0, and node check/feature.mjs exited 0 for the good candidate and 1 for the no-op rewrite."
  - "VERIFIED: real-container proof at 54f7215: CI run 39167563559 (gh run view --log, read 2026-10-18), step Prove the sandbox boundary, printed 'verifier-control: the driver issued a receipt that validates from the host store for the good candidate and failed the no-op rewrite on the base commit's check.' and then 'containment-smoke: contained.' with the guest on Ubuntu 26.04, Node v24.22.0 and Python 3.14.4. This machine has no Docker, so that path has not run locally."
  - "UNKNOWN: only the fixture's single check (node check/feature.mjs) has run in a verifier container. The repository's real check:base links and the Python safe-path guard have not run in the guest; the guard was shown only by the local step-script test."
  - "UNKNOWN: whether every leaf of check:base (wiki:compliance, governance:check and the rest) passes inside the verifier container for a real repository candidate; only the fixture's single check runs in CI, and the real command stays blocked on the reviewer."
  - "VERIFIED: npm run pr for bdea98a refused once with refs changed before the coordinator restart, one attempt was killed by that restart (exit 137), and two more refused with refs changed; other agents' branches (s22, s09, s23) moved during each check."
  - "INFERRED: per the coordinator, it reran npm run pr from this worktree: attempts 1 and 2 refused with refs changed and attempt 3 pushed bdea98a as PR 49."
  - "INFERRED: per the coordinator's relay of the independent verifier's report on bdea98a, not reproduced here except where a VERIFIED line says so: FAIL. HIGH H1, python3 -m unittest puts the working directory first on sys.path, so a candidate unittest package with __main__.py exiting 0 turned a failing eval into exit 0, and machineryPaths missed it. MEDIUM M1, validateReceipt trusted any directory its caller passed, so a store copied under the trusted source or a forged receipt in a fresh directory validated. MEDIUM M2, git add --all in the verifier checkout dropped force-tracked files the candidate's .gitignore covers. LOWs: reuse and parseReview limits untested (mutants survived), DELEGATES missed node --run, bun, $npm_execpath and quote-split names, the checks were a constant rather than the base's check:base, repeated receipt keys validated, and the test-support import in the smoke control was unexplained."
  - "VERIFIED: origin/main (PRs 44 to 47, up to 024d415) merged into the branch at ea9d398 with no conflicts."
  - "VERIFIED: H1 reproduced on this host with Python 3.15.0: in a directory holding unittest/__init__.py, unittest/__main__.py (sys.exit(0)) and a failing test, python3 -m unittest discover exited 0. At red commits 2faa4fd and b692455 the six test files failed 8 of 105, among them the guarded step (still exit 0), the shadowing flag, the store copied under the source, the repeated key, the force-tracked file, the sneaky delegations and the check:base derivation. The reuse and review-limit cases already passed; they pin guards whose mutations had survived."
  - "VERIFIED: at 0a50220 the six files pass 105 of 105; the guarded step exits non-zero with the real failure, and the prepared checkout tracks wiki/secret.md under a .gitignore that names it. The repository's evals:test passes 73 of 73 under PYTHONSAFEPATH=1 and PYTHONNOUSERSITE=1."
  - "VERIFIED: a mutation run at 0a50220 planted 17 mutations, one per fix: removing PYTHONSAFEPATH, keeping PYTHONPATH, dropping the shadowing patterns, new top-level directories or top-level code files, skipping store placement in validation, git add without --force, reuse ignoring check definitions, runner digest, repository and task or base, allowing extra review keys, removing the 64 KiB cap, not stripping quotes, allowing node --run, not checking check:base links and accepting a non-canonical receipt. 16 failed a test at once; the top-level code file mutant survived until loader.mjs and tool.ini joined the shadowing case, then failed it."
  - "VERIFIED: at 4d82bb9 npm run check exited 0: 1204 of 1204 tests with all files at 99.05% lines and 91.30% branches, 73 evals tests, and every guard. The run before it at 600810a failed 1 of 1204 (the fixture-env rule wanted cleanGitEnv spread inline in the new step tests), fixed in 4d82bb9."
  - "VERIFIED: npm run pr this round: attempt 1 pushed 54f7215 and refused because GitHub still reported PR 49's head as bdea98a; attempt 2 reported PR 49 open at 54f7215. CI at 54f7215: check and guards passed."
  - "INFERRED: per the coordinator's relay of the independent verifier's second report, not reproduced here except where a VERIFIED line says so: 54f7215 rated PASS with every earlier finding closed. Two LOWs: mutant L3d (baseDefinitions running only the first check:base link) survived because the fixture's check:base has one link, and the real-container UNKNOWN line under-claimed after CI ran."
  - "VERIFIED: at 72c0ab7 a driver test uses a base whose check:base is npm run a && npm test with only test failing: both links run, the receipt is failed with exits a 0 and test 1, and the consumer's trustedChecksDigest covers both. Planting L3d (checkDefinitions on chosen.names.slice(0, 1)) fails that test (22 of 23 pass); the file was restored and passes 23 of 23."
  - "INFERRED: the store location ($XDG_STATE_HOME or ~/.local/state, then zeemrepo/verification-receipts), the machinery list, the 30-minute and 16 MiB step limits and the 64 KiB review response cap are this agent's proposals for the owner to confirm in the PR. S13's limits are unchanged."
  - "VERIFIED: on 2026-10-18 gh pr view 49 reported MERGED by the code owner's account as caa99e3, and git merge-tree --write-tree caa99e3^ 1654e5c gave caa99e3's own tree, so main received exactly the reviewed head 1654e5c (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, 1654e5c rated PASS in the third round: the L3d mutant now fails the multi-link check:base test and the ticket's labels are accurate. Info items it did not count as findings, each now an idea note: shell substitution such as $(printf np)m passes the package-manager check (needs a hostile base), a node_modules under a non-code directory is not flagged, and a forged receipt in a directory the caller chooses validates (documented as a consumer requirement)."
  - "VERIFIED: main CI run 39169338254 (check, push) at caa99e3 concluded success, and its Prove the sandbox boundary step printed the verifier-control receipt line and containment-smoke: contained. (checked by Claude Code, Opus 5.5)"
---

## Goal

Make independent verification evidence authoritative only when trusted supervision produced it for the exact unchanged candidate and inputs.

## Inputs

- Plan S15 and target evidence contract, S12's proven runtime and S13's candidate envelope.
- Read existing finder/verifier briefs, shared state helpers and the approved partial-failure policy.
- S14 is not a prerequisite: use valid fixture candidates when its launcher is not yet available.

## Approach

1. Reconstruct the candidate in a fresh verification environment without implementer session/state or writable volumes.
2. Run trusted check definitions and an independent reviewer, treating check-machinery changes as explicit review inputs.
3. Have trusted supervision issue/store the receipt outside builder authority, binding repository, task/base/candidate identities, runner/reviewer/image versions, commands, outcomes and log digests.
4. Validate receipt origin and context, not merely plausible JSON or a matching SHA string.

## Acceptance criteria

- [x] A passing unchanged candidate can receive a receipt from the real trusted driver; builder-written success cannot.
- [x] Forged or tampered receipts, wrong run/task/base/candidate, missing review and changed check state refuse.
- [x] An integration producing a new SHA needs new verification; authorized reuse is limited to unchanged inputs and trusted stored evidence.
- [x] Reviewer mutation invalidates its verdict. A candidate rewriting its check command to a no-op is not accepted solely because that command exits zero.
- [x] Tests establish isolation and receipt ownership; an absent reviewer/runtime reports blocked proof rather than success.

## Out of scope

Public-command cutover, live publication, payment authorization and a claim that model judgment is infallible.

## Allowed files

- New `scripts/sandcastle/verify-candidate*.ts`, `scripts/sandcastle/verification-receipt*.ts`, `scripts/sandcastle/verifier-driver*.ts` and shared `scripts/sandcastle/container-runtime*.ts`, with sibling tests.
- `scripts/sandcastle/artifact*.ts`, `scripts/sandcastle/quarantine*.ts`, `scripts/sandcastle/containment-smoke*.ts` only for tested integration; `scripts/test-support/verifier-*.ts` support files.
- `.sandcastle/Dockerfile` only for packaging the trusted verifier/profile while retaining S12's containment controls.
- `package.json` for a used verification command, `wiki/runbooks/Verify a repository change.md`, `wiki/runbooks/Run Sandcastle on GitHub issues.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no generic trust/skip flag, acceptance of guest-chosen host paths, credential-store access or publishing of candidates.

## Human checkpoints

Verify approval and parent landings. Stop for owner review if the proposed receipt can be forged by the builder or a scope change is needed to establish authority. Paid/live reviewer trials require explicit authorization.

## Secrets needed

None for tests. Keep any implementation-specific authority material outside guest access and out of source/evidence; do not invent or commit a production secret.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke`; `npm run check`.
- Positive: trusted verification of a fixed fixture candidate and authorized unchanged-input reuse.
- Broken: forged matching-SHA JSON, replay under changed inputs, candidate mutation, missing review, no-op check machinery and shared implementer state. Exercise receipt issuance and validation through the actual driver, with fake external model responses.

## Rollback and recovery

Preserve candidate bundles and private diagnostics. Invalidate unusable receipts instead of loosening validation; never publish on a missing proof. Repair/revert through a PR.

## Evidence

Record the trusted issuer path, bound identities, command results, isolation observations, refusal matrix and independent review. Keep runtime/model evidence limits explicit.

## Receipt contract

The contract S16 and S17 validate and reuse. The code is `scripts/sandcastle/verification-receipt.ts`;
the operator view is "Verification receipts" in [[Run Sandcastle on GitHub issues]].

- **Issuer.** Only `verifyCandidate` in `scripts/sandcastle/verifier-driver.ts`, on the host, writes
  receipts. It runs a passed or failed verification to completion before writing; blocked and
  refused runs write nothing.
- **Store and origin.** `$XDG_STATE_HOME/zeemrepo/verification-receipts`, or
  `~/.local/state/zeemrepo/verification-receipts` (`defaultStore()`): a mode 0700 directory owned
  by the host user, never mounted or named in a Docker argument. The driver refuses to write to,
  and `validateReceipt` refuses to read from, a store inside or containing the trusted source or
  the artifact directory. Each file is `<sha256 of its bytes>.json`, mode 0600, byte-identical to
  the driver's `JSON.stringify` output. A consumer calls
  `validateReceipt(defaultStore(), digest, expected, { source, artifacts })` with the store from
  host configuration, never a path from an artifact or guest; validation cannot tell the
  configured store from another private directory of the host user. No key exists; write access
  to the store, or the choice of the directory a consumer reads, as the host user is the
  authority, and its limit.
- **Bound identities.** `repository`, `task`, `run`, `base`, `candidate.ref` and `candidate.sha`,
  `artifact.manifestSha256` and `artifact.bundleSha256`, `runner.sha256` (digest of the driver's
  source files), `runner.runtime` and `runner.image`, `checks.definitionsSha256` with `install` and
  each `results` entry (`name`, `command`, `exit`, `outputSha256`, `outputBytes`),
  `checkMachinery.changed` and `humanReviewRequired`, `review.reviewer` (`name`, `model`,
  `version`), `review.inputSha256`, the raw `review.response`, `verdict` and `findings`,
  `outcome` and `reusedFrom`.
- **Validation.** `validateReceipt` refuses unless the store is placed as above, the bytes hash
  to the digest and are canonical (no repeated key), every key is known and well formed, the outcome follows from the exits and the verdict, the verdict and
  findings equal the parsed response, the human review flag matches the machinery list, the
  expectation matches (`repository`, `task`, `run`, `base`, `candidate`, and `checksSha256` from
  `trustedChecksDigest(source, base)` on the consumer's own trusted repository, which reads the
  base's own `check:base` links), and the outcome
  is `passed`. It returns `humanReview`; a non-empty list means the receipt alone does not
  authorise publication.
- **Staleness and reuse.** A receipt covers one run of one candidate SHA on one base. A new SHA
  needs a new verification. A new run with the same repository, task, base, candidate SHA, check
  definitions, runner digest, image and reviewer identity gets a new receipt whose `reusedFrom`
  names the stored passing receipt; nothing reruns. Failed receipts are never reused.

## Discovered work

- The real `npm run sandbox:verify` cannot issue a receipt until the owner authorises a live
  reviewer (a paid model call). A pending owner decision.
- Only the fixture's one check runs in a real container (CI). Whether every leaf of `check:base`
  passes inside the verifier container for a real repository candidate is unproven; the first
  live run should check it.
- All of a candidate's checks share one container, so code a candidate runs during `npm ci` or an
  early check could affect a later check. The machinery flag covers the files such code lives in
  for this repository, but a container per check would remove the question.
- The store has no index or pruning; `storedReceipts` reads every receipt on each reuse lookup.
- `scripts/sandcastle/verifier-driver-smoke.ts` is a production module that imports the fake
  reviewer and fixtures from `scripts/test-support/verifier-fixture.ts`. That is deliberate: it is
  the CI control, it must build fixture candidates in real containers, and the owner's decision
  allows only a fake reviewer. A later live reviewer should not reuse this path.
- The check list now comes from the base's `check:base`; a base whose `check:base` link is not
  `npm run <script>` or `npm test` is refused rather than verified, so changing that chain's shape
  on main needs the driver updated in the same PR.

## Wiki and doc updates

Document what a receipt establishes, where its authority originates and when it becomes stale. Add the actual verification command to the canonical recipes.
