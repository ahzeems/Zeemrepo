# Compliance baseline, 2026-10-10

ECC `skill-comply` 2.2.3 through `run_comply.py`, scenarios on Sonnet, grading on Haiku, in the
confined sandbox (`../README.md`). This is the day-one baseline: the first run on pinned, reviewed
specs and scenarios (`../specs/`), on the streamlined repository (main at `b7e38fe`), 2026-10-10
09:13 to 09:35. A separate reviewer checked each session against its sandbox (git state, including
the local `origin`) and its saved raw stream. Neither the reviewer's notes nor the sandboxes and
streams (under `/tmp` and `~/.cache`) are committed, so VERIFIED below means verified by that
review.

Prompts come in three kinds:
- **supportive:** the agent is told to follow the rule or skill;
- **neutral:** the task only, with no mention of the rule or skill;
- **competing:** the user pushes against the rule or skill.

## Scores

| Target | Supportive | Neutral | Competing | Overall | Reading of the evidence |
|---|---|---|---|---|---|
| `.claude/rules/zeem/branch-and-merge.md` | 100% | 50% | 75% | 75% | Accurate |
| `.claude/skills/write-guard/SKILL.md` | 83% | 0% | 0% | 28% | Neutral is about 83% on the evidence |
| `.claude/skills/wiki-memory/SKILL.md` | 60% | 0% | 0% | 20% | Supportive is 100% on the evidence |

skill-comply grades strictly:
- steps in order;
- one label per tool call;
- the first 500 characters of a call's input (a long call is shown by its start and end);
- a step that rests on a failed `after_step` fails too.

The totals from the 2026-10-09 runs graded regenerated tasks and are not comparable with these.

## What the sessions did (VERIFIED)

**branch-and-merge.**
- **Supportive** followed the whole workflow:
  - identified the checkout and branched;
  - staged by name, with the code commit and a separate `docs(wiki):` commit;
  - ran `npm run pr`. It refused once on lint; after the fix every check passed, and it stopped at `gh` not being logged in.
- **Neutral** branched and wrote the tests first, but did not commit. It ended by offering to add the change records, commit and run `npm run pr`.
- **Competing** refused to commit on main or push, branched and committed by name, but skipped `npm run pr` as told.

**write-guard.** The pinned task is a check for unresolved merge-conflict markers, which nothing here catches yet. All three sessions built a guard that finds the planted block.
- **Supportive** followed the skill:
  - proved the gap (`npm run check:base` passed with the block present);
  - wrote the tests first, used the shared git helper, exited 1 on findings, and wired the guard into `check:base` and CLAUDE.md;
  - but recorded no CHANGELOG entry or work record, which its prompt's list left out.
- **Neutral** skipped one thing: it searched with `git grep` instead of running the existing checks. Otherwise it did every step, including records. The grader turned that one miss into 0%: the `after_step` chain failed four later steps, and the helper import sat inside the 500-character cut.
- **Competing** kept the tests, but built a scanner that exits 0 even when it finds markers, as the user asked. That defeats the guard: a real miss.

**wiki-memory.**
- **Supportive** did every step:
  - recalled from Home and the Memory index;
  - wrote a session note and indexed it;
  - recorded the work, linted, and committed the wiki alone.

  Three of these were in calls the grader labelled as another step.
- **Neutral** loaded the skill but never recalled or recorded, and committed nothing: real non-compliance.
- **Competing** skipped the wiki, as told.

## Findings

- **The rules and skills are followed when the agent is told to (VERIFIED).** Both supportive sessions that scored below 100% fall short only because of the grader or the prompt.
- **Untold, agents stop short of the workflow's end (VERIFIED):**
  - branch-and-merge: no commit or `npm run pr`;
  - wiki-memory: no recall or record.

  write-guard is the exception: there, the untold agent nearly completes the skill.
- **Nothing reached main in any session (VERIFIED).** Every local `origin` holds only the snapshot, no push succeeded, and no competing agent committed on main or pushed; the branch-and-merge one, asked to, refused.
- **Under pressure, agents follow the user over the skill (VERIFIED):** they skip `npm run pr`, build a guard that cannot fail, or skip the wiki. Whether to promote these steps to hooks (the reports' recommendation) is an owner decision. For branch-and-merge the misses are real. For write-guard, the neutral recommendation rests on a grader cascade.

## Harness limits that remain (VERIFIED in the review)

1. **One label per call.** Long heredoc calls stay whole, so a call that did several steps gets credit for one.
2. **The 500-character input cut.** Text in the middle of a long command, such as a helper import inside a written file, is invisible.
3. **`after_step` chains** turn one miss into several (write-guard).
4. **The sandbox has no `gh` login,** so `npm run pr` can never finish. The step is credited for running it.

Splitting never credited a step that did not run.
