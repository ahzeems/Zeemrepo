---
type: idea
title: Sandcastle runs unattended and lands by pull request
summary: Wrap the Sandcastle loop in npm run sandcastle:afk so an unattended run ends in a pull request the owner is asked to review and a comment on each issue, with nothing pushed to main.
tags: [area/agents, area/github, tool/claude-code]
created: 2026-10-13
updated: 2026-10-13
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews the branch, then runs npm run sandcastle:afk once on a throwaway issue with the machine account's gh login to exercise the real gh, Docker and review request, which no test here does.
related: ["[[Run Sandcastle on GitHub issues]]", "[[Sandcastle runs under the repository rules]]", "[[ADR-0025 Agents use a machine account and the owner approves]]"]
evidence:
  - "VERIFIED: scripts/sandcastle/afk.test.ts failed 13 of 13 against a stub main() that returned 0 and did nothing, and passes 13 of 13 against the implementation."
  - "VERIFIED: negative control, removing the filter that drops branches already on origin/main made the selection test fail (1 of 13); making a landing refusal exit 2 instead of 1 made the refusal test fail (1 of 13); restoring the file passed 13 of 13."
  - "VERIFIED: npm run lint and npm run typecheck exit 0 with the wrapper and its test, and node scripts/sandcastle/afk.ts --help prints the usage while an unknown argument exits 2."
  - "VERIFIED: spawnRunner(undefined, 0) from scripts/git/pr-ready.ts runs a command with no timeout and returns its output (sh -c 'echo ok' gave status 0, stdout ok), which is what the loop and the landing step use."
  - "VERIFIED: npm run check, run on commit ef254a0 before this evidence line was added, exited 0 (lint, typecheck, tests with coverage, evals:test, wiki:lint, skills:lint, governance:check, rules:check, wiki:compliance, changelog:guard and memory:guard)."
  - "VERIFIED: after independent review of the first head (finder and verifier, separate contexts; the verifier passed npm run check and three mutation controls), the finder's findings were fixed test first at 51a32b8: afk.test.ts went from 13 to 17 tests (5 of the 17 are new top-level cases) with 7 of its tests red before the change (an empty branch created during the run was announced, an earlier run's merge was announced, the URL was matched from the landing tool's text, the repository name was fixed, and gh was not checked before the loop) and all pass after it."
  - "VERIFIED: npm run check at 51a32b8 exited 0 with 610 of 610 tests passing (2026-10-13), after merging the integration branch at 993348c."
  - "VERIFIED: after the second independent review of 0bc08dd (a finder and a verifier in separate contexts; the verifier passed npm run check and four mutation controls on named tests), the findings were fixed test first at e1fd25a: afk.test.ts has 24 tests, with 7 failing entries before the change (the announce test for its wording, the earlier-run test, the refusals suite with its new gh case, a branch switch during the loop, a HEAD that moved with nothing announceable, and a leading-zero branch), and the failing git status and failing second fetch cases pin behaviour that already threw."
  - "VERIFIED: npm run check at e1fd25a exited 0 with 619 of 619 tests passing (2026-10-13), after merging the integration branch at c276e10."
  - "UNKNOWN: whether commits reach the host branch under a real Sandcastle run only through reflog commit entries; the wrapper exits 2 when HEAD moves with nothing announceable, so a different path fails loudly instead of reporting success."
  - "UNKNOWN: an owner decision on automatic issue comments; the brief asked for the owner to be told when work is done and no dated quote of that is recorded here."
  - "VERIFIED: after the review of d207c67 (a finder and a verifier in separate contexts; the verifier passed npm run check at 619 of 619 and six mutation controls on named tests), the findings were fixed test first at 4d3a72a: afk.test.ts now has 31 tests; the new cases (a landing failure that says a push may have happened, a failing loop that says issues may be merged, earlier work unpushed and pushed, an unrecognised branch exiting 2 after landing the rest, a timed-out gh comment, a different repository refused) were red before the change, with 8 failing entries in that run, and a branchWork test pins the empty, worked and unrecognised classes in already-done.test.ts."
  - "VERIFIED: npm run check at 4d3a72a exited 0 with 632 of 632 tests passing (2026-10-13); the first run failed only the known flaky evals test test_netproxy (a 503 not seen from a socket), and the rerun passed."
  - "VERIFIED: after the review of 10782ea (a finder and a verifier in separate contexts; the verifier passed npm run check at 632 of 632 and seven mutation controls on named tests), the finder's HIGH finding (an empty issue branch from an earlier run made later empty runs exit 2) and its MEDIUM findings were fixed test first at e21c7f7: the empty-branch case, the pushed-earlier-work case after a later local commit, the dirty tree and mid-merge cases and the unresolvable-gh case failed before the change, and the test that ties the prompts' -R repository to PROMPT_REPO passes and pins them; afk.test.ts has 38 tests."
  - "VERIFIED: npm run check at e21c7f7 exited 0 with 640 of 640 tests passing (2026-10-13), after merging the integration branch at 138a816."
  - "VERIFIED: after the review of 8239586 (a finder and a verifier in separate contexts; the verifier passed seven mutation controls on named tests), the finder's HIGH finding (an empty leftover branch that the loop then worked and merged was treated as earlier work, so nothing landed) and its MEDIUM finding (pushed work with no pull request exited 0) were fixed test first at 89ba1d7: both new cases failed before the change, the clean mid-merge case and the prompt-repository tie already passed and stay as guards, afk.test.ts has 41 tests, and npm run check at 89ba1d7 exited 0 with 646 of 646 tests passing (2026-10-13)."
  - "VERIFIED: npm run check at 8239586 in the AFK worktree exited 0 with 640 of 640 tests passing (author's own rerun, 2026-10-13); the verifier of that head reported 602 where it ran, which equals the integration branch's count and is UNKNOWN in cause, so it is not used here."
  - "UNKNOWN: whether a real Sandcastle run writes commit entries into the host branch reflog; the wrapper exits 2 instead of announcing when it does not."
  - "VERIFIED: after the review of 4a374a7 (a finder and a verifier in separate contexts; the verifier passed seven mutation controls on named tests and reproduced 646 of 646), the findings were fixed test first at 94f16e6: earlier work is now judged by branch tips (an unrecognised branch whose reflog expired no longer exits 2 on every run, and an earlier branch the run extends and merges again is announced), a worked branch the run left unmerged exits 2, and only an OPEN pull request counts; the new cases failed before the change (13 of 47 entries, most because the gh view output format changed with the fix) and afk.test.ts now has 47 test entries, and npm run check at 94f16e6 exited 0 with 655 of 655 tests passing (2026-10-13)."
  - "UNKNOWN: a comment that failed after the pull request opened is not visible to a rerun, so a rerun exits 0 when earlier work is pushed and has an open pull request; the failed comment is never retried."
  - "VERIFIED: after the review of 9a88b5a (a finder and a verifier in separate contexts; the verifier reproduced 655 of 655 and passed nine mutation controls), the finder's MEDIUM finding that agents can edit what the landing step runs was fixed test first at 19452c8: a loop that changes scripts/git/pr-ready.ts, a .claude settings file, a .githooks file or package.json is not landed (4 red subtests before the change), a deleted issue branch exits 2 (1 red), and the stranded-plus-landing and origin/main-filter cases passed already and stay as guards; npm run check at 17ecc43, which merges integration a94d14d, exited 0 with 667 of 667 tests passing and afk.test.ts has 56 entries (2026-10-13)."
  - "UNKNOWN: patch equivalence is not checked: a branch the loop rebased onto HEAD is classed unrecognised and, when its tip is not held by HEAD, exits 2 as stranded even if HEAD holds the same patches; the prompts forbid rebasing."
  - "VERIFIED: after the review of 13eb37a (a finder and a verifier in separate contexts; the verifier reproduced 667 of 667 and passed eleven mutation controls on named tests), the finder's two HIGH findings were fixed test first at 770dcef: the guard was a denylist that missed code the landing check executes (scripts/lib, config, eslint.config.ts, .npmrc and others) and compared against the run's starting HEAD, so a rerun landed an edit left by a refused run; it now compares with origin/main, uses -z --no-renames, covers the executed paths and takes an owner opt-in; 21 entries were red before the change, the documentation-lands cases passed already, afk.test.ts has 75 entries, and npm run check at 770dcef exited 0 with 689 of 689 tests passing (2026-10-13)."
  - "UNKNOWN: the guard is a path list, not a proof; code that npm run check executes from outside the listed paths (a gitignored file, node_modules) is not seen by a tracked diff."
  - "VERIFIED: after the review of d5023c9 (a finder and a verifier in separate contexts; the verifier reproduced 689 of 689 and passed fourteen mutation controls), the finder's two HIGH findings and its design recommendation were applied test first at e665554: the guard is now an allowlist of Markdown documentation (a root json.py, a nested eslint config and an upper-case Scripts/ were all unguarded under the denylist), runs before the loop as well as after it, exits 1 as a refusal, comments on each announced issue, and a changed local git config exits 2; 33 entries were red before the change, afk.test.ts has 50 and afk-guard.test.ts 40 entries, and npm run check at e665554 exited 0 with 706 of 706 tests passing (2026-10-13)."
  - "UNKNOWN: the guard cannot see node_modules, .git/hooks or other ignored files; a tracked diff and the local git config comparison do not cover them, and running npm run check inside the sandbox, which is not built, would."
  - "VERIFIED: after the review of e670558 (a finder and a verifier in separate contexts; the verifier reproduced 706 of 706 and passed seventeen mutation controls, with the base-choice control d surviving alone because the pre-loop guard makes the two comparisons equivalent), the finder's four MEDIUM findings and the other items were fixed test first at 3dfca0e: a fetch before the guard, a code refusal that coincides with stranded work or an unposted notice exits 2, the config comparison is key-aware, the code refusal is reported with the others and an unrelated history is a named refusal; 6 of 46 entries in afk-guard.test.ts were red before the change, the branch-tracking-key case passed already, afk.test.ts has 50, afk-guard.test.ts 46 and already-done.test.ts 32 entries, and npm run check at 3dfca0e exited 0 with 715 of 715 tests passing (2026-10-13)."
  - "UNKNOWN: whether the in-sandbox agent can write the mounted .git/config; if it can, a user.name or user.email written there makes the config comparison exit 2 and leaves the work unlanded."
  - "VERIFIED: after the review of 48242b4 (a finder in a separate context found no CRITICAL or HIGH finding; the verifiers of that head were lost when the session ended and were not repeated for it), the finder's MEDIUM findings were fixed test first at 053de67: the post-loop fetch test counted a shifted fetch, a fetch that fails after the loop now says the loop already ran, an unreachable origin is reported with the other refusals, the duplicate pre-loop fetch is gone and only merge-base exit 1 means no common history; 4 of 52 entries in afk.test.ts were red before the change, afk.test.ts has 52, afk-guard.test.ts 46 and already-done.test.ts 33 entries, and npm run check at 053de67 exited 0 with 718 of 718 tests passing (2026-10-14)."
  - "VERIFIED: after the review of b392f43 (a finder in a separate context found no CRITICAL or HIGH finding; its verifier did not return before the session ended and was not repeated), the four follow-ups were applied test first at 838c8d6: a fetch that throws (a timeout) is a failed fetch both before and after the loop, the fetch uses an explicit destination and the remote ref is verified afterwards, the .git/hooks listing is compared before and after the loop and before the post-loop fetch, and USAGE states why the same fetch failure is exit 1 before the loop and exit 2 after it; 4 new entries were red before the change, a linked-worktree hooks case failed with the old path join and passes with resolve, and npm run check at 838c8d6 exited 0 with 723 of 723 tests passing (2026-10-14)."
  - "VERIFIED: after the review of b1347ae (a finder in a separate context found no push, merge or close path and one HIGH finding: git status ran before the hooks comparison and could run a planted post-index-change hook), the fixes were applied test first at 18660e3: config and hooks are compared before any git command that could run a hook, hooks are compared by SHA-256 content through lstat so a same-size same-mtime rewrite is seen, and a hooks directory that cannot be read is refused before the loop; 3 of 54 entries in afk-guard.test.ts were red before the change and npm run check at 18660e3 exited 0 with 752 of 752 tests passing (2026-10-14)."
  - "UNKNOWN: whether git status in a real checkout runs a post-index-change hook when only stat data changed; the test plants that hook and asserts the wrapper never runs it, and the order of the checks does not depend on the answer."
  - "UNKNOWN: entries in this record mean the test runner's count, which includes table-driven subtests: afk.test.ts 52, afk-guard.test.ts 51 and already-done.test.ts 33 at 838c8d6; a static count of test( calls is lower."
  - "UNKNOWN: the real gh (issue comment, the review request reaching the owner), Docker and the Sandcastle loop were not run; the tests replace them with scripted runners."
  - "UNKNOWN: whether gh pr view <branch> --json url --jq .url returns the URL for a branch pushed by pr-ready under a real gh; the test replaces gh with a scripted runner."
