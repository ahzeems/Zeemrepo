---
type: runbook
title: Maintain the repository wiki
summary: Keep wiki explanations, work records, the Memory index and the changelog current in the same branch as the change, and commit wiki files alone.
tags: [area/wiki, area/docs, area/git, kind/convention]
created: 2026-09-21
updated: 2026-10-18
agent: claude-code
status: active
related: ["[[Land a change]]", "[[Change records]]", "[[Walkthroughs should not duplicate skill rules]]"]
---

## When to use

For every repository change that alters what exists, how it is operated or what was decided,
and whenever wiki content is reported stale. The wiki is the repository's shared memory:
reference notes say what exists, runbooks say how to operate it, decisions say why, and work
records hold scope and evidence. Sessions and superseded decisions are history.

## Prerequisites

- Load the wiki-memory skill (`.claude/skills/wiki-memory/SKILL.md`) before the first wiki
  write. It owns the note schema, templates, redaction checklist and commit rule; this runbook
  only sequences them.
- An identified checkout on a feature branch, per
  [[ADR-0021 Authority comes from an identified checkout]].

## Steps

1. **Identify what you are reading.** Record the branch, `HEAD` and local edits, then fetch
   before comparing with main:

   ```sh
   git status --short --branch
   git rev-parse HEAD
   git fetch origin
   git rev-list --left-right --count HEAD...origin/main
   ```

   A feature branch is expected to differ from main; it is not a copy of it. A failed fetch
   leaves remote freshness unknown, so say so instead of guessing.

2. **Update the owning explanation with the change.** Find the reference notes, runbooks and
   decisions the change affects before editing, and change them in the same branch as the
   behaviour. Keep one canonical explanation and link to it; never rewrite a session or
   decision body after its day. Supersede a changed decision with a new one.

3. **Update work state and evidence.** On the owning record under `wiki/work/`, update
   `status` or `next_action`, `updated`, dependencies and labelled `evidence`. Check the linked
   idea and project for contradictions. A merged pull request does not prove every acceptance
   criterion was met, and a builder's own status edit is not approval.

4. **Keep the Memory index current.** Every new memory note gets one line in
   [[Memory index]] under its type, with its summary. Work notes need no entry. When a note's
   summary changes, update its index line too.

5. **Validate.** Run `npm run wiki:lint` and fix every error: schema, links, tags, agents,
   evidence labels and the redaction sweep over every tracked file.

6. **Record the change.** Add a new fragment `changelog/<YYYY-MM-DD>-<slug>.md`, dated from the
   branch's first commit to today, with no post-merge facts
   ([[ADR-0027 Changelog entries are per-branch fragment files]]). [[Change records]] lists what
   each guard requires.

7. **Commit wiki files alone.** Stage files by name. Wiki files go in their own commit with a
   subject starting `docs(wiki): `; everything else goes in other commits. A new tag is
   added to the allowlist in `.claude/skills/wiki-memory/references/note-schema.md` in a commit
   of its own, before the note that uses it. Author identifiers need no registration; follow
   [[Work with any agent provider]] for attribution. The pre-commit hook refuses a mixed index, and
   `npm run wiki:compliance` refuses a branch whose history mixes them or lacks the subject. A
   merge of `main` may resolve conflicts in wiki and other files at once; every file it changes must be
   one git reported as a content conflict, and every hunk must remove a whole conflict marker set, delete nothing
   outside it and keep only lines from the two sides, so a line written during the merge, an unrelated edit, a deleted
   file or a mode change is still refused. Commit such a change afterwards, on its own. Octopus
   merges are refused: git cannot remerge them, so they cannot be judged.
   The same command compares each note at the branch's base with HEAD: `created` and `agent` never
   change, `updated` moves forward when a note is edited after the day it names, and a decision or
   session is not edited, renamed or deleted after its `created` day; only its supersession fields,
   `related` and `tags` may then change. The
   rules and their limits are in the note schema (`.claude/skills/wiki-memory/references/note-schema.md`).

8. **Land through a pull request.** Follow [[Land a change]]: `npm run pr`, the `check` and
   `guards` status checks, and the owner's merge on GitHub. Fixing a missed update later is an
   ordinary documented change, not a bookkeeping pull request.

## Verify

| Question | Evidence | Limit |
|---|---|---|
| Was the change recorded? | `npm run changelog:guard` and `npm run memory:guard` pass | Presence is not accuracy |
| Do notes validate? | `npm run wiki:lint` passes | Schema and known patterns, not meaning |
| Are commits split correctly? | `npm run wiki:compliance` passes | Judges paths and subjects |
| Is history intact? | `npm run wiki:compliance` passes; exit 2 means the history could not be read | Needs full history; commit dates are self-reported, and a `--root` lint run has no history |
| Is every memory note indexed? | `npm run wiki:lint` reports no unindexed note | An index line can still be stale |
| Are explanations and work state true? | A separate reviewer compares changed behaviour with the notes | Human or model judgment, with stated evidence |
| Did it land? | `gh pr view <N> --json state,mergedBy` shows `MERGED`; `npm run audit` passes | Says nothing about any reader's copy |
