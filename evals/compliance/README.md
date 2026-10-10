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
  (never `reports/` or `specs/`, so neither earlier scores nor the expected behaviours
  leak in). The repository's tooling (`package.json`, `CLAUDE.md`, and the files of `.claude/`,
  `.github/`, `.githooks/`, `scripts/` and `config/`) replaces a scenario's copy file by file, and
  other scenario files are kept. It links one read-only copy of `node_modules` and commits the tree
  as `main`, so `npm run check` passes there as it does here;
- runs every process ECC starts (setup commands, the baseline commit, scenario runs, generation and
  classification) under bubblewrap built as an allowlist: an empty home, a private `/tmp`, pid
  namespace and session, read-only `/usr`, `/etc`, `/opt` and `/home/linuxbrew`, a fresh Claude
  config per call holding only the login (deleted when the run ends), the installed plugins
  read-only, and write access only to the working directory; it refuses to start if `bwrap` is
  missing or a trivial confined command fails;
- passes an allowlisted environment (path, home, user, shell, locale, terminal and time zone
  only; no API key, since the run uses a private copy of the Claude login), an empty `gh` config,
  no global git config and a fixed sandbox author;
- gives every confined process its own empty network namespace with no resolver; the only way out
  is a proxy on the host (`netproxy.py`, reached through a unix socket bound into the sandbox) that
  tunnels HTTPS to exactly `api.anthropic.com` and refuses everything
  else, including `platform.claude.com` (login refresh) and `mcp-proxy.anthropic.com` (the
  owner's claude.ai connectors: mail, drive, docs),
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
- writes each report to `reports/<path-derived name>.md`, for example `rules-zeem-branch-and-merge.md`;
- pins each target's spec in `specs/<report name>.json` and its three scenarios in
  `specs/<report name>.scenarios.json` (generated on the first run, then reused; a generation that
  does not parse is never pinned), because ECC writes new ones every run and totals over different
  steps or tasks cannot be compared. The pinned files are reviewed like code and excluded from the
  sandbox snapshot. Where the pins differ from what the generator wrote: branch-and-merge's spec
  has no `report_ready_never_approved` (a claim in the final message, which tool-call grading
  cannot see); wiki-memory's spec makes `index_memory_note` optional (only a new memory note needs
  an index line) and has no `after_step` links the skill does not impose, which demoted a done step
  whenever an unrelated one was missed; wiki-memory's scenario setups only create `scripts/text`
  (the generated ones overwrote the real wiki with toy copies); and write-guard's supportive prompt
  names `check:base`, as the skill's wiring step does. The CHANGELOG records when each changed;
- gives a sandbox a local bare `origin` (inside `.git`) with `main` pushed, so `npm run pr` can fetch
  and push there (it still stops at `gh`, which is logged out);
- shows the grader a split chain's output only on its last command, and a long Bash call as its start
  and end, because ECC's classifier reads only the first 500 characters of an input;
- saves each session's raw stream to `~/.cache/zeemrepo/comply-runs/` (outside the repository) for
  auditing outputs, splits and error flags;
- gives each call a copy of the login without its refresh token, and refuses to start unless the
  access token has at least an hour left. On 2026-10-09 the re-run's claude calls began failing
  as the token reached its expiry, with `platform.claude.com` allowed, and the owner's own Claude
  then needed a new login; the likely cause is a sandboxed refresh rotating the refresh token.

**Accepted exposure.** The scenario agent can read Claude's short-lived access token (never the
refresh token), because claude needs it, but can only send it to the Anthropic API. It cannot see other credentials, this repository, other
checkouts, the parent session's sockets or the real home directory, and nothing it writes outside
its working directory survives the run. bubblewrap must be installed (`bwrap`).

## Setup (once)

```bash
python3 -m venv ~/.cache/zeemrepo/comply-venv
~/.cache/zeemrepo/comply-venv/bin/pip install "pyyaml==6.0.2"
```

The venv lives outside the repository, because the governance and redaction checks scan the working
tree. `npm run evals:test` tests the wrapper with the standard library only,
so the check needs no venv and makes no model calls. These Python files are the repository's one
exception to TypeScript: ECC's skill-comply is Python, and the wrapper patches it in-process. They are
outside `npm run lint`, `typecheck` and coverage; `evals:test` is their only check.

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
`write-guard` skill), not for more prose.

**Known limit.** skill-comply grades tool calls, so it sees what an agent did, not what it said:
"tell the owner only they can merge" is judged by the absence of a merge call, not by the words.
