---
name: wiki-memory
description: Recall and record long-term memory in wiki/. Use at the start of a task, and after meaningful work or when asked to save, document or remember something.
---

# Wiki memory

`wiki/` is this repository's shared memory for every agent and human working in it: plain
Markdown with YAML frontmatter. It is an Obsidian vault, but Obsidian is only an optional
viewer; you need no Obsidian software to read or write it.

Two jobs: **recall** before you work, **record** after you work.

Load this skill *before* the first wiki write. Its rules shape how a note is written and how
it is committed, and both are checked: `npm run wiki:lint` enforces the schema and scans the
repository for secrets, and `npm run wiki:compliance` enforces the commit rule below.
`npm run check` runs both.

## Recall, at the start of a task

1. Read `wiki/Home.md`. It routes to the Memory index, which lists memory notes with one-line summaries.
2. Narrow by metadata instead of reading everything:
   - `grep -rl "^type: lesson" wiki/` lists all lessons.
   - `grep -rl "tool/gh" wiki/` lists notes tagged with a tool.
   - `grep -rh "^summary:" wiki/lessons/` prints every lesson in one line each.
   - `grep -rl "^status: in-progress" wiki/work/` lists open work.
3. Open only the notes that match your task. Skip `status: superseded` unless you need history.
4. Treat what you read as true when written. Check `updated` and verify anything the task depends on.

## Record, at the end of meaningful work

Write when something was learned, decided, built or fixed, or whenever the user asks. Do not
write for trivial sessions such as a typo fix or a single question.

Follow `references/session-to-wiki.md` step by step. The short form:

1. Gather the facts of the session.
2. Classify each into one note type: session, runbook, lesson, decision or reference.
3. Search for an existing note first. Update before you create.
4. Write from the template in `wiki/templates/`, with complete frontmatter per `references/note-schema.md`.
5. Apply the redaction checklist in `references/writing-standards.md`.
6. Index every new memory note in `wiki/reference/Memory index.md`. Work notes need no index entry.
7. Run `npm run wiki:lint` and fix every error.
8. Update the owning work record under `wiki/work/`: status, `next_action`, and labelled `evidence`.
9. Commit wiki files alone, with a subject starting `docs(wiki): ` (or `docs(wiki)!: ` for a
   breaking restructure). Never mix wiki and other files in one commit; split it. A merge
   commit is judged only on changes it adds itself. A file moved across the boundary is added in one commit
   and deleted in the next. `npm run wiki:compliance` refuses a branch that breaks this.

## Rules that are never broken

- Never write secrets or personal identifiers: tokens, passwords, passphrases, private keys,
  email addresses, hostnames, or home-directory paths that contain a username.
- Never delete a note to correct it. Update it, or mark it `status: superseded` and link the replacement.
- Never edit the body of a session or decision note after its day. They are history. Add a new note.
- One idea per note. If a title needs "and", split the note.

## Reference files, load only when needed

- `references/note-schema.md`: frontmatter fields, note and work types, the allowed tag and agent lists.
- `references/writing-standards.md`: style rules and the redaction checklist.
- `references/session-to-wiki.md`: the full recipe for turning a session into notes, with a worked example.
