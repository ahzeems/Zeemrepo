# Compliance evals

Measures whether agents follow this repository's rules and skills, with ECC `skill-comply`
(plugin 2.2.3). For each target file, skill-comply writes a spec of expected steps, generates
three scenarios (supportive, neutral and competing prompts), runs `claude -p` on each, and grades
the tool calls.

`run_comply.py` wraps it, because skill-comply on its own runs each scenario in an empty
directory and so measures Claude's defaults, not these rules. The wrapper:
- copies a snapshot of the committed repository (without `evals/`) into each scenario sandbox
  after ECC's own setup, keeping any file the scenario created;
- runs every `claude` call ECC makes (scenarios, spec and scenario generation, classification)
  under bubblewrap, with credential stores (`~/.config/gh`, `~/.ssh`, `~/.gnupg`, `~/.aws`,
  `~/.docker`, `~/.kube`, gcloud, `~/.git-credentials`, `~/.netrc`, `~/.npmrc`, `~/.pypirc`), this
  repository, `~/Github`, Claude session transcripts and `/run/user/<uid>` masked by empty mounts;
- passes an allowlisted environment (path, home, locale, terminal, XDG and Anthropic auth only), an
  empty `gh` config, no global git config and a fixed sandbox author;
- writes each report to `reports/<path-derived name>.md`, for example `rules-zeem-branch-and-merge.md`.

**What it does not hide.** Claude's own login under `~/.claude` stays readable, because `claude`
needs it; a scenario agent could read that token. Anything else in the home directory that is not in
the masked list is readable too, so keep secrets in the listed stores or add their path to
`MASKED_DIRS` or `MASKED_FILES` in `run_comply.py`. bubblewrap must be installed (`bwrap`).

## Setup (once)

```bash
python3 -m venv ~/.cache/zeemrepo/comply-venv
~/.cache/zeemrepo/comply-venv/bin/pip install "pyyaml==6.0.2"
```

The venv lives outside the repository, because the governance and redaction checks scan the working
tree. `npm run evals:test` tests the wrapper with the standard library only,
so the check needs no venv and makes no model calls.

## Run

```bash
# Spec and scenarios only: two calls to the generation model, no scenario runs
~/.cache/zeemrepo/comply-venv/bin/python evals/compliance/run_comply.py .claude/rules/zeem/branch-and-merge.md --dry-run

# Full run: three scenario sessions on --model (default sonnet, up to 30 turns each),
# plus generation and classification calls
~/.cache/zeemrepo/comply-venv/bin/python evals/compliance/run_comply.py .claude/skills/write-guard/SKILL.md
```

A full run uses model time; get the owner's approval for a batch before starting it. Scenario
sandboxes live under `/tmp/skill-comply-sandbox/`.

## Reading results

A report gives the compliance rate per scenario, the spec, the prompts and each tool call with
its classification. Low-compliance steps are candidates for a hook or a check (the
`write-guard` skill), not for more prose. `seeds.md` holds realistic prompts from Zimi's eval
cases for judging whether the generated scenarios are realistic.

**Known limit.** skill-comply grades tool calls, so it sees what an agent did, not what it said:
"tell the owner only they can merge" is judged by the absence of a merge call, not by the words.
