---
name: wiki-memory
description: Read and write this repository's long-term memory, an Obsidian vault in wiki/. Use at the start of any task to recall past sessions, lessons, decisions and runbooks. Use at the end of meaningful work, or when the user says "save this to the wiki", "document this", "remember this" or "write up what we did", to turn the session into wiki notes.
---

# Wiki memory

`wiki/` is an Obsidian vault and the shared memory of every agent and human working in this repository. It is the `wiki/` folder of an identified checkout, never the loose copy at the bare repository root (ADR-0021), and it is the source of truth whatever reads it; Obsidian is an optional viewer, which ADR-0011 settles. A convenience copy drifts. It is plain Markdown with YAML frontmatter. You need no Obsidian software to use it.

Two jobs: **recall** before you work, **record** after you work.

For the complete authoring-to-reader path, follow
[Maintain the repository wiki](../../../wiki/runbooks/Maintain%20the%20repository%20wiki.md).
It distinguishes recorded content, landed content, and what a viewer actually serves.

Load this skill *before* the first wiki write, not after. Its rules shape how the note is
written and how it is committed, and both are checked: `npm run wiki:lint` enforces the schema,
and `npm run wiki:compliance` enforces the commit rule below.

## Recall, at the start of a task

1. Read `wiki/Home.md`. It routes to the Memory index, which lists memory notes with one-line summaries, and to Project hub for work records.
2. Narrow by metadata instead of reading everything. Example searches:
   - `grep -rl "^type: lesson" wiki/` lists all lessons.
   - `grep -rl "tool/gh" wiki/` lists notes tagged with a tool.
   - `grep -rh "^summary:" wiki/lessons/` prints every lesson in one line each.
3. Open only the notes that match your task. Skip notes with `status: superseded` unless you need history.
4. Treat what you read as background that was true when written. Check the `updated` date and verify anything the task depends on.

For a controlled edit-capable run, give admission only bounded, revision-pinned pointers to the
required canonical notes and their Git blob IDs. Do not copy note bodies into the manifest or
create another index or memory store. The manifest schema is closed; unknown top-level, pointer,
remote, or finding fields refuse rather than being discarded. Reconcile historical claims with
current Git and runtime
evidence. Missing required context, conflicting active records, or pointer drift produces an
actionable refusal or planning finding before the editing client starts; do not guess.
The read-only coordinator records required roles and unresolved finding IDs in the manifest.
Admission refuses an omitted owning record, an omitted acceptance source, or any reported
missing or contradictory context. It validates pointers; it does not infer prose semantics.
After setup and worktree verification, admission validates the same pinned pointers again
immediately before launch.

## Record, at the end of meaningful work

Write when the task is complete and something was learned, decided, built or fixed, or whenever the user asks. Do not write for trivial sessions such as a typo fix or a single question.

Follow `references/session-to-wiki.md` step by step. The short form:

1. Gather the facts of the session.
2. Classify each into one note type: session, runbook, lesson, decision or reference.
3. Search for an existing note first. Update before you create.
4. Write from the template in `wiki/templates/`, with complete frontmatter per `references/note-schema.md`.
5. Apply the redaction checklist in `references/writing-standards.md`.
6. Index every new memory note in the Memory index (`wiki/reference/Memory index.md`), which Home routes to. Project hub and the work views list work notes without an index entry.
7. Run `npm run wiki:lint` and fix every error.
8. Record the landing: a dated entry in the vault changelog, the owning work record under `wiki/work/` updated with verification evidence, and its status or next action. When a requirement or workflow changed, the work record names the affected skills and the change made, or `no skill change: <reason>`. `npm run memory:guard` refuses a branch without them; `npm run wiki:lint` owns whether those notes match this schema, and runs on the same path.
9. Commit wiki files alone, with a message starting `wiki:`. Never mix wiki and code changes in one commit. `npm run wiki:compliance` refuses a branch that breaks this. There are no exceptions: a commit that would mix them is split into two commits, and a file moved across the boundary is added in one commit and deleted in the next.

A refused run receives no write capability merely to record memory. It returns neutral refusal
evidence to the authorized coordinator, which updates an existing owning record through this
governed workflow when a durable update is required.

## Rules that are never broken

- Never write secrets or personal identifiers: tokens, passwords, passphrases, private keys, email addresses, hostnames, or home-directory paths that contain a username.
- Never delete a note to correct it. Update it, or mark it `status: superseded` and link the replacement.
- Never edit the body of a session or decision note after its day. They are history. Add a new note instead.
- One idea per note. If a title needs "and", split the note.

## Reference files, load only when needed

- `references/note-schema.md`: frontmatter fields, the five note types, the allowed tag list.
- `references/writing-standards.md`: style rules and the redaction checklist.
- `references/session-to-wiki.md`: the full recipe for turning a session into notes, with a worked example.
