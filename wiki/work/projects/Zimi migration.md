---
type: project
title: Zimi migration
summary: The phased migration of Zimi's toolchain, wiki, skills and guards into Zeemrepo, one pull request per phase.
tags: [area/planning, tool/ecc]
created: 2026-10-09
updated: 2026-10-10
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: "Owner: turn on Require review from Code Owners in protect-main (after CODEOWNERS lands on main), remove the SSH key ~/.ssh/id_ed25519 registered to the owner account (from GitHub or this machine), confirm the bypass list is empty, enable two-factor authentication on the machine account; then the migration is done. Optional: decide whether low-compliance steps become hooks."
idea: "[[Migrate Zimi into Zeemrepo]]"
evidence:
  - "VERIFIED: PRs #1-#5 merged by the owner (audit, toolchain, shared library, wiki system, skills)."
  - "VERIFIED: Phase 5 npm run check passes: lint, typecheck, 422 tests, wiki:lint, skills:lint, governance:check, wiki:compliance, changelog:guard, memory:guard."
  - "VERIFIED: Phase 6 npm run check passes with the branch guard, worktree guard, npm run pr, landing audit, merge-blocking hook, hooks and split CI (509 tests); check workflow green on PR #7."
  - "VERIFIED: PRs #6 and #7 merged by the owner (change-record guards; git guards, split CI and merge-blocking hook)."
  - "VERIFIED: Phase 7 npm run check passes (511 tests) with CLAUDE.md, seven .claude/rules/zeem files, finder and verifier agents, 9 decisions, 23 lessons and 5 reference and runbook pages; ECC code-reviewer and a port-fidelity review findings fixed on the branch."
  - "VERIFIED: PR #8 merged by the owner (rules, agents, ported wiki knowledge)."
  - "VERIFIED: with GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE aimed at a decoy clone, all 511 tests passed and the decoy was unchanged; a pre-push run from a linked worktree whose check leaked a commit was refused by git-state.ts."
  - "VERIFIED: PR #9 merged by the owner (pre-push git-state backstop)."
  - "OWNER DECISION: baseline edits to branch-review and manage-branch approved: \"Approve both (Recommended)\" (2026-10-09); merged branches from PRs #1-#7 deleted after checking each was contained in origin/main; backup branches kept."
  - "VERIFIED: PR #10 merged by the owner (skill alignment)."
  - "VERIFIED: Phase 8 imported 34 instincts (dry run 34 new, 0 duplicates); evolve found the 7 designed clusters and generated 13 items (7 skills, 6 agents)."
  - "VERIFIED: PR #11 merged by the owner (Phase 8 instincts, evolve review, write-guard)."
  - "OWNER DECISION: \"I recommend allowing mixed wiki/non-wiki conflict resolutions in genuine merge commits, while rejecting unrelated edits.\" (2026-10-09); wiki-compliance now allows a merge whose remerge-diff touches only files git reported as content conflicts, each hunk removing a whole marker set, deleting only inside it, and adding only lines from the two sides; octopus merges are refused."
  - "VERIFIED: PR #12 merged by the owner (resolving-merge exception, spawn aliases)."
  - "VERIFIED: Phase 9 wrapper: 7 unittest cases pass; driving ECC's real _setup_sandbox through it gave a sandbox with the rules, settings and merge hook (which blocked gh pr merge with exit 2) and no evals/ folder; no model was called."
  - "VERIFIED: after a security review showed env scrubbing was not a boundary, every ECC claude call runs under bubblewrap; a probe through the real confine() saw no gh token, SSH keys, this repository or ~/Github, gh logged out, and no secret variables, while claude still ran."
  - "VERIFIED: compliance pilot second run, on the bubblewrap-confined harness before the PR #13 fixes: branch-and-merge 75/50/75%, write-guard 20/20/20%, wiki-memory 43/43/0% (strict ordering, lower bounds); the competing branch-and-merge agent branched and pushed nothing to main; four security reviews and two verifications of the sandbox before any Sonnet run."
  - "VERIFIED: PR #13 merged by the owner (compliance evals); npm run audit reported 13 commits on main, all landed by merged pull request."
  - "OWNER DECISION: \"Yes rerun any sessions required we want to ensure this day 1 build is correct. Also start phase 10\" (2026-10-09)."
  - "VERIFIED: Phase 10 reviews over f9188d1: ECC harness-audit script 30/39 (memory persistence 0/10 is a false negative: ADRs live in wiki/decisions), security scan and orch-review with no CRITICAL or HIGH; the protect-main ruleset has no bypass actors; fixes on chore/phase-10-closeout: push-to-main hook branch, gh timeout, check:base, two ECC override entries, user-only skill references, .env ignored."
  - "VERIFIED: the first Phase 10 re-run stopped when the owner's Claude login lapsed mid-run with platform.claude.com allowed; INFERRED: a sandboxed token refresh rotated the refresh token. Each sandbox call now gets the login without its refresh token, the proxy allows only api.anthropic.com, and a run needs an hour left on the token."
  - "VERIFIED: second re-run 28/20/10% traced by a separate reviewer to harness and grader effects (no origin, regenerated specs, inherited split output, a 500-character input cut, a wrong schema in the generator context); fixed in 082c862 with pinned specs."
  - "VERIFIED: by a separate reviewer on 2026-10-10 (its notes, the sandboxes and the streams are not committed), third re-run, each session checked against its sandbox and raw stream: branch-and-merge 92% (trustworthy; nothing pushed or committed on main), write-guard 6% (not a measure of the skill: the generated task duplicated an existing guard), wiki-memory 47% (understated by one label per call and the input cut); see evals/compliance/reports/summary.md."
  - "OWNER DECISION: \"Fix what you can\" (2026-10-09) for the harness follow-ups."
  - "VERIFIED: harness fixes on PR #13 (repository tooling replaces a scenario's copy, planted symlinks on tooling paths removed, generator told the repository's stack and retried on bad YAML, chained Bash calls split only when the stream marks them is_error false and not run_in_background): 39 unittest cases pass and npm run check passes; measured by the 2026-10-09/10 re-runs recorded in this list."
  - "OWNER DECISION: network allowlist before the pilot (\"Network allowlist first (Recommended)\") and a full re-run (\"Re-run all 3 (Recommended)\"), 2026-10-09."
  - "OWNER DECISION: compliance pilot approved: \"Pilot: 3 targets (Recommended)\" (2026-10-09)."
  - "VERIFIED: PR #14 merged by the owner (Phase 10 closeout); npm run audit reported 14 commits on main, all landed by merged pull request."
  - "OWNER DECISION: \"1. Yes prove the gap. Keep separating 2. Follow ur recommended ... 3. Yes add npm as evaluation we need to confirm the work not assume ... 4 pin them for sure\" (2026-10-10)."
  - "OWNER DECISION: \"Why do we need to delete the ecc rule set. Ecc is perfect why delete parts of it.. i dont want to change anything\" (2026-10-10); the vendored ECC rules stay complete and rules:check holds all 22 sets to the v2.2.3 pin, replacing the earlier trim decision."
  - "VERIFIED: end-to-end audit on chore/owner-decisions-audit (dead code, settings, TypeScript, Python, then ECC code, security, silent-failure, test-quality and doc-accuracy reviews, and a requirements review against the plan): each finding fixed test-first or recorded; npm test 568 passing, evals:test passing, check:base exit 0; mutation re-checks kill every previously surviving mutation."
  - "INFERRED: the GitHub ruleset stops pushes to main but not a merge by the owner's own gh login, which agents use; for merges the agent-side control is the best-effort hook and deny rules (security review, documented in Merge gate contract); a fix is the owner's decision."
  - "VERIFIED: PR #15 merged by the owner (owner decisions and end-to-end audit); npm run audit reported 15 commits on main, all landed by merged pull request."
  - "OWNER DECISION: \"i dont want to change any rules ... im just trying to make the repo streamlined and efficent\" (2026-10-10); the day-one baseline removes only what no rule or check protects, and the two candidate skill rules are declined."
  - "VERIFIED: day-one baseline on chore/day-one-baseline: design-actions, diagnose-bug, seeds.md and five unused-tool lessons removed (owner ran the deletion); Zimi mentions reworded in 52 files outside the protected records; git diff of .claude/rules, wiki/decisions, docs/migration, import-baseline.json is empty; check:base exit 0 with 569 tests."
  - "VERIFIED: ECC instincts reviewed: the five tied to the removed lessons deleted, the other 29 restated as this repository's (ids zeem-*); ECC's instinct-cli status lists 29."
  - "OWNER DECISION: merge control by a machine account (\"Machine account (Recommended)\") with the owner's own gh login removed from this machine (\"Yes, browser-only (Recommended)\"), 2026-10-10; the owner sets up the account and ruleset."
  - "OWNER DECISION: \"Review each, prune unused (Recommended)\" (2026-10-10): a lesson was removed when it described a tool or service this repository does not use (sudo setup, SSH key passphrases, a cloud API token, token key upload, sshd); Root shell hides user-installed tools stays because it backs the branch-and-merge rule \"Do not work as root\"."
  - "INFERRED: grill-plan and verify-work stay: the byte-protected imported skills link to them, so removing them would fail skills:lint."
  - "VERIFIED: PR #18 merged by the owner (day-one baseline); PR #16 (setup-node 7.1.0) merged and PR #17 closed by the owner after its check failed: npm ci refused TypeScript 7 against typescript-eslint 8.71 (peer range below 6.1)."
  - "VERIFIED: Dependabot now ignores major updates of typescript and @types/node; scripts/git/hooks.test.ts fails without the ignore entries (shown failing first)."
  - "VERIFIED: by a separate reviewer on 2026-10-10 (its notes, sandboxes and streams are not committed), compliance baseline on pinned scenarios at main b7e38fe: branch-and-merge 75% (accurate), write-guard 28% (neutral about 83% on the evidence; a step-chain cascade), wiki-memory 20% (supportive 100% on the evidence); nothing pushed or committed on main in any sandbox; see evals/compliance/reports/summary.md."
  - "VERIFIED: PRs #19 (Dependabot ignores TypeScript minors and majors, Node types majors) and #20 (compliance baseline) merged by the owner."
  - "VERIFIED: machine account zimmybot has write access; protect-main requires 1 approving review, dismisses stale approvals, requires approval of the most recent push (gh api rulesets, 2026-10-10; the bypass list is visible only to the owner, who is to confirm it is empty); gh on this machine is logged in as zimmybot only and the owner's login was removed (gh auth status)."
  - "VERIFIED: npm run pr refuses when gh is logged in as the repository owner (scripts/git/pr-ready.test.ts, shown failing first); ADR-0025 supersedes ADR-0008."
  - "OWNER DECISION: nothing is pushed to main; work lands by pull request and only the owner merges (2026-10-09)."
---

## Outcome

Zimi's useful rules, wiki system and skills live in Zeemrepo, each enforced by a check in
`npm run check`, reviewed by ECC agents, and landed by owner-merged pull requests.

## Scope

Phases 0 to 10 of the migration plan: audit, toolchain, shared library, wiki system, skills,
change-record guards, git guards and CI, rules and wiki content, instincts and `/ecc:evolve`,
compliance evals with ECC `skill-comply`, and closeout. Zimi itself is never modified.

## Acceptance criteria

- Every kept Zimi rule is enforced by a check or recorded as covered by ECC.
- `npm run check` passes on main, and CI runs it on every pull request.
- The rules in `docs/migration/skill-stocktake.md` are distilled into `.claude/rules/`.

## Work links

- Audit: `docs/migration/zimi-audit.md`
- Skill stocktake: `docs/migration/skill-stocktake.md`
- Guards: [[Change records]]
- Rules distillation: `docs/migration/rules-distill.md`
- Landing: [[Merge gate contract]]

## Observations

- Skill alignment: [no-doc-change: Land a change and Merge gate contract already describe npm run pr and the required check and guards CI checks; the two skills now match them]
