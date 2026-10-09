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
next_action: "Phase 8: write the Zimi instincts file, import it with /ecc:instinct-import, and review /ecc:evolve output (after the skill alignment and git-state PRs)."
idea: "[[Migrate Zimi into Zeemrepo]]"
evidence:
  - "VERIFIED: PRs #1-#5 merged by the owner (audit, toolchain, shared library, wiki system, skills)."
  - "VERIFIED: Phase 5 npm run check passes: lint, typecheck, 422 tests, wiki:lint, skills:lint, governance:check, wiki:compliance, changelog:guard, memory:guard."
  - "VERIFIED: Phase 6 npm run check passes with the branch guard, worktree guard, npm run pr, landing audit, merge-blocking hook, hooks and split CI (509 tests); check workflow green on PR #7."
  - "VERIFIED: PRs #6 and #7 merged by the owner (change-record guards; git guards, split CI and merge-blocking hook)."
  - "VERIFIED: Phase 7 npm run check passes (511 tests) with CLAUDE.md, seven .claude/rules/zeem files, finder and verifier agents, 9 decisions, 23 lessons and 5 reference and runbook pages; ECC code-reviewer and a port-fidelity review findings fixed on the branch."
  - "OWNER DECISION: baseline edits to branch-review and manage-branch approved: \"Approve both (Recommended)\" (2026-10-09); merged branches from PRs #1-#7 deleted after checking each was contained in origin/main; backup branches kept."
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

- Zimi `main` moved past the audited 9fb36b2. Its new lesson "Pre-commit checks must preserve Git
  state" applies here (a hook-run fixture changed the real branch and git config); port it in the
  next phase. Its Phase B ticket fields and `ticket-session` skill belong to the autonomous-ticket
  loop, which is out of scope.
- Skill alignment: [no-doc-change: Land a change and Merge gate contract already describe npm run pr and the required check and guards CI checks; the two skills now match them]
