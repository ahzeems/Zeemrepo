# Compliance evals

Measures whether agents follow this repository's rules and skills, with ECC `skill-comply`
(plugin 2.2.3). For each target file, skill-comply writes a spec of expected steps, generates
three scenarios (supportive, neutral and competing prompts), runs `claude -p` on each, and grades
the tool calls.

`run_comply.py` wraps it, because skill-comply on its own runs each scenario in an empty
directory and so measures Claude's defaults, not these rules. The wrapper:
- tells ECC's scenario generator what this repository is (TypeScript on Node, `node:test`, no pip
  and no network for packages), so scenarios fit it, and retries a generation whose YAML does not
  parse;
- runs each scenario's setup commands through a confined `sh -c` (so redirections and heredocs
  create files, and a `printf` format starting with `---` is text);
- copies a snapshot of the committed repository into each scenario sandbox after that setup
  (never `reports/` or `seeds.md`, so neither earlier scores nor the expected behaviours leak in);
  the repository's tooling (`package.json`, `CLAUDE.md`, and the files of `.claude/`, `scripts/`,
  `config/` and the hooks) replaces a scenario's copy file by file, and other scenario files are
  kept;
  links one read-only copy of `node_modules`, and commits it as `main` with `origin/main` set, so
  `npm run check` passes there as it does here;
- runs every process ECC starts (setup commands, the baseline commit, scenario runs, generation and
  classification) under bubblewrap built as an allowlist: an empty home, a private `/tmp`, pid
  namespace and session, read-only `/usr`, `/etc`, `/opt` and `/home/linuxbrew`, a fresh Claude
  config per call holding only the login (deleted when the run ends), the installed plugins
  read-only, and write access only to the working directory; it refuses to start if `bwrap` is
  missing or a trivial confined command fails;
- passes an allowlisted environment (path, home, user, shell, locale, terminal, time zone and
  Anthropic auth only), an
  empty `gh` config, no global git config and a fixed sandbox author;
- gives every confined process its own empty network namespace with no resolver; the only way out
  is a proxy on the host (`netproxy.py`, reached through a unix socket bound into the sandbox) that
  tunnels HTTPS to exactly `api.anthropic.com` and `platform.claude.com` (login refresh) and refuses everything
  else, including `mcp-proxy.anthropic.com` (the owner's claude.ai connectors: mail, drive, docs),
  the internet and this machine's loopback services; it caps connections and drops clients that
  stall, and each run prints the hosts it allowed and refused;
- splits a uniform chained Bash call (all `&&`, or all `;` and newlines) into one observation per
  command before grading, because ECC labels each tool call with a single step. It splits only a
  call whose result in the session stream says `is_error: false` (ECC drops that flag, so the
  wrapper reads it alongside ECC's parser); a call that failed, was denied or blocked by a hook,
  timed out, has no result or ran in the background (`run_in_background`, or output saying so)
  stays whole. So does a chain unless every part starts, plainly written, with an ordinary
  command from `SPLITTABLE_COMMANDS` (`git`, `npm`, `gh`, `ls`, ...): a denylist of builtins
  kept missing ways to stop the shell early (`e"xit"`, `$'exit'`, `command .`, `shopt -o noexec`,
  `hash -p`, aliases). A mixed chain (`a && b; c` exits 0 even when `b` never ran), any `$`,
  backtick, heredoc or backslash, and, outside quotes, `||`, a lone `&`, `if`/`for`, subshells
  and comments also keep it whole. This is meant to keep splitting from crediting a step that
  never ran; it under-credits other chains, the grader can still mislabel a whole call, and a `;`
  chain credits every part even if one of them failed or was not found. It assumes a cooperative
  agent: one that rewrites Claude Code's shell snapshot under its sandbox `~/.claude` (sourced
  before every Bash call) or puts a fake `git` early in `PATH` can still be credited for a step
  that did not run;
- replaces any symlink a scenario planted on a tooling path (the file or a directory above it), so
  the real file is written in place and never through the link;
- writes each report to `reports/<path-derived name>.md`, for example `rules-zeem-branch-and-merge.md`.

**Accepted exposure.** The scenario agent can read Claude's login token, because claude needs it,
but can only send it to the Anthropic API. It cannot see other credentials, this repository, other
checkouts, the parent session's sockets or the real home directory, and nothing it writes outside
its working directory survives the run. bubblewrap must be installed (`bwrap`).

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
