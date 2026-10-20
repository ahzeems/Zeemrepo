---
type: idea
title: Sandcastle runs under the repository rules
summary: Track .sandcastle/ and contain it so npm run check stays green and the Sandcastle agents commit, test and comment under this repository's rules, ready to run unattended later.
tags: [area/agents, area/github, tool/claude-code]
created: 2026-10-13
updated: 2026-10-13
agent: claude-code
status: in-review
owner: human
priority: P2
next_action: Owner reviews and merges the pull request, then decides the open points under Next step.
related: ["[[Run Sandcastle on GitHub issues]]", "[[The privacy scan treats the sandbox user agent as a role name]]"]
evidence:
  - "VERIFIED: scripts/wiki/redaction.test.ts, rewritten test 'the role-name home agent is allowed, and every other home path is flagged for every login' failed before the change (actual: the home path finding, expected: none, for a path under the agent home) and 36 of 36 tests pass after it."
  - "VERIFIED: scripts/sandcastle/already-done.test.ts failed 2 of 5 (at that head; the file now has 9 tests) against a stub that returned every issue (a merged branch was kept; a missing directory did not throw) and passes 5 of 5 against the implementation, which also keeps a tag-only name, a diverged branch and a branch named --all."
  - "VERIFIED: scripts/sandcastle/plan-schema.test.ts failed 1 of 2 (at that head; the file now has 4 tests) against a stub that accepted anything and passes 2 of 2, naming the failing path for eight malformed plans."
  - "VERIFIED: adding a third argument to the pendingIssues call in .sandcastle/main.ts fails npm run typecheck with TS2554, so tsconfig.json really covers the file; restoring it passes."
  - "VERIFIED: node_modules/@ai-hero/sandcastle/package.json lists zod only under devDependencies and its Output.object takes a StandardSchemaV1, so zod is not needed by main.ts; the plan schema is written by hand instead."
  - "VERIFIED: eslint on .sandcastle/main.ts reports 'File ignored because no matching configuration was supplied', so lint skips the file; eslint.config.ts was not changed."
  - "VERIFIED: independent review of a0393b4 (a finder and a verifier in separate contexts) passed npm run check and four mutation controls, and the finder reported one HIGH and five MEDIUM findings, all addressed on this branch: an empty branch created at HEAD was dropped as done (scripts/sandcastle/already-done.test.ts gained cases that failed 1 of the 2 new ones before the fix, and all 9 sandcastle tests pass after), the plan's id and branch were not validated (the refusal test failed at its first new case before the fix, and passes with all five), and the merge prompt, an unqualified gh issue view, the runbook's reasons and five em dashes in .sandcastle/main.ts were corrected."
  - "VERIFIED: after the second independent review of e156675 (finder and verifier, both separate contexts; the verifier passed npm run check and three mutation controls), the finder's findings were fixed test first at ad06b7a: plan-schema.test.ts gained six refusal cases (leading zero, backtick title, multi-line title, blank title, 201-character title, duplicate issue) and already-done.test.ts a branch moved by a reset with no commit; the new plan-schema cases failed at the leading-zero case and the reset case failed before the change, and all 11 sandcastle tests pass after it."
  - "VERIFIED: npm run check at 071ce5c exited 0 with 595 of 595 tests passing (2026-10-13); the earlier head ad06b7a ran 593, and the two tests added since are the fast-forward and rename case and the title normalisation case."
  - "VERIFIED: after the review of 993348c (a finder and a verifier in separate contexts; the verifier passed four mutation controls), the findings were fixed test first at 071ce5c: a title with a backtick was refused and aborted the loop (now normalised; the new case failed before the change), and a fast-forward merge or rename of an empty branch counted as work (the new case failed before the change)."
  - "VERIFIED: after the review of c276e10 (a finder and a verifier in separate contexts; the verifier reproduced 595 of 595 and passed five mutation controls), the findings were fixed test first at 9394b57: already-done.test.ts gained a branch reset past its commits, cherry-pick and revert entries, a missing reflog, and the ahead selector, and plan-schema.test.ts bidi and surrogate-pair titles; before the change already-done.test.ts failed to load (the aheadIssues export was missing), so no single case of that file was observed failing, the new title case failed its assertion, and branch-guard.test.ts failed to load; after it 600 of 600 tests pass at that head in npm run check (2026-10-13)."
  - "VERIFIED: after the review of 6d439aa (a finder and a verifier in separate contexts; the verifier passed npm run check at 600 of 600 and six mutation controls), the finder's MEDIUM finding that a branch reset to a commit HEAD already contains still counted as worked was reproduced as a failing case in a throwaway copy (the new pendingIssues test failed alone, 14 of 15 passing, against the old reachability-free rule) and fixed: branchWork now needs a commit entry whose commit is still an ancestor of the tip, and already-done.test.ts has 15 tests."
  - "VERIFIED: npm run check at dbc5bd5 exited 0 with 602 of 602 tests passing (2026-10-13); the commits after it are wiki-only."
  - "VERIFIED: after the review of 138a816 (a finder and a verifier in separate contexts; the verifier reproduced 602 of 602 and passed seven mutation controls), the finder's findings were fixed test first at 6bd694f: a rebased or amended branch still counts as worked, an unrecognised branch ahead of HEAD is passed to the merger, and a reflog entry naming a pruned commit is treated as not reachable; the rebase and amend case and the unrecognised-ahead case failed before the change (2 of 18), the pruned-commit case already passed and stays as a guard, and npm run check at 6bd694f exited 0 with 605 of 605 tests passing (2026-10-13)."
  - "VERIFIED: after the review of 0b6d4fa (a finder and a verifier in separate contexts; the verifier passed eight mutation controls on named tests), the finder's HIGH finding was reproduced in a scratch repository with git 2.53.0 (rebasing an empty branch onto a moved main writes a rebase (finish) entry whose commit is the new tip, so the branch counted as worked) and fixed test first at 1fd65fc, a fix that a94d14d replaced by dropping the rebase rule: the new empty-rebase case failed before the change (1 of 21 in already-done.test.ts), the revert, amend-with-a-new-message and pruned-entry-beside-a-valid-entry cases passed and stay as guards, and npm run check at 1fd65fc exited 0 with 608 of 608 tests passing (2026-10-13)."
  - "VERIFIED: in the same scratch repository a conflicted rebase resumed with git rebase --continue also writes a plain rebase (finish) entry, so the finder's second concern did not reproduce on git 2.53.0; older git versions were not tried (UNKNOWN)."
  - "UNKNOWN: the verifier of 0b6d4fa reported 646 tests where this worktree runs 605 at the same code, the AFK branch's count; the cause is not established, so that figure is not used here."
  - "VERIFIED: after the review of fa0e41a (a finder and a verifier in separate contexts; the verifier reproduced 608 of 608 after one rerun for the known netproxy flake and passed nine mutation controls), the finder's HIGH finding (a commit then a rebase then a reset to main, or a reset then a fast-forward rebase, made discarded work count as worked) was fixed test first at a94d14d by dropping the rebase rule: the new reset-and-rebase, rebased-branch and ahead-of-HEAD cases failed before the change (3 of 24 in already-done.test.ts), and npm run check at a94d14d exited 0 with 611 of 611 tests passing (2026-10-13)."
  - "VERIFIED: after the review of 9ce6c09 (a finder and a verifier in separate contexts; the verifier passed nine mutation controls on named tests), the finder's cherry-pick finding was reproduced in a scratch repository with git 2.53.0 (git cherry-pick --ff of a commit HEAD already holds logs cherry-pick: fast-forward with the tip equal to that commit, so the branch counted as worked) and fixed test first at the head after a94d14d: the new case failed before the change (1 of 27 in already-done.test.ts), the partial-reset and no-reflog-ahead cases passed and stay as guards, and reachable() now catches only GitError."
  - "VERIFIED: npm run check at de7030a exited 0 with 614 of 614 tests passing, run from this worktree with the branch name printed (2026-10-13); the commit after it is wiki-only."
  - "VERIFIED: after the review of 515d15a (a finder and a verifier in separate contexts; the verifier reproduced 614 of 614 from this worktree and passed nine mutation controls), the finder's F1 was fixed test first at cbaaa60: an empty commit made with git commit --allow-empty (which the implementer prompt's note-in-the-commit instruction led to) counted as work and the issue was dropped; the new case failed before the change (1 of 29 in already-done.test.ts), a conflicted-merge case passed and stays as a guard, an older cherry-pick-then-revert test was narrowed because a zero-content pair is no longer work, and npm run check at cbaaa60 exited 0 with 616 of 616 tests passing (2026-10-13)."
  - "VERIFIED: after the review of 75f8f0c (a finder and a verifier in separate contexts; the verifier reproduced 616 of 616 and passed ten mutation controls), the finder's two HIGH findings were fixed test first at 31a1813: comparing the tip with the creation tree made an empty commit after a moved main count as work and made real work that nets out against the creation tree read as empty (both new cases failed before the change, 2 of 32 in already-done.test.ts), a branch reset by -C and a tip written by update-ref passed already and stay as guards, and the check is now per commit (reachable, content against its own parent, merge commits never count); npm run check at 11bcffe exited 0 with 619 of 619 tests passing (2026-10-13)."
  - "VERIFIED: after the review of 984c021 (a finder in a separate context found no CRITICAL or HIGH finding; the verifier's run was lost when the session ended and was not repeated for that head), the finder's MEDIUM finding that the commit (merge) exclusion had no test depending on it was resolved at 8ea53fb: the exclusion was redundant because git diff-tree prints nothing for a merge commit, so it was removed, and a merge-only branch is pinned as not worked by a new case that passed before and after; npm run check at 8ea53fb exited 0 with 620 of 620 tests passing (2026-10-14)."
  - "UNKNOWN: whether a non-fast-forward cherry-pick of a commit HEAD holds, a lone revert, or a squash-merged branch still ahead of the integration branch should count; they are documented limits in the runbook and need a patch-id comparison."
  - "UNKNOWN: the verifier of 9ce6c09 reported 667 tests where this worktree runs 611 at the same code; 667 minus 611 equals the 56 entries of afk.test.ts, which does not exist in this worktree, so the verifier's run is likely to have used the AFK worktree; the author's own rerun gave 611 of 611."
  - "UNKNOWN: whether a real Sandcastle run writes commit entries into the host branch reflog; the guard and the AFK wrapper depend on it and fail loudly or stay pending when it does not."
  - "VERIFIED: the verifier of c276e10 ran npm run check in this worktree and reproduced 595 of 595; the 610 an earlier verifier reported for 993348c was not reproduced and its cause is UNKNOWN, so that figure is not used here."
  - "UNKNOWN: a merged branch whose tests still fail is dropped as done next round, and left-over branches reach the merger without a review round; both are documented limits in the runbook, and whether such a branch should be merged at all is awaiting the owner. The stall of a branch holding unmerged commits is handled by aheadIssues in .sandcastle/main.ts, which no test executes."
  - "UNKNOWN: whether a half-finished branch should be merged at all; the guard cannot tell partial from complete work, so the limit is documented in the runbook and the implementer prompt asks for an incomplete task to be said so in the issue comment. Awaiting the owner."
  - "VERIFIED: the main-branch refusal is branchRefusal in scripts/sandcastle/branch-guard.ts and its test covers main, a detached HEAD and a feature branch; UNKNOWN: the call in .sandcastle/main.ts is not executed by any test because that file is a top-level loop."
  - "INFERRED: the hand-written schema satisfies Output.object, because plan-schema.test.ts applies the contract read from extractObject in dist/index.js of 0.12.0 (a truthy issues is a failure, otherwise value is returned); extractStructuredOutput is not exported, so the planner itself was not run."
  - "UNKNOWN: whether the prompt changes make the agents follow the commit, staging and no-push rules; no agent was run in this work, and the Docker image was not built."
  - "UNKNOWN: whether gh in the sandbox resolves the fork correctly without -R; the prompts pass -R Zimfra/software_testing and that was not exercised."
  - "UNKNOWN: whether the model id claude-opus-4-8 in .sandcastle/main.ts is current."