---

## Problem

`npm run sandcastle` merges issue branches into the checked-out branch and stops: nothing is
pushed, no pull request is opened and the owner is not told. Going away from the machine meant
coming back to push and open the pull request by hand.

## Desired outcome

One command runs the loop and ends with the work on a pull request the code owner is asked to
review and a comment on each issue naming it, with every merge still the owner's act on GitHub.

## Next step

Owner points, none decided here:

1. Early refusals now cover the branch, the tree, an unresolvable or different repository, a
   branch with code that differs from `origin/main` and a branch with no common history. The
   owner-login refusal stays in `scripts/git/pr-ready.ts`, which is a different branch's file.
2. Whether a notification channel beyond GitHub is wanted. None exists.
3. Which of the two comments an issue gets (the merge prompt's, and the wrapper's, which names
   the pull request) should stay. Both exist now.
4. An issue merged by an earlier run is named in a warning and not commented on again. When
   nothing new was merged and that earlier work is not on origin, the run exits 2 and says to
   land it with `npm run pr`; once it is pushed and has an open pull request the run exits 0 with a note, and without one it exits 2. Whether a rerun
   should instead land and announce it is the owner's call.
5. `.sandcastle/main.ts` ends with "All done." and exit 0 even when every agent failed, so a
   total failure looks like an empty queue to this wrapper.
6. Whether unattended landing may run agent-written code on this machine. Today only
   documentation lands unattended; anything else is refused unless you set
   `SANDCASTLE_AFK_LAND_CODE=1` in your own shell, because `npm run check` executes the
   repository's scripts, tests and configuration as you, outside the sandbox, with no person
   present. Almost every Sandcastle issue changes code, so by default this wrapper will stop at
   "merged locally, review and run `npm run pr`" and comment on the issue. Options: (a) keep
   documentation-only unattended landing as the default (current); (b) set the variable and
   accept it; (c) run `npm run check` inside the Docker sandbox, which is not built. Awaiting
   the owner.

## Observations

- `.sandcastle/main.ts` is untouched; the wrapper sits in front of it.
- The wrapper imports `spawnRunner` from `scripts/git/pr-ready.ts` rather than copying it, and
  uses a second runner with no timeout for the node steps because `npm run check` runs for minutes.
