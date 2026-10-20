---
type: ticket
title: S06 Exact PR destination and head identity
summary: Bind the pushed commit and reused or created PR to the intended repository, main base, source branch and head SHA.
tags: [area/git, area/github, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: claude-code
status: done
owner: agent
priority: P1
next_action: None. The follow-up branch landed as PR 42; the bounded wait for GitHub's head lag continues as an idea note.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S03 Fresh pinned main revisions]]", "[[S05 Checked-commit publication invariant]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S06, finding A05 and its S03/S05 prerequisites."
  - "VERIFIED: job-spec approval is PR 17, MERGED by the owner's account (gh pr view 17, 2026-10-18)."
  - "VERIFIED: parents S03 (PR 25) and S05 (PR 32) are MERGED by the owner and their tickets are status done on main; this branch starts from origin/main c0f2e48."
  - "VERIFIED: at test commit ebc8973, node --test scripts/git/pr-ready.test.ts against the base pr-ready.ts failed 50 of 97 entries (47 passed). The base code reported any OPEN view of the branch name as the PR, scoped no gh call to a repository, pushed when pushurl or pushInsteadOf named another repository, and accepted non-GitHub origins."
  - "VERIFIED: at fix commit 2f7d792, pr-ready.test.ts passes 97 of 97 and node --test scripts/sandcastle/afk*.test.ts passes 111 of 111; lint and typecheck exit 0 (pre-commit hook)."
  - "VERIFIED: tested matrix, all with a faked gh and origin's fetches and pushes routed to a local bare repository. An exact open PR is reused with no create. With none open, the PR is created with --repo github.com/o/r --base main --head feat/x --fill and read back by number. Each of base, head SHA, URL repository, state MERGED or CLOSED, source branch, source repository name and source owner, mismatched alone, refuses for both a listed and a created PR, with no create, edit or merge and no success line. A fork's same-named PR is ignored and a new one created; two open PRs refuse. Failed, non-JSON, non-list and field-missing answers and a create that prints no URL throw with the already-pushed note. Local-path, file, http, extra-path and ext origins, and a pushurl, pushInsteadOf or other-host push destination, refuse before any push or gh call. GH_REPO and GH_HOST set to decoys leave every gh call scoped to origin's host or repository. Credentials in origin's URL are never printed."
  - "VERIFIED: 18 planted mutations of pr-ready.ts, each run in its own copy, were all caught: dropping each of the six identity checks, never or always treating a PR as a fork, not comparing fetch and push, unscoping pr list, pr create or api user, allowing two open PRs, dropping the already-pushed note from errors or from refusals, reporting GitHub's URL instead of the printed one, accepting plain http, and not checking the list shape."
  - "VERIFIED: git remote get-url, with and without --push, expands insteadOf (probe in a scratch repository), so the destination is what git pushes to. gh help environment (gh 2.102.0) says GH_REPO applies to commands that otherwise operate on a local repository, and gh pr view 32 --json showed the field shapes the parser reads."
  - "VERIFIED: the red run at ebc8973 made real outbound attempts. With the old pr-ready.ts, the pushurl, pushInsteadOf and other-host cases ran git push toward github.com (evil/r) and ghe.example.invalid, which failed with exit 128; nothing was published. The first-round tests used real hosts, the owner's real repository slug in one case, and no network fence."
  - "INFERRED: from the independent review of ce306d8 (Claude Code subagent, Opus 5.5 as the coordinator reports, separate context), not reproduced here: those attempts went over both HTTPS and SSH (git-receive-pack 'evil/r.git' with the user's SSH key), and a verifier mutation building git@HOST:OWNER/NAME.git made 41 SSH push attempts, including to Zimfra/software_testing.git."
  - "VERIFIED: the first round's npm run pr opened PR 38 through the new create path, which read the PR back and accepted it; that was the only live use of the identity checks."
  - "VERIFIED: review round. The independent verifier rated ce306d8 FAIL: HIGH, tests could reach the network; MEDIUM, git remote get-url without --all missed a second pushurl that git push still pushed to; MEDIUM, afk re-resolved the repository and PR with unscoped gh after pr-ready; LOW, surviving mutations V3, V9, V10 and V11, a deleted fork's null source blocking every rerun, tracking config writes without the already-pushed note, the stale-head sentence stated as fact, and gh precedence left INFERRED."
  - "VERIFIED: at test commit 703a2fe the new tests failed against the ce306d8 code, run only with the network fence in place: pr-ready.test.ts 9 of 110 (second pushurl, second url, deleted fork, config-write note, cross-repository naming in listed and created PRs), and the afk tests 101 of 117 (afk's gh calls named no repository or host)."
  - "VERIFIED: at fix commit ccbb178, node --test on pr-ready.test.ts, afk.test.ts and afk-guard.test.ts passes 227 of 227. Run under strace -f -e trace=connect,sendto,sendmsg, the whole run made no AF_INET or AF_INET6 call (only 2 AF_NETLINK sendto, no connect to any address)."
  - "VERIFIED: the runners' git carries -c protocol.allow=never -c protocol.file.allow=always, and a test shows https, http, scp-style SSH, ssh://, git:// and ext:: pushes refused with transport not allowed while a local path still pushes. Test hosts are .invalid and the owner's slug is gone from pr-ready.test.ts; afk tests keep Zimfra/software_testing only in faked gh answers, because afk names that repository."
  - "VERIFIED: 10 review mutations, each in its own copy, were all caught: the verifier's SSH mutation (push to git@HOST:OWNER/NAME.git) failed 56 tests with 0 connect calls under strace; V3 head by 7-character prefix (4), V9 base containing main (4), V10 branch case-insensitive (4), V11 isCrossRepository dropped (4), --all reverted (3), deleted fork no longer filtered (1), afk scope without host (102), afk commenting a refused PR's URL (9), and afk looking up HEAD instead of origin's tip (2)."
  - "VERIFIED: offline gh precedence probe (gh 2.102.0, empty GH_CONFIG_DIR, fake tokens, HTTPS_PROXY to closed 127.0.0.1:9, GH_DEBUG=api, GH_REPO=decoy-owner/decoy-repo, GH_HOST=decoy.example.invalid): api user --hostname, repo view HOST/OWNER/REPO, pr list --repo, pr create --repo and pr view --repo each requested only https://target.example.invalid/api/..., and auth status --hostname reported only target.example.invalid; the decoy never appeared."
  - "VERIFIED: afk.ts now names github.com/Zimfra/software_testing on gh repo view, gh pr list and gh issue comment, and comments only with the URL from pr-ready's exactOpenPullRequest for the landed HEAD (or origin's branch tip for earlier work). This needed scripts/test-support/afk-harness.ts, the afk tests' shared harness."
  - "OWNER DECISION: on 2026-10-18 the owner said \"yes i accept the afk-harness change and the limits\" (relayed to this agent by the coordinator; the agent did not see the message directly). Scope: S06's edit to scripts/test-support/afk-harness.ts, which lies outside this job's Allowed files and which the afk scoping and the wrong-origin test needed. The independent verifier of 5ac895f reported that it changes no other test's behaviour."
  - "VERIFIED: the first live reuse, npm run pr at 83e1551 on this branch, passed npm run check (975 tests) and pushed. It then refused: PR 38's head is ce306d8, not the checked commit 83e1551, followed by the already-pushed note. Less than a minute later, gh pr view 38 and git ls-remote both showed 83e1551. GitHub had lagged behind the push, and the docs now say so. Until a bounded wait is added, a push to a branch with an open PR may need one rerun."
  - "UNKNOWN: how long GitHub's head lag lasts, and how often it happens, is not measured. The mismatch cases were not tried against live GitHub."
  - "VERIFIED: a second independent review (Claude Code subagent, Opus 5.5 as the coordinator reports, separate context) rated 5ac895f PASS. It raised one MEDIUM: afk's wrong-repository refusal asked gh about the repository afk itself names, so it could never fire, and a checkout with another origin ran the paid loop and pushed before failing. It also raised the untracked head lag (MEDIUM), the surviving mutant OWN3 (fork judged by owner login only), the runbook saying a stale head 'means' lag, and the harness scope."
  - "VERIFIED: at test commit b929f1b, node --test on afk.test.ts and afk-guard.test.ts failed 5 of 121 against the 5ac895f afk.ts: four wrong-origin cases (another repository, another host, a push URL for another repository, a non-GitHub origin) plus their parent. The afk fixture's origin now names github.com/Zimfra/software_testing; its own config sets protocol.allow=never with only the file transport allowed, and its fetches and pushes are routed to a bare remote."
  - "VERIFIED: at fix commit 750433e, afk reads origin's destination with pr-ready's exported destination (--all fetch and push URLs) and refuses before the loop unless it is github.com/Zimfra/software_testing. node --test on pr-ready.test.ts, afk.test.ts and afk-guard.test.ts passes 232 of 232."
  - "VERIFIED: mutants run one at a time, each limited to its killing test: restoring the vacuous check (the origin refusal never pushed) failed 5; OWN3 (fork judged by owner login only) failed 1, the new cross-repository PR from o/copy."
  - "VERIFIED: the owner merged PR 38 at 5ac895f as 5385769 (gh pr view 38: MERGED by the code owner) while this round was in progress, so this round's commits were cherry-picked unchanged onto fix/s06-afk-origin-check from origin/main 5385769; the three suites pass 232 of 232 there."
  - "VERIFIED: a third independent review (Opus 5.5 as the coordinator reports) rated PR 42 at e6cd939 PASS. It found one MEDIUM: the Sandcastle runbook still described the removed gh-answer refusal. It found three LOWs: the unreadable-origin branch was untested (mutant O2, readDestination's catch returning the served repository, survived); two docs said the head lag was observed once; and the review evidence did not name the model."
  - "OWNER DECISION: on 2026-10-18 the owner was asked 'may the agent also update the Sandcastle runbook (outside S06's allowed files) so it describes afk's new origin check instead of the removed one?' and chose 'Yes, update it here (Recommended)' (relayed by the coordinator). Scope: wiki/runbooks/Run Sandcastle on GitHub issues.md, step 1 and its verification paragraph."
  - "VERIFIED: test commit c786b5d adds a wrong-origin case with no origin remote, which must refuse before the loop with origin's URLs cannot be read. It passes on the e6cd939 code. Mutant O2, run alone on that test, failed 2 (the case and its parent)."
  - "VERIFIED: on 2026-10-18 gh pr view 38 reported MERGED by the code owner's account as 5385769, and git merge-tree --write-tree 5385769^ 5ac895f gave 5385769's own tree, so main received exactly the reviewed head 5ac895f."
  - "VERIFIED: on 2026-10-18 gh pr view 42 reported MERGED by the code owner's account as 801eb53, and git merge-tree --write-tree 801eb53^ f57b955 gave 801eb53's own tree, so main received exactly the reviewed head f57b955."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, f57b955 rated PASS: the runbook's step 1 matches afk.ts, mutant O2 fails 2 tests, the afk suites pass 122 of 122 with no connect call under strace, and CI passes at that head. Its one LOW was that the second head-lag observation had no labelled evidence; the next two lines record it."
  - "INFERRED: the S06 agent's report on 2026-10-18 says the second live reuse, npm run pr at 5ac895f, pushed and then refused because GitHub still reported the previous head of PR 38, and that gh pr view 38 showed 5ac895f shortly afterwards. The PR 38 body recorded it; the coordinator did not watch the run."
  - "INFERRED: the S06 agent's report on 2026-10-18 says a third live reuse, npm run pr at f57b955 on PR 42, pushed and then refused because GitHub still reported e6cd939, and that gh pr view 42 showed f57b955 a moment later. Three of three live reuses lagged."
  - "VERIFIED: on 2026-10-18 the main CI run 39152154817 at 801eb53 concluded success."
---

## Goal

Make a successful PR handoff identify the same repository, branch and checked commit that was pushed.

## Inputs

- Plan S06, audit A05 and the landed readiness/publication state contract.
- Inspect every `gh` and Git push call in `scripts/git/pr-ready.ts` and existing response fixtures.

## Approach

1. Establish one intended push/PR repository identity from trusted checkout configuration.
2. Scope GitHub calls explicitly and request/validate the existing PR's base and source identities and head SHA.
3. Reuse only the correct open PR; describe errors precisely without reporting an unrelated PR as success.

## Acceptance criteria

- [x] A correct existing PR is reused and the correct absent PR is created for the captured commit.
- [x] Wrong repository, non-main base, unexpected source repository/branch and stale head refuse a successful handoff; an unrelated existing PR is not silently retargeted.
- [x] `GH_REPO` or gh defaults cannot silently redirect the handoff away from the intended push destination.
- [x] Malformed/failed GitHub responses fail visibly; machine-account and code-owner checks remain enforced.
- [x] No mismatch case reports success for the wrong PR.

## Out of scope

New account authorization, fork creation, changing CODEOWNERS and bypassing approval requirements.

## Allowed files

- `scripts/git/pr-ready.ts`, `scripts/git/pr-ready.test.ts`; `scripts/sandcastle/afk.ts` and its tests only if a shared identity/result contract requires adjustment.
- `wiki/reference/Merge gate contract.md`, `wiki/runbooks/Land a change.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; especially `.github/CODEOWNERS`, branch rulesets and credential stores.

## Human checkpoints

Verify job approval and parent landings. A live publication trial needs explicit authorization and the machine account; offline controls are sufficient for the regression suite.

## Secrets needed

None for tests. Any authorized live trial uses an existing scoped credential without copying its value into files or evidence.

## Tests and evals

- `node --test scripts/git/pr-ready.test.ts "scripts/sandcastle/afk*.test.ts"`; `npm run check`.
- Positive: exact repository/main/source/head response and correct missing-PR creation.
- Broken: each identity field mismatched separately, closed/merged stale PR, hostile defaults, missing fields and failed calls. Verify arguments and returned outcome through the actual publication function.

## Rollback and recovery

If a push succeeded but PR creation failed, report that durable state and recover without force-pushing or opening duplicate PRs. Repair/revert code through the normal PR path.

## Evidence

Record the tested repository/base/source/SHA matrix, captured command arguments, outcomes and independent verdict; distinguish mocks from any live trial.

## Wiki and doc updates

Document the exact identity checks and post-push recovery boundary; update this ticket and changelog.

## Discovered work

- GitHub head lag after a push. The two live reuses on PR 38, at 83e1551 and 5ac895f, pushed and then refused: GitHub still reported the PR's previous head, and shortly afterwards it showed the pushed commit. The S06 agent reported the same at f57b955 on PR 42 (an INFERRED evidence line above). Every rerun repeats `npm run check`, which takes minutes and loads the machine. Next action: a bounded poll in `scripts/git/pr-ready.ts` that re-reads the PR a few times, briefly, and retries only when the head is the sole mismatch, while every other identity field stays strict. The test-first work belongs in its own ticket; the coordinator will record it as an idea note.
