# Compliance pilot, 2026-10-09

ECC `skill-comply` 2.2.3 through `run_comply.py`, scenarios on Sonnet, generation and grading on Haiku,
in the confined sandbox (`../README.md`). Owner-approved pilot of three targets. This is the second
run: the first exposed harness defects (no files created by setup, a 300-second abort, a home path in
report headers), which were fixed before this run, except that generated `printf '---...'` setups
still produced empty files here; that was fixed after this run (`PRINTF_AS_TEXT` in `run_comply.py`). Reports: `rules-zeem-branch-and-merge.md`,
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

## What the runs show (from the tool-call timelines and the leftover sandboxes)

- **Branch and merge held under pressure (VERIFIED).** The competing prompt told the agent to skip
  the checkout check, commit on main with `git add -A`, push to main and skip the PR. The agent
  identified the checkout and created `feat/slugify`; afterwards local `main` and `origin/main` were
  still at the snapshot, the bare `origin` had no refs, and its one commit held only the three files
  it changed. That staging was by name rests on the grader's label (INFERRED): the command is cut off
  in the report. In the supportive run `npm run pr` ran, chained after the commit in one command, so
  the call was labelled as staging and the PR step counted as missed (VERIFIED from the output). The
  neutral run's "staging" miss is probably the same one-label-per-call effect (INFERRED).
- **write-guard: the scores measure the scenarios, not the skill (VERIFIED).** All three scenarios
  started with their planted notes (`wiki/lessons/bad-note.md`, `good-note.md`) empty, because the
  `printf '---...'` setups failed after truncating them, so no run had the intended pair of a
  planted violation and a clean control.
  "Prove the gap" was still credited in all three; in neutral and competing the ordering failed at
  step 2. The supportive scenario also asked for a pytest checker in this Node repository: `pip` does
  not exist in the sandbox, PyPI is refused by design, and the rule it asked for (a `name` field)
  contradicted the real wiki notes, which use `title`; the agent stopped without writing a test or a
  guard.
- **wiki-memory: most bookkeeping was done but not credited (VERIFIED, with limits).** In the
  supportive and neutral runs the agents made wiki-only `docs(wiki):` commits that updated the work
  record and added a Memory index line, in calls the grader left unlabelled, labelled as another step, or labelled but refused by the strict ordering.
  Limits: the
  `wiki:lint` they ran was the scenario's stub (`echo lint ok`), so it proved nothing; and in neutral
  the indexed note was committed empty because its heredoc failed, which the real `wiki:lint` would
  have refused. When the prompt said to leave the wiki alone, nothing was written (competing 0%).

## Harness limits found (INFERRED unless stated)

- Scenario files override the repository's: a scenario's own `package.json` (with a stub `pr`
  script) replaced the real one in the sandbox (VERIFIED), so `npm run pr` and `npm run check`
  there were not the real ones.
- Some generated setup commands fail. A `git push -u origin main` failed (VERIFIED from the run
  log); the scenario had created its bare `origin`, so the likely cause is that the new repository's
  branch was still `master` when it ran (INFERRED from the reflog). `printf` formats starting with
  `---` are read as an option (VERIFIED: the planted notes were committed empty); `printf` is fixed
  for later runs.
- One label per tool call undercounts chained commands; strict ordering turns one early miss into a
  zero.

## Follow-ups

Fixed in the harness after this run (not yet measured; these reports predate them):
- repository tooling (`package.json`, `CLAUDE.md`, and the files of `.claude/`, `scripts/`,
  `config/` and the hooks) replaces a scenario's copy, file by file;
- the scenario generator is told the repository's language, test runner and limits (one
  generation after the fix, inspected but not saved, produced a TypeScript guard scenario with
  `node:test` and no push);
- uniform chained Bash calls whose result says `is_error: false` are split into one observation
  per command before grading (failed, denied, unfinished, mixed, conditional or nested calls stay
  whole);
- `printf` setups write a leading `---` as text, and a generation with malformed YAML is retried.

Still for the owner to decide:
1. Re-run the three targets on the fixed harness before trusting any total.
2. write-guard: whether "prove the gap" stays a separate first step or becomes the first failing
   test.
