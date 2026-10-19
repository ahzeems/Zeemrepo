---
type: project
title: Agent workflow improvement
summary: Requirement-to-evidence assessment of the agent workflow (R1 to R9) and its five owner-gated phases; Phase 1 fixes task entry, review order and verdict wording.
tags: [area/agents, area/planning]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews and merges the Phase 1 pull request; Phase 2 (context discipline) branches from main only after that merge.
idea: "[[Improve the agent workflow]]"
evidence:
  - "VERIFIED: baseline is main at f0f82cdfaf974867615cbbae52d3ec5c6160e8b0 (git rev-parse HEAD and origin/main, 2026-10-19), clean tree, one worktree, no other branches and no open pull requests (gh pr list)."
  - "VERIFIED: grep -rli sandcastle over the tree (excluding node_modules and .git) returns nothing, so the earlier plan's Sandcastle files are absent and were not recreated."
  - "VERIFIED: before this branch, verifier.md returned PASS or FAIL with per-criterion VERIFIED/INFERRED/UNKNOWN labels while verify-work, which says it can run as the verifier agent, defined VERIFIED/NOT_VERIFIED/INCONCLUSIVE and met/not_met/needs_human."
  - "VERIFIED: before this branch, the Verify a repository change runbook reviewed before committing, against evidence-and-review.md's rule to review a pinned commit; Land a change named no review step."
  - "VERIFIED: branch-diff.ts branchBase takes the earlier of the fork point's commit date and the branch's author dates, and repo-memory-validation.ts counts a no-doc-change hatch anywhere outside code in any changed work record; Change records.md described both more narrowly."
  - "VERIFIED: npm run check exits 0 at d91f4ac on Node 24.22.0 (580 node tests and 56 evals tests pass; every guard passes)."
  - "VERIFIED: the read-only verifier agent, in a separate context, reran npm run check at d91f4ac (exit 0) and returned VERIFIED with all five criteria met; its one finding (the R7 row said 112 path-scoped rule files, git ls-tree gives 111) is corrected in this record."
---

Use evidence and owner decisions; do not invent approval.

## Outcome

Agents working in this repository state what a task must achieve before they edit, read the code,
tests and callers it touches, keep changes small, verify the outcome in a separate context on a
pinned commit, and report each step as done, refused, failed, blocked or not run.

## Scope

Five phases, one branch and one pull request each, each starting from main after the owner merges
the one before: `improve/phase-1-agent-foundation`, `improve/phase-2-context-discipline`,
`improve/phase-3-integration-admission`, `improve/phase-4-evaluation`, `improve/phase-5-tuning`.
Phase 1 audits R1 to R6 and assesses R7 to R9 only for what later phases depend on. Out of scope in
every phase: a new harness, orchestration framework, skill library, retry or checkpoint
infrastructure, paid or live model runs without the owner's approval, and changes to imported skills
without an approval quoted in the revision record.

### Requirement-to-evidence matrix (main at f0f82cd)

| ID | Requirement (observable outcome) | Evidence before Phase 1 | Coverage | Finding | Phase 1 change or reason for none | Verified by |
|---|---|---|---|---|---|---|
| R1 | A consequential task states outcome, scope, acceptance criteria and open questions; small, settled tasks stay light | Fragments only: acceptance criteria at verification time (`Verify a repository change` step 1), "small, settled" undefined (`Idea to execution`), owner questions marked awaiting input (`owner-authority.md`) | missing | optimisation candidate | First bullet of `design-principles.md` "Before writing"; a small, settled change states it in one plan line | `governance:check`, review; prose cannot prove agents comply |
| R2 | Read implementation, tests and direct callers first; re-read changed or truncated evidence | `design-principles.md` named importers and callers, not tests or re-reads | partial | optimisation candidate | Same file: tests added, re-read rule for changed or truncated reads; no read limits | review |
| R3 | Rules, skills, docs and checks agree; one home per rule | CLAUDE.md `check` list, CI job names and guard lists match `package.json` and the workflows; three doc statements did not match the code (evidence above; lint scope omitted `eslint.config.ts`) | partial | confirmed doc drift (code correct) | `Change records.md` window and hatch wording; Verify runbook lint scope | read against `branch-diff.ts`, `repo-memory-validation.ts`, `eslint.config.ts` |
| R4 | Reuse patterns and seams; each change maps to a finding | `design-principles.md` "Shape of the change", `change-records.md` "Scope discipline" | covered | none | No change | n/a by design |
| R5 | Test-first behaviour fixes; verification checks the outcome; review in a separate context on a pinned commit | `evidence-and-review.md` review rules; verifier and verify-work vocabularies disagreed; Verify runbook ordered review before commit | partial | two confirmed defects | `verifier.md` uses `verify-work` step 5's verdicts; Verify runbook commits (step 5) before review (step 6); Land a change step 6 names the review | `skills:lint`, `wiki:lint`, review |
| R6 | Agents tell success, refusal, failure, blocked work and unknown state apart, and keep recovery state | CLI exit codes 0/1/2 (`scripts/lib/cli.ts`), verify-work verdicts, work statuses; no rule for a builder's handoff | partial | optimisation candidate | One bullet in `evidence-and-review.md` Claims, including the state left by work that stops early; no new mechanism | review |
| R7 | Know what loads and what telemetry exists before claiming reductions | Always loaded: `CLAUDE.md`, 7 zeem and 10 ECC common rules, 38,947 bytes by `wc -c` (bytes, not tokens); 111 language rules are `paths:`-scoped; no usage telemetry in the repository | unknown | unknown | Deferred to Phase 2 | n/a |
| R8 | Admission records source revision, purpose, dependencies, compatibility, activation, permissions, status, disabling and removal | `import-baseline.json`: source (free text), hashes, approved revisions; ECC plugin pinned by git ref only; repository skills have no entry | partial | unknown | Deferred to Phase 3 | n/a |
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

## Acceptance criteria

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
