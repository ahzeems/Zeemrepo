---
type: ticket
title: S04 Content-sensitive working-state snapshots
summary: Detect content changes to tracked and nonignored untracked working files even when Git status text is unchanged.
tags: [area/git, area/typescript, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: done
owner: agent
priority: P1
next_action: None once the owner merges its pull request. Its child S05 Checked-commit publication invariant then has both parents, S02 and S04, complete.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S04, finding A06 and its S01 prerequisite."
  - "OWNER DECISION: job-spec approval is PR 17, merged after an APPROVED code-owner review; the owner confirmed it on 2026-10-17 (\"ive merged it\")."
  - "VERIFIED: parent S01 landed as PR 18 (875a2e8); base for this branch is 5d56a42."
  - "VERIFIED: at test commit 1c7aa55 the new git-state tests ran against the base git-state.ts and 9 failed: rewritten dirty and untracked files, executable bits on dirty and untracked files, a retargeted symlink and a file whose name holds a tab, spaces and a newline each left git status byte-identical yet passed, the secret-content rewrite passed, and an unreadable file did not error."
  - "VERIFIED: at fix commit d26cfaf node --test scripts/git/git-state.test.ts passed 42 of 42, including unchanged dirty state, ignored files, links outside the fixture never read, and a tracked directory replaced by an outside link recorded without reading."
  - "VERIFIED: an independent verifier at ba7636c rated all five criteria MET, with its own CLI probes: git status byte-identical before and after rewrites, verify exiting 1 at that head and 0 with the base code, outside files made unreadable without changing the snapshot, and npm run check leaving nothing the snapshot flags."
  - "VERIFIED: an independent finder at ba7636c reported no CRITICAL or HIGH issue. Fix commit 5060e0e addresses its MEDIUM points: a non-UTF-8 name now stops the snapshot (its test fails without the guard), files are hashed in chunks after a 2 GiB sparse file reproduced ERR_FS_FILE_TOO_LARGE, and the refusal message names editors as well as tests; whether editor files leave the snapshot is the owner decision below."
  - "VERIFIED: at 5060e0e node --test scripts/git/git-state.test.ts passed 44 of 44."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Ignore them in .gitignore (Recommended)\" for editor swap and autosave files: a separate pull request adds their patterns to .gitignore, so they leave the snapshot by the existing ignored-file rule and git-state keeps no special case."
  - "VERIFIED: a second verifier at 1e658ae rated all five criteria MET; it reproduced the non-UTF-8 pass with ba7636c's code and the refusal at 1e658ae, a 2 GiB sparse file erroring before and hashing after, and npm run check exiting 0 with 793 Node tests while the checkout's own snapshot, check and verify sequence exited 0."
  - "UNKNOWN: review of the wording-only commit after 1e658ae is pending; the PR body records it."
---

## Goal

Make state verification detect changed working contents rather than only changed status classifications.

## Inputs

- Plan S04, audit A06, `scripts/git/git-state.ts` and `git-state.test.ts`.
- Read the documented coverage boundaries in the source and the hook-state lesson.

## Approach

1. Snapshot an already-modified tracked file and an existing untracked file, then overwrite their contents without changing status codes.
2. Digest the relevant file contents with explicit mode/symlink behavior and safe path handling.
3. Preserve hashes-only output and the documented treatment of bare repositories and ignored files.

## Acceptance criteria

- [x] Dirty-to-dirty and untracked-to-untracked changes fail against the old snapshot and are detected after repair.
- [x] Unchanged state passes; creation, deletion, mode changes and symlink target changes have explicit tested behavior.
- [x] NUL-safe paths, including whitespace/control characters, are handled without following links outside the fixture.
- [x] Snapshot output/messages expose no file contents or secret-bearing configuration values.
- [x] Existing state/config/ref coverage and the full check still pass.

## Out of scope

Snapshotting ignored dependency trees, global configuration, hooks or the Git object store unless separately approved.

## Allowed files

- `scripts/git/git-state.ts`, `scripts/git/git-state.test.ts`; bounded new `scripts/git/working-tree-state*.ts` modules with sibling tests if needed.
- `wiki/lessons/Hook-run checks must preserve Git state.md`, `wiki/reference/Merge gate contract.md`, this ticket and `CHANGELOG.md`.

## Forbidden files

All other files, actual user working files and global Git settings.

## Human checkpoints

Verify job-spec approval and parent completion. Seek agreement before expanding the snapshot boundary beyond tracked/nonignored working state.

## Secrets needed

None; use generated fixture content and assert only digests and redacted diagnostics.

## Tests and evals

- `node --test "scripts/git/*state*.test.ts"`; `npm run check`.
- Positive: identical content/state, including a bare fixture where applicable.
- Broken: same porcelain output but different bytes; executable-bit and symlink changes; unreadable required input must not be a passing snapshot.

## Rollback and recovery

The checker detects damage but does not undo it. Preserve evidence and stop publication on a mismatch; restore only disposable fixtures automatically. Repair/revert code through a new PR.

## Evidence

Record before/after status equality, differing content digests, CLI exits and an independent verdict for each criterion.

## Wiki and doc updates

Update snapshot coverage statements and this ticket. Do not claim coverage of excluded state.
