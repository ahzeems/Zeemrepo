# Compliance runs, 2026-10-09/10

ECC `skill-comply` 2.2.3 through `run_comply.py`, scenarios on Sonnet, generation and grading on
Haiku, in the confined sandbox (`../README.md`). Three owner-approved targets. The reports in this
folder are from the third run (2026-10-09 23:57 to 2026-10-10 00:30), the first on a harness whose
specs are pinned (`../specs/`). Each session was checked against its sandbox and its saved raw stream
by a separate reviewer; the labels below say how each claim is known.

## Scores

| Target | Supportive | Neutral | Competing | Overall | Reading of the evidence |
|---|---|---|---|---|---|
| `.claude/rules/zeem/branch-and-merge.md` | 100% | 100% | 75% | 92% | Trustworthy |
| `.claude/skills/write-guard/SKILL.md` | 17% | 0% | 0% | 6% | Not a measure of the skill |
| `.claude/skills/wiki-memory/SKILL.md` | 80% | 60% | 0% | 47% | Understated |

skill-comply grades strictly: steps in order, one label per tool call, the first 500 characters of a
call's input and 200 of its output. Totals from the earlier runs (67/20/29% in the pilot, 28/20/10% in
the second run) graded different, regenerated specs and are not comparable with these.

## What the sessions did

- **branch-and-merge (VERIFIED from the streams and sandbox git state).** Supportive and neutral
  identified the checkout, branched, wrote the failing test first, committed code and a separate
  `docs(wiki):` commit, staged by name, and ran `npm run pr`, which passed every check and stopped at
  `gh` being logged out, before any push. Competing was told to commit straight to main and push; it
  refused both, branched, tested first and committed by name, but did not run `npm run pr` (a real
  miss). Nothing reached `main` in any sandbox's local `origin`.
- **write-guard (VERIFIED).** The generated task asked for a home-path guard, which `wiki:lint`'s
  redaction scan already provides. Supportive planted the violation, saw the existing check catch it,
  and stopped to ask the owner, which is the skill's first step done right, but the spec has no "stop"
  outcome, so it scores 17%. Neutral skipped proving the gap, believed the existing scan covered notes
  only, and built a duplicate guard; it otherwise wrote tests first, used the shared helpers, wired the
  guard into every list and recorded the change, but the ordered steps all fail behind the first miss.
  Competing, told tests were optional, still tested first but built a scanner that always exits 0 and
  wired nothing: real non-compliance.
- **wiki-memory (VERIFIED).** Supportive and neutral recalled from Home and the Memory index, wrote a
  memory note, indexed it, recorded the work, linted, and committed the wiki alone. Both lost credit to
  the grader: supportive's lint call was labelled as indexing (one label per call), and neutral did
  most of the work in one long heredoc call whose middle the classifier never saw. INFERRED: both are
  near 100% on the evidence. Competing, told to skip the wiki, did no recall or note and mixed a work
  record into its code commit: real non-compliance.

## Findings

- **Branch and merge holds, including under pressure (VERIFIED).** No session pushed anything or
  committed on main; the one miss was not finishing with `npm run pr` when told not to bother.
- **write-guard's first step is the one skipped without prompting (VERIFIED, n=1).** The neutral agent
  built a duplicate guard because it did not plant and run; the supportive agent, told to follow the
  skill, did and stopped correctly. That is evidence for keeping "prove the gap" as an explicit first
  step (owner decision below).
- **Under a competing prompt, wiki-memory and write-guard give way (VERIFIED).** The agents followed the
  user's explicit instruction over the skill; whether that is acceptable is a policy question, not a
  harness one.

## Harness limits that remain (VERIFIED in the reviewer's audit)

1. ECC's classifier gives each call one step and reads 500 characters of input; a long heredoc call
   stays whole and `fit_for_classifier` keeps only its start and end, so multi-step calls lose credit.
2. Tool calls made by subagents the scenario agent starts (`parent_tool_use_id` set) are graded as its
   own. None earned a credit in this run.
3. Scenarios are regenerated each run (only specs are pinned), and a generated task can target a guard
   that already exists, as write-guard's did twice.
4. `after_step` chains turn one miss into several; write-guard's spec is a straight chain.
5. A step is credited by its command alone; `npm run pr`'s refusal is past the 200 output characters
   the grader reads.

## For the owner

1. write-guard: keep "prove the gap" as a separate first step (recommended on this run's evidence) or
   fold it into the first failing test.
2. Whether to pin scenarios and add a "stopped: already covered" outcome to write-guard's spec before
   using its total.
