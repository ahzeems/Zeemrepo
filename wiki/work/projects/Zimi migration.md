---
type: project
title: Zimi migration
summary: The phased migration of Zimi's toolchain, wiki, skills and guards into Zeemrepo, one pull request per phase.
tags: [area/planning, tool/ecc]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: "Phase 9: with the owner's approval of the batch, run run_comply.py on the agreed targets and commit the reports to evals/compliance/reports/; low-compliance steps become write-guard candidates."
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
  - "INFERRED: proposed in docs/migration/evolve-review.md, pending the owner's merge: write-guard from two generated skills, one rule line from a third, the other 10 items rejected."
  - "VERIFIED: PR #11 merged by the owner (Phase 8 instincts, evolve review, write-guard)."
  - "OWNER DECISION: \"I recommend allowing mixed wiki/non-wiki conflict resolutions in genuine merge commits, while rejecting unrelated edits.\" (2026-10-09); wiki-compliance now allows a merge whose remerge-diff touches only files git reported as content conflicts, each hunk removing a whole marker set, deleting only inside it, and adding only lines from the two sides; octopus merges are refused."
  - "VERIFIED: PR #12 merged by the owner (resolving-merge exception, spawn aliases)."
  - "VERIFIED: Phase 9 wrapper: 7 unittest cases pass; driving ECC's real _setup_sandbox through it gave a sandbox with the rules, settings and merge hook (which blocked gh pr merge with exit 2) and no evals/ folder; no model was called."
  - "VERIFIED: after a security review showed env scrubbing was not a boundary, every ECC claude call runs under bubblewrap; a probe through the real confine() saw no gh token, SSH keys, this repository or ~/Github, gh logged out, and no secret variables, while claude still ran."
  - "OWNER DECISION: compliance pilot approved: \"Pilot: 3 targets (Recommended)\" (2026-10-09)."
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
