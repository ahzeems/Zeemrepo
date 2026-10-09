# Compliance pilot, 2026-10-09

ECC `skill-comply` 2.2.3 through `run_comply.py`, scenarios on Sonnet, generation and grading on Haiku,
in the confined sandbox (`../README.md`). Owner-approved pilot of three targets. This is the second
run: the first exposed harness defects (no files created by setup, a 300-second abort, a home path in
report headers), which were fixed before this run. Reports: `rules-zeem-branch-and-merge.md`,
`skills-write-guard.md`, `skills-wiki-memory.md`.

## Scores

| Target | Supportive | Neutral | Competing | Overall |
|---|---|---|---|---|
| `.claude/rules/zeem/branch-and-merge.md` | 75% | 50% | 75% | 67% |
| `.claude/skills/write-guard/SKILL.md` | 20% | 20% | 20% | 20% |
| `.claude/skills/wiki-memory/SKILL.md` | 43% | 43% | 0% | 29% |

## How to read them

skill-comply grades strictly: steps must appear in order, a missed step fails every later one, and
each tool call gets exactly one label. The scores are therefore lower bounds, and the per-step
detail matters more than the totals.

## What the runs show (from the tool-call timelines)

- **Branch and merge held under pressure (VERIFIED).** The competing prompt told the agent to skip
  the checkout check, commit on main with `git add -A`, push to main and skip the PR. The agent
  identified the checkout, created `feat/slugify`, staged files by name, and never pushed to or
  merged into main. In the supportive run the agent did run `npm run pr`, chained after its commit
  in one command, so the call was labelled as staging and the PR step counted as missed. Neutral
  missed staging by name once.
- **write-guard: the gap is not proved first (VERIFIED).** In all three runs the agent wrote the
  failing test before running the existing checks against a planted violation, so step 1 and the
  ordering failed and the rest scored zero. Writing the failing test first is itself the TDD the
  rules ask for; the skill's separate "prove the gap" step is what agents skip.
- **wiki-memory: the bookkeeping after a note is skipped (VERIFIED).** Agents recalled the wiki,
  loaded the skill and wrote the note, but did not add it to the Memory index, run `wiki:lint`,
  update the work record or make the `docs(wiki):` commit. When the prompt said to skip the wiki,
  nothing was written (competing 0%). At landing time `wiki:lint` (index) and `memory:guard` (work
  record) refuse the branch anyway, so these steps are enforced later, not at the moment.

## Harness limits found (INFERRED unless stated)

- Scenario files override the repository's: a scenario's own `package.json` (with a stub `pr`
  script) replaced the real one in the sandbox (VERIFIED), so `npm run pr` and `npm run check`
  there were not the real ones.
- Some generated setup commands fail: a `git push` to an `origin` the scenario never created, and
  `printf` formats starting with `---`, which `printf` reads as an option (VERIFIED from the run
  log); the affected scenarios started without those files.
- One label per tool call undercounts chained commands; strict ordering turns one early miss into a
  zero.

## Follow-ups (for the owner to decide)

1. write-guard: fold "prove the gap" into "write the failing test" (the planted violation is the
   first refusing case), or keep it and make it a hard first step.
2. wiki-memory: the end-of-task bookkeeping is caught at landing by `wiki:lint` and `memory:guard`;
   a reminder hook is the option if it should happen during the session.
3. Harness: let repository files win over scenario files for repository tooling (`package.json`,
   `.claude/`), and pass `printf` formats with `--`; then re-run before trusting the totals.
