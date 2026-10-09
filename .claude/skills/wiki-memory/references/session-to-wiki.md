# Session to wiki: the recipe

How to turn a working session into wiki notes. Follow the steps in order.

## 1. Gate

Write if any of these is true:
- The user asked for it.
- Something was built, installed, configured or fixed.
- A decision was made that a future reader would otherwise question.
- A trap cost real time and could be hit again.

Otherwise stop. An empty vault entry is worse than none.

## 2. Gather facts

Go back through the session and list, in plain bullets:
- **Asked:** what the user wanted, in their words.
- **Done:** each action that changed something, with the command or file.
- **Failed:** each error, its exact text, its real cause and what fixed it.
- **Decided:** each choice between alternatives, and why.
- **Verified:** what was tested and how. Also what was not.
- **Open:** anything left unfinished or deferred.

Use only what actually happened. Do not fill gaps with guesses.

## 3. Classify

Sort every bullet into exactly one note type.

| The fact is... | Note type |
|---|---|
| The story of this session | one `session` note, always exactly one |
| A repeatable procedure | `runbook` |
| A failure with a cause and a fix | `lesson`, one per trap |
| A choice between alternatives | `decision`, one per choice |
| A stable fact: versions, layout, conventions | `reference` |

The session note stays short. It tells the story and links out to the lessons, decisions and runbooks, which hold the detail.

For ongoing idea-to-execution work, also update the existing linked work records using
note-schema.md. A session records what happened; it does not replace the
idea, project, map, plan, ticket, specification, or research note. Link them in metadata
only where they support ownership or retrieval; avoid duplicate prose links.

## 4. Search before writing

For each planned note, search the vault for the topic:

```bash
grep -ril "<keyword>" wiki/ --include="*.md"
```

- An existing lesson, runbook or reference covers it: update that note, set `updated`, and add to it.
- An existing decision is being reversed: write a new decision, then set the old one to `status: superseded` with `superseded_by`.
- Nothing exists: create a new note.

## 5. Write

Copy the matching file from `wiki/templates/`. Fill every frontmatter field per `note-schema.md`. Keep the required section headings. Write the `summary` last, once you know what the note says.

## 6. Redact

Apply the checklist in `writing-standards.md`. Read every code block twice.

## 7. Index

Add one line per new memory note to the right section of `wiki/reference/Memory index.md`.
Home keeps only the high-level routes. Work records are found by type and status, so
update their metadata instead of keeping a second work list.

For a memory note:

```markdown
- [[Note title]] - the summary, or a shorter version of it
```

Update affected current notes after each meaningful code or documentation slice. Record
one session note after meaningful work. Record observed results with their review status,
and state a pending review rather than delaying the note.

## 8. Lint

```bash
npm run wiki:lint
```

Fix every error. Do not commit with a failing lint.

## 9. Commit

Stage only wiki files. If the tag or agent list changed, commit `.claude/skills/wiki-memory/references/note-schema.md` first, on its own; `npm run wiki:compliance` refuses a commit that mixes `wiki/` with any other path.

```bash
git add .claude/skills/wiki-memory/references/note-schema.md   # only when the list changed
git commit -m "docs(wiki-memory): allow tag <tag>"
git add wiki/
git commit -m "docs(wiki): <what was recorded>"
```

Never combine wiki changes and code changes in one commit.

## Worked example

Session: an agent set up a dev machine and a repository. Along the way, `gh` was "not found" because the user was in a root shell, and a package manager was chosen.

Result:
- `sessions/<date> Dev machine setup.md` tells the story in a few short sections and links to everything below.
- `lessons/Root shell hides user-installed tools.md` holds the error text, the cause, the fix and how to apply it next time.
- `decisions/ADR-NNNN <package manager> is the package manager.md` records why it was chosen.
- `runbooks/Set up a dev machine.md` holds the clean, repeatable steps.
- `reference/Toolchain.md` lists what is installed and where.

Five kinds of knowledge, five places. A future agent that hits "gh: command not found" finds the lesson by tag or by grep without reading the whole story.
