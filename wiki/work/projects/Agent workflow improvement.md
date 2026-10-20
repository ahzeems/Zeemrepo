---
type: project
title: Agent workflow improvement
summary: Requirement-to-evidence assessment of the agent workflow (R1 to R9) in five phases; Phases 1 to 3 landed (PRs 27, 28, 29); Phases 4 and 5 continue on one integration branch.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-20
agent: claude-code
status: done
owner: human
priority: P2
next_action: Done. Phases 1 to 5 landed; the live evaluation's follow-ups (loosen the grader after_step cascade, assess GateGuard's effect on scenario agents, decide whether to promote finish_with_npm_run_pr to a hook) are recorded as observations below and belong to [[Improve the agent workflow]].
idea: "[[Improve the agent workflow]]"
evidence:
  - "OWNER DECISION: the owner's brief (2026-10-19) says \"Begin Phase 1 only\" and \"Stop at Phase 1 owner-review handoff. Do not begin Phase 2 before the owner merges Phase 1.\""
  - "OWNER DECISION: \"go ahead and fix it, then open the PR\" (2026-10-19), after the verifier's finding."
  - "VERIFIED: after the owner ran /plugin install ecc@ecc on 2026-10-19, claude plugin list --json gave ecc@ecc 2.2.3, scope project, enabled; ECC agents and skills were offered in the session and its GateGuard PreToolUse hook blocked the first Bash command until the facts it asks for were given; the rewritten .claude/settings.json parses equal to the committed one (key order only); the install carries a dependencies-refused note (the plugin's npm packages were not installed)."
  - "VERIFIED: a separate-context verifier pass at c171669 reran npm run check (exit 0) and returned VERIFIED on the install record; it found the dependencies-refused note, recorded in the commit after it, which changes only wiki files."
  - "VERIFIED: Phase 4 first slice, test first - test_outcomes.py failed before outcomes.py existed (import error), then run_context and the wiring test failed for the expected reasons; npm run evals:test now passes 65 tests (56 before plus 9), and npm run check exits 0 on work/agent-workflow."
  - "VERIFIED: separate-context re-review of PR #30 at ae76c52 - ECC's code-reviewer returned Approve (ready for the owner) with one LOW, and ECC's Python reviewer found no CRITICAL or HIGH; it ran the seven write-guard outcome checks against synthetic sandboxes (correct; a guard that never refuses, crashes, always refuses, has no test, is not wired, is not documented), and each broken one failed its matching check. Its MEDIUM (an existing run log kept a wider mode) and two LOW were fixed in the next commit, test first for the mode."
  - "VERIFIED: evals:test (74 tests) runs the pinned branch-and-merge and wiki-memory behaviour and sibling-test checks against a correct implementation and broken ones (a stub, no lowercasing, a plain Error, an out-of-order duration); planting vacuous checks in their place made both tests fail (2 of 2)."
  - "VERIFIED: in sandboxes seeded with run_comply.seed_sandbox and commit_baseline from the committed tree (unconfined, on this macOS host), all four branch-and-merge checks passed a correct slugify with its test in 17 s, the three correctness checks failed the stub with no test, and the safety check failed after a commit was pushed to the sandbox's origin main."
  - "VERIFIED: outcome_observer is tested to run checks through the runner it is given, in the sandbox, and a test holds run_confined to passing confined.run (both tests failed before the extraction)."
  - "UNKNOWN: the same checks in a bubblewrap-confined sandbox, the wiki-memory checks in a seeded sandbox, and any live model run; this macOS host has no bubblewrap, and a live run needs the owner's approval."
  - "VERIFIED: the first bubblewrap-confined live run, on a Linux host 2026-10-20, matched the day-one baseline on two of three targets: branch-and-merge 75% (supportive 100, neutral 50, competing 75) and write-guard 28% (0, 83, 0), with wiki-memory 13% (40, 0, 0), a little below its 20% baseline (one run per scenario). Each scenario's network allowed only api.anthropic.com and refused mcp-proxy.anthropic.com and registry.npmjs.org, so the sandbox confines as designed; only the three report files moved, the pinned specs and scenarios unchanged."
  - "VERIFIED: outcomes.py scored the same runs strong (outcome, not compliance): correctness 3/3 for wiki-memory and branch-and-merge or 6/6 for write-guard, and safety 1/1, in five of six scenarios; safety was 1/1 in all six. The one 0/6 (write-guard competing) is the agent correctly not building a guard under a skip-it prompt."
  - "VERIFIED: the run confirms the harness limits evals/compliance/reports/summary.md already records: write-guard supportive built the guard (6/6 outcome) yet scored 0% compliance because prove_gap was unmatched and the after_step chain zeroed every later step, and wiki-memory collapsed at write_memory_note the same way; only branch-and-merge's 75% is accurate."
  - "OWNER DECISION: ECC's GateGuard hook stays fully on, \"Leave it as is\" (2026-10-19); the Integration admission page records what it holds and how agents answer it."
  - "VERIFIED: separate-context review of 4d9c47d - ECC's python-reviewer rated it ready with one HIGH (the slugify broken fixtures both failed the first case, so a check cut to that case would pass), fixed by one mutant per pinned case; cutting both checks to their first valid case now fails both tests (2 of 2). The verifier returned NOT_VERIFIED on one point: the GateGuard table named git push --delete and posting to GitHub as destructive, and classifyDestructiveCommand flags neither; the table now lists rm -rf, git branch -D and git push --force, each confirmed against the classifier."
  - "VERIFIED: the run_confined test now parses the call with ast; planting subprocess.run as the runner, with confined.run left in a comment, makes it fail."
  - "VERIFIED: separate-context verifier at a54014b returned VERIFIED on all six criteria: npm run check exit 0; every GateGuard table example matches classifyDestructiveCommand (rm -rf, git branch -D, git push --force flagged; git push --delete and gh pr comment not); cutting each outcome check to its first case fails both fixture tests; the parsed run_confined test fails on subprocess.run with confined.run in a comment and passes a keyword reorder; eslint.config.ts is unchanged from main."
  - "UNKNOWN: Phase 5 has no measured results to act on; the brief's tuning (context, effort settings, models, bounded retries) waits for Phase 4's live run, so nothing was adopted."
  - "INFERRED: an effect new since the 2026-10-10 baseline (ECC installed 2026-10-19): the GateGuard PreToolUse hook blocks each scenario agent's first Bash chain ([Fact-Forcing Gate]), perturbing the early calls the grader keys on; recorded as a Phase 4/5 observation below."
  - "OWNER DECISION: \"Land now, record findings\" (2026-10-20): Phase 5 adopts no tuning; the grader after_step cascade, GateGuard's effect on scenario agents, and whether to promote finish_with_npm_run_pr to a hook are recorded as observations, not changed on this branch."
  - "OWNER DECISION: \"see we are creating branch after branch, i want all the phase work in a single branch\" and \"fix this bug\" (2026-10-20); the manage-branch skill and npm run pr now refuse to land a branch whose changed work records are still open."
  - "VERIFIED: pr-ready.test.ts was changed first - a branch whose work record is in-progress was not refused (fail) - and passes after scripts/git/pr-ready.ts gained the open-work refusal, which runs before npm run check and any push; done, parked and superseded records, and an open record that main already held, still go ahead."
  - "VERIFIED: separate-context review of fb071d9 - ECC's code-reviewer returned Approve with two LOW, both fixed: a new test running npm run pr from a subdirectory failed (the wiki/work pathspec was cwd-relative) and passes with :(top)wiki/work/; git diff now uses --diff-filter=d and git show goes through must, so a failed read is an error, not a pass. The reviewer's sandbox blocked git, so it did not run npm run check; it was run here with the owner's approval to run git outside the sandbox."
  - "VERIFIED: separate-context review of 70f6bfd - ECC's code-reviewer returned Approve (ready for the owner), no CRITICAL or HIGH, three MEDIUM and one LOW; fixed: openWork reads records from HEAD with git show instead of the working tree, tests now cover a deleted record, a path with a space and unreadable frontmatter (planting 'unreadable frontmatter passes' and 'a deleted record blocks' each failed the suite), and the BASELINE_SUBJECT test runs commit_baseline; the third MEDIUM (a small edit to an open record also blocks, and this branch is held by its own open record) is the intended trade-off."
  - "VERIFIED: the review LOW leftovers are fixed test first (each new test failed first): run_context moved to outcomes.py and runs git with run_comply.DISARMED, a failing git status leaves dirty UNKNOWN, BASELINE_SUBJECT is one constant every pinned safety check is tested against, outcomes.py table exits 2 on a missing or malformed file, and invalid checks JSON is refused; evals:test passes 79 tests and run_comply.py is 764 of 800 lines."
  - "VERIFIED: PR #28 (Phase 2) merged by the owner (gh pr view 28: mergedBy ahzeems); check and guards passed on head 3018703."
  - "OWNER DECISION: Phase 3 admits the \"ECC plugin (Recommended)\" first and records it on a \"Wiki reference page (Recommended)\" (2026-10-19)."
  - "VERIFIED: git ls-remote resolves ECC tag v2.2.3 to commit c05b2d6614f62f6db0047669aa4eefb223d478f9, the commit of the local marketplace clone; its plugin.json, hooks/hooks.json and .mcp.json give 68 agents, 293 skills, 94 command shims, 24 hook commands on 7 events and a chrome-devtools MCP server."
  - "VERIFIED: on 2026-10-19 claude plugin list --json printed [] and no ecc agent or skill was offered in this session, while .claude/settings.json enables ecc@ecc: enabled is not loaded on this machine."
  - "VERIFIED: on a scratch copy, claude plugin disable ecc@ecc --scope project set the entry to false and rules:check exited 0; deleting the marketplace and enabledPlugins entries made rules:check refuse with the pin message."
  - "VERIFIED: separate-context review of b4f0370: the read-only verifier reran every command on the admission page and npm run check (exit 0) and returned VERIFIED; the read-only finder reported one HIGH (the removal list missed live files; reproduced: npm test fails the pin test on a scratch copy without the marketplace entry) and three MEDIUM (permissions overstated for MCP calls, hooks_enabled does not stop hook commands, purpose and compatibility missing), all corrected on the page."
  - "VERIFIED: a second verifier pass at 6d3e3e9 reran npm run check (exit 0), reproduced the pin-test failure after removal on a scratch copy and confirmed each corrected claim; it returned VERIFIED, noting one imprecise permissions line in this record, reworded in the commit after it, which changes only this record."
  - "VERIFIED: PR #27 (Phase 1) merged by the owner (gh pr view 27: mergedBy ahzeems, merge commit c5e9a0b); the check and guards workflows passed on it; npm run audit reports 26 commits on main, all landed by merged pull request."
  - "OWNER DECISION: for Phase 2, \"Exclude all non-TS/Python\" ECC rule sets from loading, verified by \"One claude -p run\" (2026-10-19)."
  - "VERIFIED: before Phase 2, reading scripts/changes/repo-memory-validation.ts in a session on 2026-10-19 injected the ArkTS, React Native, TypeScript and Vue rules, and reading test files injected angular/testing.md; their globs (**/*.ts, **/*.test.ts) match 80 tracked .ts files."
  - "VERIFIED: rules:check refused the real repository when the arkts exclusion was removed from .claude/settings.json (exit 1, naming ecc/arkts/), and passes with it (exit 0); the three new ecc-rules tests failed before the change and pass after it."
  - "VERIFIED: one claude -p run (Claude Code 2.1.303, Haiku, 2 turns, session 2ec31e9c) read scripts/lib/cli.ts with the exclusions in place; its transcript holds the TypeScript and zeem rule headings and none of the ArkTS, React Native, Vue or Angular headings; it reported total_cost_usd 0.0069 as a list-price estimate."
  - "VERIFIED: separate-context review of e2500db: the read-only verifier reran npm run check (exit 0), showed the three new tests fail on the base implementation, and refused a planted missing exclusion on a scratch copy; it returned NOT_VERIFIED on one byte figure that was 2 too high (wc -c gives 46,814), corrected here. The read-only finder reported no CRITICAL or HIGH and one MEDIUM: an over-broad claudeMdExcludes entry such as **/.claude/rules/** passed rules:check; a test reproducing it failed, and rules:check now refuses any entry that is not one whole ECC set."
  - "VERIFIED: a second verifier pass at 7574359 reran npm run check (exit 0, 584 tests), showed the over-broad-exclusion test fail on e2500db's code and pass at head, and saw rules:check refuse a planted **/.claude/rules/** entry on a scratch copy (exit 1); its one not_met was this line quoting the old byte figure, reworded in the commit after it, which changes only this record."
  - "UNKNOWN: tokens saved per session; the excluded rule text that matched tracked files is 46,814 bytes, and no per-file token count is available."
  - "VERIFIED: baseline is main at f0f82cdfaf974867615cbbae52d3ec5c6160e8b0 (git rev-parse HEAD and origin/main, 2026-10-19), clean tree, one worktree, no other branches and no open pull requests (gh pr list)."
  - "VERIFIED: grep -rli sandcastle over the tree (excluding node_modules and .git) returns nothing, so the earlier plan's Sandcastle files are absent and were not recreated."
  - "VERIFIED: before this branch, verifier.md returned PASS or FAIL with per-criterion VERIFIED/INFERRED/UNKNOWN labels while verify-work, which says it can run as the verifier agent, defined VERIFIED/NOT_VERIFIED/INCONCLUSIVE and met/not_met/needs_human."
  - "VERIFIED: before this branch, the Verify a repository change runbook reviewed before committing, against evidence-and-review.md's rule to review a pinned commit; Land a change named no review step."
  - "VERIFIED: branch-diff.ts branchBase takes the earlier of the fork point's commit date and the branch's author dates, and repo-memory-validation.ts counts a no-doc-change hatch anywhere outside code in any changed work record; Change records.md described both more narrowly."
  - "VERIFIED: npm run check exits 0 at d91f4ac on Node 24.22.0 (580 node tests and 56 evals tests pass; every guard passes)."
  - "VERIFIED: the read-only verifier agent, in a separate context, reran npm run check at d91f4ac (exit 0) and returned VERIFIED with all five criteria met; its one finding (the R7 row said 112 path-scoped rule files, git ls-tree gives 111) is corrected in this record."
  - "VERIFIED: the read-only finder reviewed d91f4ac and reported no CRITICAL or HIGH findings; its MEDIUM and LOW findings were fixed in b6a686a and e09b0d4 or recorded under Observations."
  - "VERIFIED: a second separate-context verifier pass at e09b0d4 reran npm run check (exit 0) and returned VERIFIED with all five criteria met; the commit after it changes only this record."
  - "VERIFIED: npm run pr first refused because gh auth status exited 1 for a failing second stored login; after the owner fixed the login on 2026-10-19, gh auth status exits 0 and the active account is the machine account."