---

## Problem

Sandcastle ran once against issue 1 from untracked files in an owner checkout. Its prompts asked
for `RALPH:` commit subjects, told the merger to close issues and left `gh` to guess the
repository, `.sandcastle/Dockerfile` tripped the home-path scan, and a re-run could plan an
issue whose branch was already merged.

## Desired outcome

`.sandcastle/` is tracked without `.env`, `logs/` and `worktrees/`, `npm run check` passes with
it, the agents are told this repository's rules, and a runbook describes the verified setup.

## Next step

Owner points, none decided here:

1. Whether `.sandcastle/Dockerfile` should move to the Node version in `.nvmrc` and a Python
   that can run `evals:test`, so the sandbox can run the whole check.
2. Whether `main.ts` joins lint (it needs three non-null assertions replaced) or stays outside.
3. Whether the reviewer prompt, which is the upstream one, should also name the repository
   review rules, and whether an unattended run needs a notification step first.
4. Which run mode to use unattended, given that the plan and merge phases use the owner's own
   checkout.

## Observations

- `.sandcastle/.env.example` did not exist in the generated directory; this branch adds one
  with variable names and no values. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` come
  from the Sandcastle README; `GH_TOKEN` is what the `gh` CLI reads.
- `.sandcastle/CODING_STANDARDS.md` was the empty scaffold the reviewer loads; it now points to
  `CLAUDE.md` and the rules instead of restating them.
