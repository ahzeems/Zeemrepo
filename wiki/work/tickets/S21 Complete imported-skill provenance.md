---
type: ticket
title: S21 Complete imported-skill provenance
summary: Extend approved provenance to imported companion instructions and inventory changes without rewriting landed provenance.
tags: [area/agents, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-19
agent: opencode
status: done
owner: agent
priority: P2
next_action: None. It landed as PR 58 (0358628), which also landed the inventory baseline. The Zimi-origin skills and approval reuse continue as idea notes that link this ticket.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]", "[[Skill standards]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S21, finding A20 and its S01 prerequisite."
  - "VERIFIED: gh pr view 17 on 2026-10-19 reported MERGED by the owner (merge 89f841f), so this job spec is approved; S01 has status done."
  - "OWNER DECISION: on 2026-10-19 the owner wrote, in reply to the coordinator, \"S21 baseline approved, go ahead\". The owner gave it before seeing the concrete inventory, so it authorizes starting S21 and recording a baseline; the hash list below is landed only by the owner merging the PR that adds it, and no claim is made that the owner reviewed a specific hash list."
  - "VERIFIED: at red commit 68ac45b (Claude Code, Opus 5.5) node --test on provenance, skill-lint and skill-validation tests ran 109 tests with 38 failing; a companion-only edit, an added or deleted file, unhashable files, a malformed inventory and a rewritten landed inventory produced no error from the unchanged validator."
  - "INFERRED: the migration baseline hashes the files as installed on main at 4c56101; nothing in the repository holds the original Zimi or upstream companion text, so these are not verified upstream hashes, and the reason field of each inventory says so."
  - "VERIFIED: npm run check passed inside npm run pr at d702935 (evals 108 tests OK, every guard green); the first npm run pr attempt refused because another session moved a shared ref, the second pushed and opened PR 58, whose body lists the inventory below for the owner's review."
  - "VERIFIED: 12 planted mutants of scripts/skills/provenance.ts (hash compare, added and missing file checks, safe paths, inventory history, chain continuity, UTF-8 strictness, link refusal, inventory approval, later basis, required inventory, latest record) each failed the skill tests; 12 of 12 killed."
  - "UNKNOWN: whether grill-plan, unslop, verify-work, wiki-memory and write-guard count as imported; they came from Zimi but have no baseline entry, so S21 leaves them unhashed (see Discovered work)."
  - "VERIFIED: on 2026-10-19 gh pr view 58 reported MERGED by the code owner's account as 0358628, and git merge-tree --write-tree 0358628^ 412a60e gave 0358628's own tree, so main received exactly the reviewed head 412a60e (checked by Claude Code, Opus 5.5)."
  - "INFERRED: per the final report of an independent verifier (a Claude Code verifier subagent on Opus 5.5, claude-opus-5-5, in a separate context), relayed by the coordinator on 2026-10-19 and not reproduced here, 412a60e rated PASS with no findings."
  - "VERIFIED: the owner's merge of PR 58 satisfies the fifth acceptance criterion. On 2026-10-19 gh pr view 58 reported it merged by the code owner's account, and the PR body lists the inventory baseline; under the owner-authority rule a list an agent drafts is approved only when the owner merges the PR that adds it (checked by Claude Code, Opus 5.5)."
---

## Goal

Detect unauthorized changes, additions and deletions across the complete imported instruction bundle.

## Inputs

- Plan S21, audit A20, `scripts/skills/provenance.ts`, skill validation/history tests and `import-baseline.json`.
- Read the imported companion files and their provenance notices as artifacts; do not execute user-only skills while inspecting them.

## Approach

1. Prove that changing a companion without changing SKILL.md escapes the current provenance check.
2. Define an approved file inventory/hash revision, preserving all existing landed provenance fields and revisions.
3. Validate additions, removals, content, path boundaries and approval records through `skills:lint`.
4. Establish a truthful migration baseline; do not label hashes of current files as verified original upstream hashes.

## Acceptance criteria

- [x] A valid approved inventory passes, including unchanged entry points and companions.
- [x] Changed, added or deleted imported instructions without an approved revision refuse.
- [x] Unsafe paths, symlinks, missing/unreadable files and malformed inventory cannot become a pass.
- [x] Existing landed provenance stays append-only; an authorized later revision remains possible.
- [x] The owner reviews the baseline inventory and the required actual approval evidence is recorded before landing it. The owner's words are recorded above; the owner merged PR 58, which lists the inventory, on 2026-10-19 (ticked by a later records PR).

## Out of scope

Rewriting skill methods, inventing original-source evidence or removing owner authorization requirements.

## Allowed files

- `scripts/skills/provenance*.ts`, `scripts/skills/skill-validation*.ts`, `scripts/skills/skill-lint*.ts`, `scripts/fixtures/valid/skill-lint/**`, `scripts/fixtures/broken/skill-lint/**`.
- `.claude/skills/import-baseline.json`; `config/skill-standards.json`, `scripts/skills/skill-standards.ts` and `scripts/skills/skill-standards.test.ts` only if the schema genuinely requires them.
- `wiki/reference/Skill standards.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; imported SKILL.md/companion text and landed revision history are read-only in this slice unless separately authorized.

## Human checkpoints

Verify job approval and parent completion. Obtain the required owner authorization for the actual inventory baseline/revision; do not fabricate a quote or treat an agent-authored record as the owner's words.

## Secrets needed

None; hashes and public source references only.

## Tests and evals

- `node --test "scripts/skills/*.test.ts"`; `npm run skills:lint`; `npm run check`.
- Positive: approved complete inventory and append-only authorized revision.
- Broken: companion-only edit, added/deleted file, unsafe path, unreadable content, changed landed history and missing authorization. Exercise the real CLI and history fixtures.

## Rollback and recovery

Do not remove a landed revision as rollback. Restore content through a new authorized append-only revision or repair the validator through a PR, preserving provenance history.

## Evidence

Record the inventory/source basis, changed-file refusal controls, approval evidence and independent verification without claiming unsupported upstream equivalence.

## Wiki and doc updates

Update skill standards with inventory and migration semantics, then record the accepted baseline and implementation PR in this ticket.

## Inventory baseline

OWNER DECISION, 2026-10-19: "S21 baseline approved, go ahead". Each skill's first `inventory`
record in `.claude/skills/import-baseline.json` cites this note and that quote. The hashes are
SHA-256 of each file as installed on main at 4c56101, normalized as UTF-8 with LF line endings
and no BOM. They are a migration baseline of the current files, not verified upstream hashes.
Every SKILL.md hash equals the last recorded revision (or `installedSha256`) for that skill.

12 imported skills, 15 files (12 entry points, 3 companions):

| Skill | File | SHA-256 |
|---|---|---|
| branch-review | SKILL.md | `7361e6d78641e4ffed152e04775df2d72436eee8935a247bb3d2de80577984ba` |
| bro | SKILL.md | `a40a2bcc9637c90dcf6777da90ad93434b7fe3eb1affc5b0b47a9123f3eed43a` |
| domain-modeling | SKILL.md | `3b7c408d86ea8b5fe4985347de5f5c27fe9fedf7d1952580cba1846b49c588d9` |
| domain-modeling | ADR-FORMAT.md | `50fac461b5a8e7cfe21f59c86d3799da4bc905c7c25f8e4b7aa033c995f2599b` |
| domain-modeling | CONTEXT-FORMAT.md | `17ab16ce783e4d2801ee52fd9acdf550cbf44de65ae76797a93943bbedf22a13` |
| find-deepenings | SKILL.md | `61cc3e6d5697324292523bd4f7d56b8c9be856ad782a34f35a7de1eec1610e47` |
| manage-branch | SKILL.md | `614352dda3359b88edef011ea9c9058086ad345a992ce31815279f316134b496` |
| plan-tickets | SKILL.md | `4b2d77fa882a70aa6083b2e1edc275d3c1bde0e9670d0bc73098b45bf8ff6a5f` |
| resolve-conflicts | SKILL.md | `3fd5971e20f6b3f55f559f952d39c657755ab6f9417644f34eb30835a5f5fdec` |
| teach | SKILL.md | `3c175513daa14ff0cb0c0dcf383b4c0f79458c060926bd2aa77dde42a9d48886` |
| technical-writing | SKILL.md | `66ab10979de3edac9ac1a207ea6b24a9e912a0b7cb4f174e12a9c90376ee7355` |
| wayfinder | SKILL.md | `9012b8047506322f316675e492b4fa5f11b1f8b30a3b6aebecb7a95daadee3da` |
| wayfinder | references/map-template.md | `421d6b4137a3a88e9751121ba23302cebb51457f736ad6abaee9d89a24d4852c` |
| write-plan | SKILL.md | `d3a6108cbab69b6abe725cf6b03da9b95d4ff68fc35a461262ca65b311875723` |
| write-skill | SKILL.md | `538d94d8cc237113b6e5153889590545037da646a5ee27759157e7d9ac9a3c11` |

The three companions arrived in the migration commit e87d871, and ADR-FORMAT.md changed again in
ca790ba (2026-10-09). No baseline revision covered them before S21, so this baseline accepts their
current text.

## Discovered work

- Five skills migrated from Zimi have no baseline entry: grill-plan, unslop, verify-work (with
  `references/feature-map.md`) and wiki-memory (with three files under `references/`) arrived in
  e87d871 or ec99d63, and write-guard in 5166704. Whether any of them is imported text that needs
  provenance is an owner decision; S21 did not add them.
- Approval reuse: a later inventory revision can cite this ticket and the S21 quote again, and the
  linter accepts it, because it only checks that the record holds the quote and names the skill.
  Legacy revisions had the same gap before S21. Nothing yet ties an approval to one change.
- `skills:lint` checks history only against the merge base. A branch that adds a new imported skill
  can write its own approval record, as before; a reviewer still compares each quote with the owner's
  words.