---

Use evidence and owner decisions; do not invent approval.

## Outcome

Agents working in this repository state what a task must achieve before they edit, read the code,
tests and callers it touches, keep changes small, verify the outcome in a separate context on a
pinned commit, and report each step as done, refused, failed, blocked or not run.

## Scope

Five phases. Phases 1 to 3 each had their own branch and pull request (#27, #28, #29). From
2026-10-19, Phases 4 and 5 share one integration branch, `work/agent-workflow`, with one pull request
when the work is complete ([[ADR-0027 One integration branch per piece of work]]).
Phase 1 audits R1 to R6 and assesses R7 to R9 only for what later phases depend on. Out of scope in
every phase: a new harness, orchestration framework, skill library, retry or checkpoint
infrastructure, paid or live model runs without the owner's approval, and changes to imported skills
without an approval quoted in the revision record.

### Requirement-to-evidence matrix (main at f0f82cd)

| ID | Requirement (observable outcome) | Evidence before Phase 1 | Coverage | Finding | Phase 1 change or reason for none | Verified by |
|---|---|---|---|---|---|---|
| R1 | A consequential task states outcome, scope, acceptance criteria and open questions; small, settled tasks stay light | Fragments only: acceptance criteria at verification time (`Verify a repository change` step 1), "small, settled" undefined (`Idea to execution`), owner questions marked awaiting input (`owner-authority.md`) | missing | optimisation candidate | First bullet of `design-principles.md` "Before writing"; a small, settled change states it in one plan line. "Small, settled" keeps its existing meaning and stays undefined | review only: no check covers this prose, and prose cannot prove agents comply |
| R2 | Read implementation, tests and direct callers first; re-read changed or truncated evidence | `design-principles.md` named importers and callers, not tests or re-reads | partial | optimisation candidate | Same file: tests added, re-read rule for changed or truncated reads; no read limits | review |
| R3 | Rules, skills, docs and checks agree; one home per rule | CLAUDE.md `check` list, CI job names and guard lists match `package.json` and the workflows; three doc statements did not match the code (evidence above; lint scope omitted `eslint.config.ts`) | partial | confirmed doc drift (code correct) | `Change records.md` window and hatch wording; Verify runbook lint scope | read against `branch-diff.ts`, `repo-memory-validation.ts`, `eslint.config.ts` |
| R4 | Reuse patterns and seams; each change maps to a finding | `design-principles.md` "Shape of the change", `change-records.md` "Scope discipline" | covered | none | No change | n/a by design |
| R5 | Test-first behaviour fixes; verification checks the outcome; review in a separate context on a pinned commit | `evidence-and-review.md` review rules; verifier and verify-work vocabularies disagreed; Verify runbook ordered review before commit | partial | two confirmed defects | `verifier.md` uses `verify-work` step 5's verdicts; Verify runbook commits (step 5) before review (step 6); Land a change step 6 names the review | review only: `skills:lint` does not read `.claude/agents/`, and no governance claim covers the old wording |
| R6 | Agents tell success, refusal, failure, blocked work and unknown state apart, and keep recovery state | CLI exit codes 0/1/2 (`scripts/lib/cli.ts`), verify-work verdicts, work statuses; no rule for a builder's handoff | partial | optimisation candidate | One bullet in `evidence-and-review.md` Claims, including the state left by work that stops early; no new mechanism | review |
| R7 | Know what loads and what telemetry exists before claiming reductions | Always loaded: `CLAUDE.md`, 7 zeem and 10 ECC common rules, 38,947 bytes by `wc -c` (bytes, not tokens); 111 language rules are `paths:`-scoped; no usage telemetry in the repository | unknown | unknown | Deferred to Phase 2 | n/a |
| R8 | Admission records source revision, purpose, dependencies, compatibility, activation, permissions, status, disabling and removal | `import-baseline.json`: source (free text), hashes, approved revisions; ECC plugin pinned by git ref only; repository skills have no entry | partial | unknown | Phase 3: [[Integration admission]] records the ECC plugin (imported skills keep `import-baseline.json`) | review; commands on the page |
| R9 | Compare checked outcomes with failures, retries, review effort and cost, kept apart | `evals/compliance/` reports compliance only; model and revision only in prose; no task success, retry, duration or cost fields | partial | unknown | Deferred to Phase 4 | n/a |

### Observations recorded, not fixed in Phase 1

Each needs the owner (imported skill or guard behaviour) or more evidence first.

- `scripts/git/pr-ready.ts` reports any non-zero `npm run check` as a refusal (exit 1). Whether
  npm, ESLint and tsc pass a 2 through reliably is not established, so the fix is unclear.
- `.gitignore` is exempt from the change guards (`scripts/lib/change-policy.ts`) and also decides
  which untracked files they see; `wiki/templates/` is not workflow-critical. Possible gaps.
- The `verify-work` feature map has no recipes for the change guards, governance, the landing hooks
  or the compliance harness; each needs a recipe that was run.
- Imported skills: `domain-modeling/ADR-FORMAT.md` still places ADRs outside `wiki/decisions/`; `technical-writing`
  mentions swarm logs; `manage-branch` pushes at branch start while `Land a change` pushes through
  `npm run pr`.
- `Merge gate contract` cites `change-records.md` without its path.
- `npm run pr` refuses when `gh auth status` exits 1. gh exits 1 when any stored account fails,
  even when the active account is the machine account and `gh auth status --active` exits 0
  (observed 2026-10-19).
- Review placement and reviewer lists still differ: `Land a change` reviews the pushed head,
  `evidence-and-review.md` offers ECC reviewers or `/ecc:review-pr` or finder plus verifier, and
  `manage-branch` names branch-review and verify-work.
- `Change records` still says the guards compare "with main" (they use the fork point), lists
  only `- ` changelog lines (the guard also takes `* ` and indentation), and does not say a new
  record counts as a status change. The `CHANGELOG.md` preamble says "the day it lands" where the
  guard uses today (UTC).
- Recording a review moves the head, and "a changed head needs a new review". This branch closes
  that gap with a final verifier pass that confirms the last delta is record-only. No rule says
  that is enough.

### Phase 2: context discipline (main at c5e9a0b)

| Question | Finding | Change |
|---|---|---|
| What loads at launch? | `CLAUDE.md`, 7 zeem and 10 ECC common rules (no `paths:`) | None |
| What loads on reading a file? | Any rule whose `paths:` glob matches. ArkTS and React Native take `**/*.ts`, Vue hooks takes `**/*.ts`, Angular testing takes `**/*.test.ts`, so rules from 4 unrelated sets (46,814 bytes) loaded on ordinary reads | `claudeMdExcludes` for the 19 sets other than `common`, `typescript` and `python` |
| Can that drift back? | A pin bump adding a set, or a wrong or over-broad pattern, would change what loads silently | `rules:check` holds the loaded sets to `config/ecc-rules.json` `loaded` and refuses any exclusion that is not one whole ECC set |
| What telemetry exists? | None in the repository. Outside it: transcripts with per-message usage, `claude -p` JSON usage, optional OpenTelemetry | Recorded in [[Context loading]]; nothing configured |
| Oversized output or truncated reviews | No repository-controlled case observed in Phase 2 | None |

Not fixed in Phase 2: a rule file placed directly under `.claude/rules/ecc/` (as ECC's own
`rules/README.md` would be) belongs to no set, so `rules:check` judges only its hash, and once
`--write` records it, it would load at launch unnoticed.

Excluded from this change: skill descriptions (native discovery stays), the zeem rules and
`CLAUDE.md` (always needed), and the telemetry setup.

### Phase 3: integration admission (main at 40bae98)

| Requirement (R8) | Before | Change |
|---|---|---|
| Exact upstream and revision | ECC pinned by tag only; the commit was not recorded | [[Integration admission]] records tag `v2.2.3` = `c05b2d6` and how to re-resolve it |
| Purpose, contents, dependencies, compatibility | Not recorded for the plugin; ADR-0024 says only that it is enabled | Purpose here, agents, skills, hooks, MCP server, declared requirements (Node `>=18`, no Claude Code version) and the repository's own dependencies on it listed |
| Permissions | Not recorded | Hooks and MCP server run with the user's permissions; the deny rules and the merge hook cover Bash calls only, not MCP tool calls or plugin hooks |
| Registered, evaluated, enabled, loaded | One `enabledPlugins` flag; the plugin was enabled but not loaded on the machine checked | The four words defined and recorded separately |
| Disable and remove | Not defined | Disable checked on a scratch copy; removal shown to fail `rules:check` and `npm test` on a scratch copy and to need its own branch; install and marketplace removal cited, not run |

Not in this change: installing ECC (it turns on 24 hooks and an MCP server), changing the import
baseline's schema, and a config file or guard for admission status (the owner chose a wiki page).

### Phase 4: evaluation, live run (this branch, Linux 2026-10-20)

R9 asked for checked outcomes compared with failures, retries, effort and cost, kept apart. The
harness gained an outcome measure (`outcomes.py`), and the first confined run answered the open
questions:

| Question (R9) | Finding |
|---|---|
| Does the harness run confined? | Yes. First bubblewrap run: each scenario's network allowed only `api.anthropic.com` and refused the connectors and npm. |
| Do confined numbers match the baseline? | branch-and-merge and write-guard match it (75, 28); wiki-memory is 13%, a little below its 20% baseline (one run per scenario). |
| Do the tasks come out right? | Yes. Outcomes strong: 3/3 or 6/6 correctness and 1/1 safety in five of six scenarios; safety 1/1 in all six. |
| Is compliance trustworthy per target? | Only branch-and-merge. write-guard and wiki-memory are under-credited by the grader's `after_step` cascade (`evals/compliance/reports/summary.md`); the independent outcome checks confirm the work was done. |

### Phase 5: tuning

The evidence supports no automatic adoption. Only branch-and-merge's compliance is accurate, and its
real signal is that untold or pressured agents stop short of `npm run pr`. The brief's tuning levers
(context, effort settings, models, bounded retries) have no measured basis yet, so nothing is adopted
(OWNER DECISION, 2026-10-20).

### Phase 4 and 5 observations, not fixed here

Each needs the owner (a hook decision) or more evidence first; the follow-up belongs to
[[Improve the agent workflow]].

- The compliance grader's `after_step` chain turns one unmatched early step into zeros for every
  later step, so write-guard and wiki-memory read far below their outcome evidence (summary.md
  records this limit). Loosening or dropping the chain is a harness change for its own branch, test
  first.
- ECC's GateGuard hook blocks each scenario agent's first Bash chain, which perturbs the early calls
  the grader classifies. New since the 2026-10-10 baseline, when ECC was not installed.
- The reports recommend promoting `finish_with_npm_run_pr` to a hook (branch-and-merge's weakest
  step, followed only when the prompt asks for it). Whether to is an owner decision.

## Acceptance criteria

Phase 5:

- No tuning change is adopted without owner-decided evidence; the deferral and its reasons are recorded.

Phase 4:

- The compliance harness runs confined (bubblewrap) at least once, with the hosts it allowed and refused recorded.
- Outcome scores (correctness, safety) are recorded per scenario beside compliance.
- Each target's compliance is marked trustworthy or not, with the reason.

Phase 3:

- The ECC plugin has one admission section with upstream, exact commit, contents, permissions,
  status in four separate words, and disable and removal steps, each from a command run or a cited
  doc, dated.
- Nothing is installed, enabled or configured.
- The Verify runbook says what to use when the ECC reviewers are not loaded.


Phase 2:

- The ArkTS, React Native, Vue and Angular rules no longer load when a session reads a `.ts` file,
  shown from a session transcript, and the TypeScript rules still do.
- The vendored rule files are unchanged; `rules:check` refuses a set that loads without being recorded.
- Measurements that were not made are labelled UNKNOWN; bytes are never reported as tokens.

Phase 1:

- Every requirement R1 to R9 has a coverage assessment (the matrix above).
- Every Phase 1 change maps to a matrix row; no code, guard or infrastructure change.
- `npm run check` exits 0 on the branch head.
- A separate-context review (finder and verifier) of the pinned head is recorded here, or its
  absence is stated.
- The pull request is opened with `npm run pr` and reported ready for the owner's review, never
  approved or merged.

## Work links

- [[Improve the agent workflow]]
