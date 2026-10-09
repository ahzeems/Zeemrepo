---
name: write-skill
description: "Choose skill, agent, command, or script; author to standard and retire replacements."
---

A skill is not a document. It is three tiers loaded at three different times, and most authoring
mistakes are tier mistakes.

| Tier | Loaded | Budget | Holds |
|---|---|---|---|
| 1 — frontmatter | always, at startup | ~100 tokens per skill | `name`, `description` |
| 2 — `SKILL.md` body | when a route selects it | under 6,000 characters | procedure and judgement |
| 3 — bundled files | only when read | zero until accessed | references, schemas, scripts |

Tier 1 is a standing tax on every session, paid whether the skill fires or not — that, not
tidiness, is the argument against a skill that "might be handy". Tier 2 is a ceiling, not a target.
When a body runs long the question is never "what do I delete?" but "which half of this was
reference material pretending to be procedure?"; move that half to `references/`, where it costs
nothing until read.

## Should it exist at all

Four questions, in order. A "no" is a stop.

1. **Is it repeated?** A one-off instruction belongs in the prompt.
2. **Is it judgement, or a procedure a script could run?** If deterministic, write the script: more
   reliable, and free at tier 3. Most of `scripts/` is the right answer to this question.
3. **Does something already own it?** Overlap is worse than absence. Two skills that both match a
   request means one description is wrong, and the selection is then arbitrary.
4. **Will a route select it?** Native discovery exposes the skill; AGENTS.md and the wiki skill matrix describe its use. A skill no
   route names is tier-1 tax and nothing else.

## Which of the four shapes

| Need | Shape | Why |
|---|---|---|
| Knowledge the session should hold while it works | skill | loaded into the current context, writes nothing itself |
| Work done away from the conversation | native subagent; `.opencode/agents/` in OpenCode | its own context and its own `permission:` block |
| A prompt the user runs in the open | native command, if the harness provides one | every edit lands where the user watches it |
| A deterministic check or transform | script in `scripts/`, with a test | it can fail the gate; prose cannot |

If it writes files, prefer the command over the agent: an agent writes inside a context nobody is
reading.

## The contract

Frontmatter carries `name` and `description`, and nothing else. `name` equals the directory name.
Project-specific selection and roles live in AGENTS.md and the wiki skill matrix.
Do not invent another manifest or routing service. The owner-supplied baseline is exempt
from rewriting for metadata or size limits; see AGENTS.md.

The description is the only thing loaded at startup, so write it to discriminate, not to summarise:
what it does, when to reach for it, and what it is *not* when a sibling is close. Keep it under 160
characters — the standard here, well inside the platform's 1,024.

Provenance lives in the body, not in a `version:` field: git already records every version and
date. Cite primary sources — specifications, RFCs, source code, and this repository's own artefacts
— with the date accessed, so a stale citation is visible.

## What "tested" can mean

A document has no functions to assert against. Three honest kinds:

1. **Structural** — budget, description length, name match, cited paths exist. Inspect these directly; the supplied baseline records source hashes and allowed interface substitutions.
2. **Behavioural** — given the phrasings it claims, does the route select it? Needs a model in the
   loop; record an actual model trial in its wiki work record; no eval runner is assumed.
3. **Outcome** — does following it produce better work? An eval, and the most expensive by far.

Never prescribe a test nothing runs. A prevention that exists as a file and executes never is worse
than an acknowledged gap, because it reports green.

## Retiring what it replaces

A new skill that leaves its predecessor in place doubles the tier-1 tax and splits the routing. In
the same change: repoint every live reference, delete the predecessor within authorized scope,
and update AGENTS.md and the wiki skill matrix. Inspect callers before removal. Historical
records — audits, root-cause entries, dated baselines — are left exactly as written; they describe
what was true then.

## Who may promote

Judgement and write capability never live in the same component — the rule comes from an imported
agent that both decided what to change and made the change, and lost data doing it. An agent may
draft a skill. Only the owner approves and merges the PR on GitHub. Record acceptance in the owning wiki work record; no ledger or promotion manifest is assumed.
