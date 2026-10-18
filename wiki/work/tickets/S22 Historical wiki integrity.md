---
type: ticket
title: S22 Historical wiki integrity
summary: Enforce protected historical note bodies and immutable author/creation fields while allowing documented same-day and supersession updates.
tags: [area/wiki, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P2
next_action: None once the owner merges PR 48; the discovered work below is for the coordinator to file.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S22, finding A21 and its S01 prerequisite."
  - "VERIFIED: job-spec approval is PR 17 and parent S01 is PR 18, both MERGED by the owner's account (gh pr view, 2026-10-18); S01 is status done on main. The branch starts from origin/main a6b69c5."
  - "VERIFIED: fixtures are disposable repositories from scripts/test-support/repo-fixture.ts. The base commit and the notes' created and updated are 2026-10-01; later edits are commits dated 2026-10-05. Each fixture commit object is written with git hash-object naming author and committer dates at 12:00 +0000, so the verdict does not depend on the day CI runs (test code may not set GIT_ variables, per fixture-env.test.ts; the first helper did, and npm run check refused it)."
  - "VERIFIED: at red commit f6abdc1, node --test scripts/wiki/wiki-history.test.ts failed 17 of 26 cases against a typed stub (case counts here exclude the three parent test groups that node --test also counts). wiki:compliance exited 0 for a later decision or session body rewrite, a later summary change, created or agent changed, created removed, updated left at 2026-10-01 after a 2026-10-05 edit, updated moved backwards, a later rename, a rename with a rewritten body, a later deletion and a move out of wiki/."
  - "VERIFIED: at commit 2cd4ad4, wiki-history.test.ts passes 31 of 31 cases and node --test scripts/wiki/*.test.ts reports 231 of 231 tests passing (node's count, parents included). Three further cases were red before their fixes: a later merge that only resolves a conflict, a later clean merge of main into the same note (both wrongly dated the edit), and a later merge that writes its own session line (escaped while merges were skipped)."
  - "VERIFIED: with the hash-object helper (commit after 9235da0), the 31 cases run against the base code of f6abdc1 fail 19 and pass 12, and pass 31 of 31 against the implementation."
  - "VERIFIED: 19 planted mutations of wiki-history.ts and wiki-compliance.ts, run one at a time against wiki-history.test.ts, were all caught after one added test, and again all 19 after the helper change. The first run caught 18 of 19; dropping the rule that a later status change must be superseded survived, and the added case fails with that mutant."
  - "VERIFIED: survey, read-only, in a disposable clone of main: each of 63 first-parent commits judged as a one-commit branch against its first parent. 9 would have been refused and none was unverified. Two changed a ticket's agent from opencode to claude-code (5385769 S06, 5530475 S25); seven left updated behind on runbooks, Merge gate contract or Memory index. Nothing on main is rewritten, and a branch is judged only on its own changes, so main's current notes pass."
  - "INFERRED: most of the seven updated findings are squash merges dated on landing day, so the survey dates may be later than the branch's real edit dates."
  - "VERIFIED: standalone limits. node scripts/wiki/wiki-lint.ts --root has no history and cannot check these rules; wiki:compliance exits 2 in a shallow clone and when an earlier decision or session's frontmatter cannot be read."
  - "VERIFIED: npm run pr from this worktree at 9cd9d6d ran npm run check green (1132 of 1132 Node tests, 60 Python tests) and was refused four times: at 9235da0 the first run failed fixture-env.test.ts and reported refs changed; three unchanged reruns at 9cd9d6d reported refs changed (the last also branch.<...>.merge config), while 10 other worktrees shared .git. A run of wiki-history.test.ts alone left every ref unchanged."
  - "INFERRED: the coordinator reports that it reran npm run pr unchanged at 9cd9d6d; the first attempt refused on refs changed and the second pushed and opened PR 48."
  - "OWNER DECISION: on 2026-10-18 the owner chose \"Also allow related and tags\" (question dialog asked by the coordinator and relayed to this agent). After its day a decision or session may also change related and tags."
  - "OWNER DECISION: on 2026-10-18 the owner chose \"Leave as claude-code\" for the agent field of S06 and S25 (relayed by the coordinator). The two agent changes found by the main-history survey are accepted as history; those tickets are not changed."
  - "VERIFIED: at red commit deac30e, wiki-history.test.ts failed 1 of 33 cases (a later related and tags change on a decision was refused); at 183cf21 it passes 33 of 33. A later title change stays refused."
  - "VERIFIED: 22 planted mutations, run one at a time against wiki-history.test.ts at 183cf21, were all caught, including dropping related, dropping tags, and adding summary or title to the allowed set (1 failing case each)."
  - "INFERRED: review round one, relayed by the coordinator: the independent verifier rated PR 48 at 793ed0e PASS on every criterion and reported LOW findings: a backdated merge could hide later parents, the author-versus-committer and rename-path dating were untested (two mutants survived), an updated date in the future passed, and the ticket counted failures inconsistently. It also reported the conflict with main 024d415 in note-schema.md."
  - "VERIFIED: merged origin/main 024d415 (PRs 44 to 47) at 4135973, keeping both sides' lines in note-schema.md (S20's section paragraph and this branch's history paragraph); the separating blank line is its own commit. wiki:compliance passes on the merged head."
  - "OWNER DECISION: on 2026-10-18 the owner chose \"Keep agent fixed (Recommended)\" (question dialog, relayed by the coordinator). S09 and S23 stay as they are on main (claude-code, changed by PRs 45 and 47, like S06 and S25); from now on agent stays the note's creator, builders name themselves in evidence lines, and the guard stays as written."
  - "VERIFIED: survey extended in a disposable clone with GitHub's main: PR 45 (13c3b11, S09 ticket) and PR 47 (024d415, S23 ticket) would have been refused for the agent change from opencode to claude-code; PRs 44 and 46 have no history findings; open PR 49 (head bdea98a, base a6b69c5) passes the history check."
  - "VERIFIED: at red commit 6b05351, wiki-history.test.ts failed 3 of 39 cases: a commit dated on the note's day above a later parent, a backdated merge above later parents, and an updated of 2027-01-01 after a 2026-10-05 edit. The author-versus-committer and rename-path cases passed already; they pin behaviour. At fdc5c13 all 39 pass, and node --test scripts/wiki/*.test.ts reports 261 of 261."
  - "VERIFIED: 27 planted mutations, run one at a time at fdc5c13, were all caught (at least 1 failing case each), including the review's surviving two: dating by author date only, and by committer date only (1 case each), dating a rename only by its old path (1), dating by the commit alone instead of its ancestors (2), and dropping the future-updated refusal (1)."
  - "UNKNOWN: commit dates are self-reported by the committer, so a single forged commit with no later parent can still move an edit onto a note's created day. Independent verification of this branch's head is pending."
---

## Goal

Make the existing historical-note and immutable-field rules mechanically verifiable against Git history.

## Inputs

- Plan S22, audit A21, wiki rules, note schema and current wiki-compliance/history helpers.
- Read existing immutable-date/author statements and permitted supersession behavior; use parsed frontmatter.

## Approach

1. Build dated disposable history demonstrating currently accepted forbidden changes.
2. Compare the relevant historical record/body and immutable fields with explicit date and rename semantics.
3. Wire enforcement into the canonical check path and explain standalone/no-history validation limits.

## Acceptance criteria

- [x] Valid same-day changes and permitted supersession metadata updates pass.
- [x] Later decision/session body rewrites, original author/creation-date changes and required update-date omissions refuse.
- [x] Rename/deletion/history-boundary controls cannot silently bypass protection; legitimate documented migration cases have explicit behavior.
- [x] Missing/unreadable required history produces an unverified/error outcome rather than a false pass.
- [x] Canonical checks run the history control; current legitimate notes still pass.

## Out of scope

Rewriting real historical notes, changing the immutability policy or trusting timestamps/approval claims without the specified evidence.

## Allowed files

- `scripts/wiki/wiki-compliance*.ts`, `scripts/wiki/wiki-validation*.ts`, and bounded new `scripts/wiki/wiki-history*.ts` with sibling tests.
- `scripts/lib/frontmatter.ts`, `scripts/lib/git.ts` and their sibling tests only if a required reusable capability is missing.
- `package.json`, `.github/workflows/guards.yml` and `CLAUDE.md` only if a separate canonical guard is necessary.
- `.claude/skills/wiki-memory/references/note-schema.md`, `wiki/runbooks/Maintain the repository wiki.md`, `wiki/runbooks/Verify a repository change.md`, `.claude/skills/verify-work/references/feature-map.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; especially real historical session/decision bodies, original author fields and real Git history used as test data.

## Human checkpoints

Verify approval and parent landing. A legitimate correction that conflicts with the policy needs an owner decision or a superseding note, not an undocumented exception.

## Secrets needed

None; use synthetic notes, identities and commit dates.

## Tests and evals

- `node --test "scripts/wiki/*.test.ts"`; `npm run wiki:lint`; `npm run wiki:compliance`; `npm run check`.
- Positive: same-day body edit and later permitted supersession.
- Broken: later body edit, immutable-field change, unchanged required update date and rename/deletion escape. Inject/control time so CI day changes do not alter the verdict.

## Rollback and recovery

Repair the guard on a new PR if it rejects legitimate history. Preserve original note bodies; record corrections through the repository's supersession method rather than resetting history.

## Evidence

Record fixture commit/date relationships, exact changed fields, red/green exits, standalone limits and independent verification.

## Wiki and doc updates

Document which command enforces each history rule and its boundaries. Update this ticket without rewriting historical evidence to improve the result.

## Discovered work

- **Deleting ordinary notes is not checked.** The wiki-memory skill says never delete a note to
  correct it; the guard only refuses deleting decisions and sessions after their day.
- **Self-reported dates.** Edit dates come from commit metadata. Binding them to something the
  committer cannot set (for example the PR's push time) would need GitHub data.
