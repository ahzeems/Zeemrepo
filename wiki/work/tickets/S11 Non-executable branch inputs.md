---
type: ticket
title: S11 Non-executable branch inputs
summary: Keep branch and ref inputs as data when preparing review diffs and logs, including Git-valid shell metacharacters.
tags: [area/git, area/agents, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges this PR after independent review. The SDK's own shell use of branch names and the docker path are listed under Discovered work.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S08 Testable coordinator entry point]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S11, finding A12 and its S08 prerequisite."
  - "VERIFIED: job-spec approval is PR 17 (gh pr view 17 on 2026-10-18: MERGED); parent S08 landed as PR 39 (85a8a32) and its ticket is status done. The branch starts from origin/main caa99e3. Work by claude-code (Claude Opus 5.5)."
  - "VERIFIED: read @ai-hero/sandcastle 0.12.0 dist/index.js. substitutePromptArgs marks the prompt file's !`...` blocks, then replaces {{KEY}} inside them with raw values; preprocessPrompt runs each marked block through sandbox.exec, which the docker and podman providers run as sh -c. createSandbox's sandbox.run sets TARGET_BRANCH to the host's current branch (git rev-parse --abbrev-ref HEAD) and SOURCE_BRANCH to the sandbox branch. A non-zero exit fails the run with PromptError."
  - "VERIFIED: reproduction with the real SDK (createSandbox plus noSandbox, the real .sandcastle/review-prompt.md, a fake agent, a fixture repo under the temp dir and a throwaway GIT_CONFIG_GLOBAL): with the host branch feat/$(touch${IFS}s11-sentinel) the review block ran and created s11-sentinel in the sandbox worktree, then git diff failed with exit 128."
  - "VERIFIED: red commit 1311a50: node --test scripts/sandcastle/review-input.test.ts failed 9 of 10. The $(...) host branch created .sandcastle/worktrees/sandcastle-issue-1/s11-sentinel-dollar; for ;, | and & the shell ran touch as a separate command (stderr: touch: cannot touch 's11-sentinel-semi...sandcastle/issue-1'); the backtick name truncated the block to git diff feat/; feat/it's\"quoted\" gave sh: Unterminated quoted string; the prompt guard reported TARGET_BRANCH and BRANCH in a shell block. coordinator.test.ts and coordinator-entry.test.ts each failed 1 (the BASE prompt argument)."
  - "VERIFIED: at dcaf9ed review-input.test.ts passed 10 of 10, coordinator 20 of 20, coordinator-entry 12 of 12, run-result 13 of 13; for the ordinary branch and all six metacharacter host branches the prepared prompt holds the candidate's +line in the diff and its commit in the log, and no sentinel file exists anywhere under the fixture. git config --global --get-all safe.directory on the host lists no fixture path afterwards."
  - "VERIFIED: red commit 404ef02 then 9c453cd: a checkout whose branch lost its commit failed as a git merge-base error (phase sandbox) before; it now fails the reviewer phase with 'the checked-out branch has no commit to review against' and no reviewer runs. coordinator.test.ts 21 of 21 at 9c453cd."
  - "VERIFIED: mutation runs, one file at a time: prompt diff block back to {{TARGET_BRANCH}}...{{BRANCH}} failed 7; log block using {{BRANCH}} failed 1; coordinator dropping BASE failed 7 (review-input) and 1 (coordinator); object-id check accepting anything failed 1; coordinator turning a refusal into no-work survived at dcaf9ed and failed 1 after 404ef02; removing the no-work ancestor check survived (no test pinned it, also before this branch) and failed 1 after 404ef02's new test. 6 of 6 killed at the final head."
  - "VERIFIED: at ab833b1 npm run check exited 0: 1259 of 1259 tests, all files at 99.08% lines and 91.48% branches (review-input.ts 100% and 100%, coordinator.ts 99.20% and 94.57%), 73 evals tests, and every lint, wiki, skills, governance, rules, compliance, changelog and memory guard. No live model call: the agent is a fake and npm run sandbox:smoke (Docker) did not run here."
  - "INFERRED: per the coordinator's relay, the independent verifier passed PR 50 at 95d8717 with one MEDIUM, that the runbook's 'any name Git accepts' overclaimed given the SDK's own shell commands, and measured 91.46% branches overall at 95d8717 (91.48% above is this agent's run at ab833b1). The runbook line now claims only the review prompt and recommends keeping shell characters out of the host branch name."
  - "INFERRED: the docker provider resolves the commit ids the same way the old prompt resolved branch names, because the sandbox worktree shares the host repository's objects and refs; this branch ran only the noSandbox provider, so the docker path is not exercised."
---

## Goal

Prevent branch names from becoming executable shell syntax while preparing the intended diff and log.

## Inputs

- Plan S11 and audit A12; inspect the pinned SDK's argument substitution/preprocessing and the review prompt.
- Read the landed coordinator seam and `scripts/sandcastle/branch-guard.ts`.

## Approach

1. Use Git-valid special-character refs and a harmless sentinel in disposable fixtures to reproduce the current substitution.
2. Prefer argument-vector Git calls or verified commit identities over interpolating branch text into shell code.
3. Test the complete preparation path and document any deliberate input refusal.

## Acceptance criteria

- [x] The old preparation path fails a harmless substitution control before the repair.
- [x] Ordinary refs still produce the intended diff/log for the captured commits.
- [x] Git-valid metacharacter/quoting inputs either remain safe data or are explicitly refused before execution; none execute or silently change meaning.
- [x] A failed or missing ref does not become a misleading empty successful review.
- [x] Actual preparation tests and the full check pass without live model calls.

## Out of scope

General shell parsing, GitHub issue mutation and unrelated branch-lifecycle policy.

## Allowed files

- `.sandcastle/review-prompt.md`, `.sandcastle/main.ts` only for wiring, `scripts/sandcastle/coordinator*.ts`.
- `scripts/sandcastle/branch-guard.ts`, `scripts/sandcastle/branch-guard.test.ts`; bounded new `scripts/sandcastle/review-input*.ts` with sibling tests if needed.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; no sentinel or adversarial Git configuration in the real checkout.

## Human checkpoints

Verify approval and S08 landing. Seek owner agreement before broadening branch-name restrictions beyond what the fix requires.

## Secrets needed

None. Sentinels are harmless fixture-local files or captured output.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run check`.
- Positive: ordinary refs yield correct content and identity.
- Broken: command substitution, quotes and other legal metacharacters; assert no sentinel execution and no truncated/substituted ref. Use the real preparation code, not only a standalone escaping helper.

## Rollback and recovery

On uncertainty, refuse preparation with a named reason rather than executing an unsafe fallback. Preserve fixture evidence and repair/revert through a PR.

## Evidence

Record valid-ref checks, captured Git arguments/results, sentinel observations and independent verification.

## Wiki and doc updates

Replace stale branch-name guidance with the implemented contract and record this ticket's actual limits.

## Implemented contract

- The review prompt's shell blocks are `git diff {{BASE}}...{{CANDIDATE}}` and
  `git log {{BASE}}..{{CANDIDATE}} --oneline`. `scripts/sandcastle/review-input.ts` resolves BASE
  as the checkout's `HEAD^{commit}` with an argument-vector git call and refuses unless BASE and
  CANDIDATE are full object ids. The no-work check compares the candidate with the same BASE.
- No branch name reaches a shell block. The issue branch stays in the prompt's prose as text; the
  host branch name is no longer used. No branch name is refused, so no owner agreement on new
  restrictions was needed.
- A checkout with no commit fails the reviewer phase with a named reason. A commit the sandbox
  cannot resolve makes the SDK's git call exit non-zero, which fails the reviewer phase.
- `review-input.test.ts` checks every `.sandcastle/*.md` prompt: a shell block may substitute only
  BASE or CANDIDATE.

## Discovered work

- The SDK builds some host and sandbox shell commands from branch names itself, for example
  `git merge "${resolvedBranch}"`, `git rev-list "${baseHead}..refs/heads/${targetBranch}"` and
  `git config --global --add safe.directory "${sandboxRepoDir}"` (dist/chunk-VOG34SRF.js and
  dist/index.js, 0.12.0). Double quotes do not stop `$(...)`. The coordinator only hands it
  `sandcastle/issue-<N>` names (plan-schema.ts), so the host branch name is the only free input.
  For a non-isolated sandbox, `run()` (the planner and merger) defaults to the head strategy,
  where `resolvedBranch` is the host branch (dist/index.js:987 and 1064, confirmed by the
  independent verifier and reread on 2026-10-18). Whether a shell command then runs with that
  name on the docker path has not been tested. The runbook tells operators to keep shell
  characters out of the host branch name until this is settled. Deciding whether to refuse
  them is an owner decision (it broadens branch restrictions).
- With the noSandbox provider the SDK runs `git config --global` on the host, which would change
  the user's global git config. The new test isolates it with a temporary GIT_CONFIG_GLOBAL; any
  other noSandbox use needs the same care.
- The no-work ancestor check had no test before this branch (a planted removal survived); one is
  added here.

