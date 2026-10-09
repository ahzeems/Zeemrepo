---
name: write-skill
description: "Choose skill, agent, command, or script; author to standard and retire replacements."
---

A skill is not a document. It is three tiers loaded at three different times, and most authoring
mistakes are tier mistakes.

| Tier | Loaded | Budget | Holds |
|---|---|---|---|
| 1: frontmatter | always, at startup | ~100 tokens per skill | `name`, `description` |
| 2: `SKILL.md` body | when a route selects it | under 6,000 characters | procedure and judgement |
| 3: bundled files | only when read | zero until accessed | references, schemas, scripts |

Tier 1 is a standing tax on every session, paid whether the skill fires or not. That, not
tidiness, is the argument against a skill that "might be handy". Tier 2 is a ceiling, not a target.
When a body runs long the question is never "what do I delete?" but "which half of this was
reference material pretending to be procedure?"; move that half to `references/`, where it costs
nothing until read.

## Should it exist at all

Four questions, in order. A "no" is a stop.

1. **Is it repeated?** A one-off instruction belongs in the prompt.
2. **Is it judgement, or a procedure a script could run?** If deterministic, write the script: more
   reliable, and free at tier 3. Most of `scripts/` is the right answer to this question.
3. **Does something already own it?** Overlap is worse than absence. Search first with ECC
   `skill-scout`, across this repo's skills and the installed ECC skills. Two skills that both match a
   request means one description is wrong, and the selection is then arbitrary.
4. **Will a route select it?** Claude Code's native discovery exposes the skill through its
   description, and other skills link to it by relative path. A skill no route names is tier-1 tax
   and nothing else.

To draft a skill from this repo's git history, ECC `/ecc:skill-create` generates a starting point.
It still has to pass every rule below.

## Which of the four shapes

| Need | Shape | Why |
|---|---|---|
| Knowledge the session should hold while it works | skill | loaded into the current context, writes nothing itself |
| Work done away from the conversation | Claude Code subagent in `.claude/agents/`, or the built-in Explore or general-purpose agent | its own context and its own tool list |
| A prompt the user runs in the open | user-only skill (`disable-model-invocation: true`), run as a slash command | every edit lands where the user watches it |
| A deterministic check or transform | script in `scripts/`, with a test | it can fail `npm run check`; prose cannot |

If it writes files, prefer the command over the agent: an agent writes inside a context nobody is
reading.

## The contract

`npm run skills:lint` enforces these rules:

- Frontmatter keys are `name`, `description`, and `disable-model-invocation`, and nothing else.
- `name` equals the directory name.
- `disable-model-invocation: true` appears only on user-only skills, and every skill listed as
  `userOnly` in `config/skill-standards.json` carries it.
- For skills outside the owner-supplied baseline, the description is at most 160 characters and
  the body at most 6,000 characters.
- Every cited relative path resolves, and every `#heading` anchor exists.
- No em dashes.

The owner-supplied baseline is exempt from rewriting for metadata or size limits. Its source
hashes and owner-authorized substitutions are recorded in `.claude/skills/import-baseline.json`.
Do not invent another manifest or routing service.

The description is the only thing loaded at startup, so write it to discriminate, not to summarise:
what it does, when to reach for it, and what it is *not* when a sibling is close. The 160-character
limit is the standard here, well inside the platform's 1,024.

Provenance lives in the body, not in a `version:` field: git already records every version and
date. Cite primary sources (specifications, RFCs, source code, and this repository's own artefacts)
with the date accessed, so a stale citation is visible.

## What "tested" can mean

A document has no functions to assert against. Three honest kinds:

1. **Structural**: budget, description length, name match, cited paths exist. `npm run skills:lint`
   checks these; `npm run check` runs the rest of the repo's checks.
2. **Behavioural**: given the phrasings it claims, does the route select it, and does the session
   follow it? ECC `skill-comply` measures this with a model in the loop. Record the trial in the
   skill's wiki work record.
3. **Outcome**: does following it produce better work? An eval, and the most expensive by far.

Never prescribe a test nothing runs. A prevention that exists as a file and executes never is worse
than an acknowledged gap, because it reports green. For periodic audits of the whole skill set, use
ECC `skill-stocktake`.

## Retiring what it replaces

A new skill that leaves its predecessor in place doubles the tier-1 tax and splits the routing. In
the same PR: repoint every live reference and delete the predecessor within authorized scope.
Inspect callers before removal. Historical records (audits, root-cause entries, dated baselines)
are left exactly as written; they describe what was true then.

## Who may promote

Judgement and write capability never live in the same component. The rule comes from an imported
agent that both decided what to change and made the change, and lost data doing it. An agent may
draft a skill. Only the owner approves, by merging the PR on GitHub. Record acceptance in the owning
wiki work record; no ledger or promotion manifest is assumed.
