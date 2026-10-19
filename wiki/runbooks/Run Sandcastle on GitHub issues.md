---
type: runbook
title: Run Sandcastle on GitHub issues
summary: Run npm run sandcastle so Docker-sandboxed Claude agents plan, implement, review and merge issues labelled Sandcastle onto your branch, without pushing or closing anything.
tags: [area/agents, area/github, tool/claude-code, kind/setup]
created: 2026-10-13
updated: 2026-10-19
agent: claude-code
status: draft
related: ["[[Land a change]]", "[[Verify a repository change]]", "[[Sandcastle runs under the repository rules]]"]
---

> **Status:** draft. Written by an agent from the tracked `.sandcastle/` files and the Sandcastle
> 0.12.0 README. The image build and the loop itself were not run while writing it; each item
> below says whether it was observed.

Facts captured 2026-10-13 from `@ai-hero/sandcastle` 0.12.0 (`node_modules/@ai-hero/sandcastle/README.md`)
and `.sandcastle/main.ts`. Re-check with `npm ls @ai-hero/sandcastle` and that README after an upgrade.

## When to use

Sandcastle is a library that runs Claude Code agents inside Docker containers and returns their
commits on git branches. `npm run sandcastle` runs `.sandcastle/main.ts`, which hands the real
SDK to the loop in `scripts/sandcastle/coordinator.ts`. The loop repeats three phases, at most
10 rounds:

1. **Plan.** One agent reads the open issues of `Zimfra/software_testing` that carry the
   `Sandcastle` label and picks the ones no other open issue blocks. Each gets the branch name
   `sandcastle/issue-<number>`. Every other issue goes in the plan's `blocked` list with the
   numbers of the open issues blocking it, and gets no sandbox, branch or agent. When the planner
   cannot tell, it lists the issue as blocked; it never picks the least-blocked issue to keep the
   run busy (S10). An issue whose branch is already merged into the branch you ran
   from is skipped and the log says so (`scripts/sandcastle/already-done.ts`).
2. **Implement, then review.** For each planned issue, a sandbox on that branch runs the
   implementer (up to 100 iterations). When the branch then holds commits the branch you ran
   from lacks (this round's work or work left from an earlier round), its tip is the candidate
   and a reviewer runs once on the same branch. The reviewer is read-only and must end with a
   `<review>` verdict naming the candidate's full SHA. Only the last block counts; a trailing
   unclosed block or a repeated key makes the verdict malformed. Issues run in parallel.
   The reviewer's prompt shows `git diff <base>...<candidate>` and the matching `git log`, where
   the base is the commit your branch's HEAD points at and both are full commit ids
   (`scripts/sandcastle/review-input.ts`, S11). Sandcastle runs those prompt lines with `sh -c`,
   so they carry no branch name. If HEAD has no commit, the issue fails in the reviewer phase
   with that reason and no reviewer runs. Sandcastle also builds some of its own git commands
   from branch names, and for the planner and merger that name is your branch's; whether shell
   characters in it run there is not yet established. Until it is, keep your branch name free of
   `$`, backticks, quotes, `;`, `|`, `&` and other shell characters.
3. **Merge.** One agent merges only the issues whose review passed for their exact candidate,
   into the branch you ran from, runs `npm run typecheck` and `npm run test`, and comments on
   each issue. The coordinator then checks that the branch holds each reviewed commit and that
   no issue branch moved after its review.

Each issue ends a round with one outcome (`scripts/sandcastle/run-result.ts`, S09):

| Outcome | Meaning |
|---|---|
| `blocked` | The planner listed the issue as blocked by the named open issues. No worker started; a later round or run plans it again. Each new plan replaces earlier blocked results, so an issue a later plan no longer lists stops counting. A blocked declaration never replaces an outcome the issue already has from being worked, such as `held`. |
| `no-work` | The branch holds nothing the branch you ran from lacks; nothing to review. |
| `failed` | The sandbox, implementer or reviewer threw; the phase and error are logged. |
| `held` | The review failed, was missing or malformed, named another commit, or the reviewer changed the branch. The issue is not merged. A later round reviews the tip again with a fresh reviewer only if the planner plans the issue again. |
| `eligible` | The review passed for the exact, unchanged candidate; the issue goes to the merger. An issue still `eligible` at the end of a run was never merged and counts as outstanding. |
| `integrated` | The reviewed commit is in the branch you ran from and the issue branch still points at it. |
| `not-integrated` | The review passed, but the merger did not merge that commit or the branch moved after review. |

The run is `complete` (exit 0, `All done.`) only when the planner returns no issue and no issue's
latest outcome is `blocked`, `failed`, `held`, `eligible` or `not-integrated`. An empty queue is
`complete`. A run left only with `blocked` issues ends `blocked` (exit 2): nothing failed, but the
blocked work was not done, and the last lines name each issue and its blockers. Otherwise it ends
`incomplete` (exit 2) and names each such issue, blocked ones included, or after round 10 with
work still planned. A planner or merger that
throws ends the run `failed` (exit 2) instead of crashing. On `main` or a detached HEAD it is
refused (exit 1). These outcomes are claims of the loop, not verification: a passing verdict is
the reviewer agent's word, and the merger may commit a fix after a merge that nobody reviews.
Trusted verifier receipts and retry state are later audit work (S15, S17).

What it does not do: it never pushes or opens a pull request, and its prompts tell it not to
close issues. It does post a comment on each issue it merged, which notifies that issue's
subscribers; that is the only notification, and its prompts, not the code, keep it to that. An issue is done when the owner merges its pull request
(see [[Land a change]]), so a person pushes the integration branch and runs `npm run pr`, or
runs the loop through `npm run sandcastle:afk` (below), which does that landing step.

Use it for small, well-specified issues. Rules the agents follow are in `CLAUDE.md` and
`.claude/rules/zeem/`; the prompts point there instead of restating them.

## Prerequisites

- Docker running; Node from `.nvmrc` and `npm ci` done on the host.
- The `Sandcastle` label exists on the repository and is on the issues to work.
- `.sandcastle/.env` (git-ignored; copy `.sandcastle/.env.example`) holding, by name only:
  `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token` on the host; it should start with
  `sk-ant-oat`) or `ANTHROPIC_API_KEY`, and `GH_TOKEN`.
- The `GH_TOKEN` is a fine-grained token limited to this one repository with **Issues** read and
  write. Grant no Contents and no Pull requests permission: the agents must not be able to push
  or open a pull request, and [[ADR-0025 Agents use a machine account and the owner approves]]
  keeps merging with the owner.
  Create it signed in as the machine account, with the organisation as **Resource owner**, and
  check it with the steps under "Token setup" below before the first run.
- On a new token, run the read check from "Token setup" (step 5) and, with the owner's approval
  of the comment, its write check (step 6) before the first loop. The read check shows only
  which account the token belongs to, so a token that reads issues but cannot write them passes
  it and answers 403 only when an agent tries to comment, after the agents have already done
  their work.
- The sandbox image built once, and again after any `.sandcastle/Dockerfile` change:
  `npx sandcastle docker build-image`. It passes your user and group ids so the image user
  `agent` matches your host user (README, "sandcastle docker build-image").

## Steps

1. Start from a fresh feature branch, never `main`. The plan and merge phases work in your own
   checkout, so the merge commits land on whatever branch is checked out.
2. Commit or set aside your own changes first; the merge agent works in your working tree.
3. Run `npm run sandcastle`. Logs go to `.sandcastle/logs/` and worktrees to
   `.sandcastle/worktrees/`; both are git-ignored.
4. The loop stops when the planner returns no issue to work on (`No unblocked issues to work on. Exiting.`,
   or `No unblocked issues to work on: <n> blocked. Exiting.` when it listed blocked issues),
   after round 10, or when the planner or merger fails. Anything but `All done.` and exit 0
   means work is left: the last lines name each issue and its outcome.
5. Review what landed with [[Verify a repository change]], read the implementer log too, then
   land it with [[Land a change]].

## Verify

- `git log main..HEAD` shows the agents' commits with `<type>: <description>` subjects. The merge
  agent runs `git merge <branch> --no-edit` per branch, so each branch that was not a
  fast-forward has its own merge commit.
- `git ls-files .sandcastle` lists no `.env`, `logs/` or `worktrees/` entry.
- `npm run check` exits 0 on the branch before `npm run pr`.

## Unattended run with `npm run sandcastle:afk`

`npm run sandcastle:afk` (`scripts/sandcastle/afk.ts`) runs the loop and then lands its work, so
you can leave. It runs on the host, from the feature branch checked out, and takes no arguments.
In order:

1. Refuses, saying why and exiting 1, when the branch is `main`, HEAD is detached, the tree has
   uncommitted changes, `gh repo view github.com/Zimfra/software_testing` fails (`gh` not logged
   in, or the repository is not visible), or origin does not publish to that repository, the one
   the prompts read. For the last check afk uses `npm run pr`'s own destination check: origin
   must have exactly one fetch URL and one push URL (`git remote get-url --all`), both GitHub URLs
   naming `github.com/Zimfra/software_testing`. An origin it cannot read is refused too. All of
   these are reported together. Nothing has run yet. A login that is the
   repository owner is refused by step 4, after the loop; the work then stays merged on the
   branch.
2. Runs `node .sandcastle/main.ts`. If that exits 2 (an incomplete or failed run), the wrapper
   says so and goes on to judge the branch itself in step 3, so reviewed work the loop merged can
   still land, and the wrapper then exits 2 whatever lands. Any other non-zero exit stops the
   wrapper with exit 2, and nothing is pushed or commented. It also stops with exit 2 when HEAD is no longer on the
   starting branch afterwards, or the tree is left with uncommitted changes or a merge in
   progress, because the merger is an agent with a shell on this checkout.
3. Runs `git fetch origin main`, then lists the local branches named `sandcastle/issue-<N>` that
   are merged into `HEAD` and not on `origin/main`, and compares each branch tip with the tip it
   had before the loop. A branch with a commit entry in its reflog whose tip the run moved, or
   that the run merged for the first time, is announced; that includes an empty leftover the run
   committed to and a branch merged earlier that the run extended. A branch merged earlier whose
   tip is unchanged ("earlier work") is named in a warning and not commented on; the pull
   request this run opens still carries its work. A branch the run merged whose reflog holds no
   commit entry (a ref written by `update-ref` or `fetch`) is named in a warning, not commented
   on, and makes the run exit 2 after landing the rest. A worked branch the run moved or created
   that neither `HEAD` nor `origin/main` holds (the merger skipped or aborted it) is named and
   also exits 2. With nothing to announce it exits 0 unless HEAD moved, or earlier work is not
   on `origin/<branch>` yet (judged by those branches' own tips, so a later local commit does
   not matter), or earlier work is pushed but `gh pr view` finds no open pull request for the
   branch; each of those exits 2.
   Before landing it compares the branch with `origin/main`, so an edit left by an earlier
   refused run still counts. Only documentation may land unattended: Markdown under `wiki/` or
   `docs/`, at the repository root, or a changelog fragment
   (`changelog/<YYYY-MM-DD>-<slug>.md`, ADR-0027). Any other changed path (code, tests, configuration, a root
   `json.py` that `python3 -m unittest` would import, a nested lint config, an upper-case
   `Scripts/` on a case-insensitive disk) is refused with exit 1 and named. A moved or renamed
   file counts at both its old and new path. The reason: landing runs `npm run check` on this
   machine as you, with no person present, and that executes whatever the agents changed. The
   same check runs before the loop (a branch that already carries code is refused before a paid
   run) and after it; after the loop each announced issue gets a comment saying the work is
   merged on the local branch and not landed, so you are not left with silence. Setting
   `SANDCASTLE_AFK_LAND_CODE=1` in your own shell lifts the refusal and accepts that risk.
   It fetches `origin/main` before comparing (once before the loop and once after it), so a
   stale tracking ref cannot name code you never wrote. The fetch uses an explicit destination
   and the wrapper checks that `origin/main` exists afterwards, so a narrowed refspec cannot leave
   a stale or absent ref; a fetch that throws (a timeout), fails or leaves no ref before the loop
   is reported with the other refusals, and one that fails after it exits 2 and says the loop
   already ran and nothing was pushed. The two exit codes differ on purpose: before the loop
   nothing has changed, so it is a refusal; after it, issue branches may already be merged here. A branch with no history in common with `origin/main`
   is a named refusal, and only `git merge-base` exit 1 means that. A branch
   that already carries code is refused before the loop until you land it with `npm run pr`, so
   this wrapper is unusable on your own feature branch while it holds code. When a code refusal
   coincides with stranded or deleted work, or a notice comment could not be posted, the exit is
   2 and not 1.
   The wrapper also exits 2 when the loop changed the repository's local git config (compared
   key by key with `-z`, branch tracking keys excepted), because a tracked diff cannot show `core.hooksPath` or
   `core.fsmonitor`. It compares the hooks directory the repository is configured to use
   (`core.hooksPath` is honoured, and it resolves from a linked worktree too) by content, with a
   SHA-256 of each file, before and after the loop, so a rewrite that keeps size and mtime is
   seen. The config and hooks comparisons run before any git command that could run a hook
   (`git status` can rewrite the index and run a `post-index-change` hook), and a changed hook
   exits 2. A hooks directory that cannot be read, such as one holding a dangling link, is
   refused before the loop and never compared as empty. It cannot see `node_modules`,
   `config.worktree` (when `extensions.worktreeConfig` is on), `.git/info/exclude`, the global
   git config or other ignored files; running the check inside the sandbox would, and is not
   built. An issue branch the loop deleted is named and exits 2 as well.
4. Runs `node scripts/git/pr-ready.ts`, the tool behind `npm run pr`, with its output streamed to
   the terminal: it runs `npm run check`, refuses a `gh` login that is the repository owner,
   pushes the branch and opens or reports the pull request. Its refusal (exit 1) is passed on with "nothing was pushed or commented"; its failure
   (exit 2) is passed on with "a push may already have happened", because the tool pushes
   before it opens the pull request, and nothing is commented. It then asks `gh pr view <branch> --json state,url` for the pull request; only an `OPEN` one
   counts, and a missing or closed one is exit 2.
5. Comments on each listed issue with `gh issue comment <N> -R <repository gh reported>`, giving
   the pull request URL, saying the work may be incomplete and that it waits for the owner's
   review. A comment that fails or times out does not stop the others; the wrapper then exits 2
   and names the issues, and nothing retries it. The merge prompt also comments on each issue it merged, so an
   issue can carry two comments.

What notifies the owner: the comment on each issue, and the review request GitHub sends the
code owner for the pull request (not exercised here; it depends on CODEOWNERS routing). There
is no other channel. What it deliberately does not do: push or merge `main`, merge or approve a
pull request, close an issue, skip a hook with `--no-verify`, change a repository setting or
read `.sandcastle/.env` itself (the loop it starts reads that file). The pull request stays
open until the owner merges it in the browser.

Requirements on top of the prerequisites above: the host `gh` is logged in as the machine
account, not the owner ([[ADR-0025 Agents use a machine account and the owner approves]]), and
the branch contains `origin/main` when step 4 runs, or `npm run pr`'s tool refuses and you merge
`main` into the branch yourself.

Verified 2026-10-13 by `scripts/sandcastle/afk.test.ts` against real temporary git repositories
with the loop, `pr-ready`, `gh` and `npm` replaced by scripted runners: the order of the steps,
which branches are selected (merged by this run, not on `origin/main`, correctly named, with a
commit of their own, or named when unrecognised), each refusal including a repository gh cannot
see and (since 2026-10-18) an origin that is unreadable, not a GitHub URL, or publishes to another repository or host, both exit codes of the landing step and their wording, a URL taken from
`gh` and not from the tool's text, a failing or timed-out comment, a branch switch, a moved HEAD, a dirty
or half-merged tree after the loop, earlier work pushed and unpushed, an empty earlier branch, and that none of the wrapper's own
calls pushes, merges, closes, bypasses a hook or names `.env` (the landing tool is scripted, so
its push is not exercised). Not exercised: the real `gh`, Docker, the
Sandcastle loop, a real push, and GitHub's review request reaching the owner.

## Candidate artifacts and quarantine

The isolated workflow (audit remediation S13 to S18) returns each candidate as data, not as a
branch in your checkout. `scripts/sandcastle/quarantine.ts` (S13, 2026-10-18) is the receiving
side. Nothing calls it yet: `npm run sandcastle` and `npm run sandcastle:afk` still run the loop
on the host until S14 produces artifacts and S18 switches the public commands over.

An artifact is a directory holding exactly these files, each a regular, non-executable file:

| File | Limit | Content |
|---|---|---|
| `candidate.json` | 64 KiB | The version 1 manifest below. |
| `candidate.bundle` | 64 MiB | A v2 or v3 (SHA-1) Git bundle that carries one ref, the candidate branch. |
| `recovery.data` | 1 MiB | Optional. Opaque unfinished-work data, kept and never applied. |

```json
{
  "version": 1,
  "repository": "Zimfra/software_testing",
  "task": "issue-42",
  "base": "<40-hex base commit>",
  "candidate": { "ref": "refs/heads/sandcastle/issue-42", "sha": "<40-hex candidate commit>" },
  "bundle": { "sha256": "<64-hex>", "bytes": 1234, "prerequisites": ["<40-hex base commit>"] },
  "recovery": { "sha256": "<64-hex>", "bytes": 56 },
  "claims": { "implement": "succeeded", "review": "succeeded" }
}
```

An empty `prerequisites` list is a full bundle; a non-empty one is incremental, and each
prerequisite must already be in the base's history (at most 16). `claims` may name only the
builder phases `plan`, `implement`, `review` and `merge`, each `succeeded`, `failed`,
`interrupted` or `skipped`.

Run it with identities the trusted side already knows, never ones read from the artifact:

```sh
node scripts/sandcastle/quarantine.ts --artifacts <artifact-dir> --source <trusted-repo> \
  --repository Zimfra/software_testing --task issue-42 --base <base-sha> \
  --ref refs/heads/sandcastle/issue-42 [--quarantine-root <dir>]
```

It exits 0 when the candidate is accepted, 1 when it is refused (each reason printed) and 2
when it was called wrongly or Git could not run. It refuses when:

- the manifest has another version, repository, task, base or ref, an unknown key (a `command`,
  a file path, a `verified` flag), a claim for a phase the builder does not own, or a malformed SHA;
- a file is missing, unreadable, over its limit, a symlink, a FIFO or other non-regular file,
  executable, or does not match its size and SHA-256, or the directory holds any other entry
  (`.git`, `hooks`, `config`);
- the bundle header carries another or an extra ref, a SHA other than the advertised one, other
  prerequisites, a header longer than 64 KiB, or a capability other than `@object-format=sha1`
  in a v3 bundle;
- the trusted source lacks the base, a prerequisite is outside the base's history, Git's own
  bundle and object checks fail (a corrupt pack, a tree with a `.git` entry, a delta that would
  inflate past the memory limit below), a Git command runs past its time limit, the candidate
  ref names a tag or another non-commit object, or the imported commit equals the base or does
  not descend from it.

A link, FIFO or device at one of the three names is refused from `lstat` alone, before anything
opens it; the open that follows uses `O_NOFOLLOW` and `O_NONBLOCK` and checks the open file again,
for an entry swapped in between.

Text from the artifact (manifest values and keys, header lines, Git's error line) is printed
with control characters, Unicode format characters (bidi overrides and isolates, zero-width
marks, U+FEFF) and the line and paragraph separators escaped as `\uXXXX`, so a refusal cannot send
terminal escape sequences or display reordered text.

Memory is bounded per object, not per bundle. The 64 MiB bundle cap counts compressed bytes, and
a few hundred bytes of deltas can expand to gigabytes. Quarantine Git therefore runs with
`GIT_ALLOC_LIMIT=64m` and `pack.threads=1`: any single allocation over 64 MiB fails. Expect a candidate
that holds a genuine file over 64 MiB to be refused as well; that case was not tested. On 2026-10-18 a 262-byte bundle that expands to 192 MiB grew
`git index-pack` to 197 MiB before Git refused it as a bad object; with the limit it was refused
at once with `attempting to allocate ... over limit`, and the largest process during the run was
the 85 MiB Node CLI (measured with `/usr/bin/time -v`, git 2.53).

CPU time is bounded per Git command, not per object. Many deltas, each under the memory limit,
still take time: on 2026-10-18 a bundle of 60 deltas of up to 48 MiB each took 15 to 21
seconds to import (two test runs) before Git refused it. Each quarantine Git command therefore has a 120-second deadline. Git runs in
its own process group, and at the deadline the whole group is killed, including the `index-pack`
child a fetch starts. A command that prints more than 16 MiB is stopped the same way. Either
way the run is refused (exit 1) and its quarantine directory kept. Only
`bundle verify` and the candidate fetch read the candidate's pack, so one candidate costs at most
about four minutes of Git time on its pack. The object count in the pack is not limited separately.

Each run creates a new `candidate-quarantine-*` directory under the quarantine root (the system
temp directory by default) with copies of the files read and a bare `repo.git`. The base is
fetched from `--source` into `refs/quarantine/base`, the candidate into
`refs/quarantine/candidate`; no branch is created and no file is checked out. That Git runs with
no system or global config, `core.hooksPath=/dev/null`, `core.fsmonitor=false` and fsck on
fetch, so neither the guest's configuration nor yours runs. Tracked files such as `.githooks/`
arrive as content only. An artifact refused after its files were read stays in its quarantine
directory for diagnostics, and the refusal names that directory; one refused by the directory
checks is never copied. Delete a quarantine directory yourself when you are done. Never import or run a rejected artifact to
recover from a refusal.

What acceptance does not certify: that the candidate's checks pass, that it was reviewed, or
that it may be published. The builder's `claims` are reported as data with no authority, and
`recovery.data` is never restored into your checkout. Verification receipts (S15) and trusted
publication (S16) are the next two sections. Tests:
`node --test scripts/sandcastle/artifact.test.ts scripts/sandcastle/quarantine.test.ts`.

## Verification receipts

A verification receipt is the host's record that one quarantined candidate passed the base
commit's checks in a fresh container and an independent review. `scripts/sandcastle/verifier-driver.ts`
(S15, 2026-10-18) issues it; `npm run sandbox:verify` is the command:

```sh
npm run sandbox:verify -- --artifacts <artifact-dir> --source <trusted-repo> \
  --repository Zimfra/software_testing --task issue-42 --base <base-sha> \
  --ref refs/heads/sandcastle/issue-42 --run <run-id>
```

Today it always exits 1 with `blocked: no reviewer`, before it touches Docker. No live reviewer
is authorised (OWNER DECISION, 2026-10-18, relayed by the coordinator: "Fake reviewer only
(Recommended)"), so no real receipt can be issued yet. Blocked is never a pass.

What the driver does, in order:

1. Quarantines the artifact (previous section). Builder claims stay data.
2. Reads the check commands from the base commit's `package.json`, never the candidate's (OWNER
   DECISION, 2026-10-18, relayed by the coordinator: "Base commit's checks (Recommended)"). The
   checks are the links of the base's own `check:base` (each must be `npm run <script>` or
   `npm test`), each run from its own definition. A base command that goes through a package
   manager (`npm`, `npx`, `pnpm`, `yarn`, `bun`, `corepack`, `node --run` or `$npm_execpath`,
   quoted or not) is refused, because it would read the candidate's scripts.
3. Lists the candidate's changes to check machinery: `package.json`, `package-lock.json`,
   `.npmrc`, `.nvmrc`, `tsconfig*.json`, `eslint.config.*`, `scripts/`, `evals/`, `config/`,
   `.sandcastle/`, `.githooks/`, `.github/`, any `.gitattributes` and
   `.claude/skills/import-baseline.json`. It adds inputs that can shadow what a check loads:
   Python files and `.pth` files anywhere, `pyproject.toml`, `setup.cfg`, any `.gitignore`,
   `node_modules/`, a new top-level directory, and a new top-level code or config file (`.js`,
   `.mjs`, `.ts`, `.json`, `.toml`, `.cfg`, `.ini` and the like). These are inputs for a human
   reviewer, not trusted.
4. Copies the candidate's tracked tree (a `git archive`, with no Git metadata, manifest or
   recovery data) into a new container launched and inspected with the S12 refusals, then runs
   `npm ci` and each check as its own `docker exec`. The checkout inside commits every archived
   file (`git add --all --force`), so files the candidate's `.gitignore` covers stay tracked. Each
   step unsets `PYTHONPATH`, `NODE_OPTIONS` and similar import settings and runs with
   `PYTHONSAFEPATH=1`: without it, `python3 -m unittest` puts the working directory first on
   `sys.path`, and a candidate's own `unittest/__main__.py` turned a failing eval into exit 0 in
   the S15 review (2026-10-18). Exit codes and output digests come from Docker on the host; step
   logs stay in the quarantine directory under `logs/`.
5. Gives the reviewer the diff, the machinery list and the check results, and parses its raw
   response as exactly `{verdict, findings}`.
6. Writes the receipt to the host-only store.

**Where the authority comes from.** There is no signing key (OWNER DECISION, 2026-10-18,
relayed by the coordinator: "Host-only store (Recommended)"). The store is
`$XDG_STATE_HOME/zeemrepo/verification-receipts`, or `~/.local/state/zeemrepo/verification-receipts`
when that variable is unset or relative. The driver creates it with mode 0700 and refuses a store
that is not this user's private directory, or that lies inside (or contains) the trusted source
or the artifact directory. No container mounts it, and no Docker argument may name it. Each
receipt file is named by the SHA-256 of its bytes and must be byte-identical to the driver's
`JSON.stringify` output, so a repeated key refuses. `validateReceipt` reads only the directory its
caller names. A consumer must name the configured store (`defaultStore()`), never a path taken
from an artifact or a guest; validation refuses a store inside, or containing, the consumer's
trusted source or artifact directory, but it cannot tell the configured store from another
private directory the host user made. Anyone with write access to the store, or able to choose
the directory a consumer reads, as this host user can forge a receipt; that is the accepted limit
of the no-key design.

**What a receipt binds** (the contract S16 and S17 consume, `validateReceipt` in
`scripts/sandcastle/verification-receipt.ts`): repository, task, run id, base, candidate ref and
SHA, the manifest and bundle digests, the runner (a digest of the driver's own source files, the
runtime and the image id), the check definitions digest with every command, exit and output
digest, the changed check machinery, the reviewer's identity, input digest, raw response, verdict
and findings, the outcome, and `reusedFrom`. Validation refuses unless the file reads back under
its digest, every field is well formed, the outcome follows from the exits and the verdict, the
verdict and findings match the raw response, the human review flag matches the machinery list,
every expected identity matches (repository, task, run, base, candidate, check definitions
digest from the consumer's own trusted base) and the outcome is `passed`. A valid receipt
returns `humanReview`: while it lists any path, the receipt alone does not authorise publication.

**When a receipt goes stale.** It covers one run of one candidate SHA on one base under one set
of check definitions. A new SHA (an integration with main, an amended commit) needs a new
verification. A later run with unchanged inputs (same repository, task, base, candidate SHA, check
definitions, runner digest, image and reviewer identity) reuses a stored passing receipt: the
driver issues a new receipt for the new run with `reusedFrom` naming the old one, without
rerunning anything. Failed receipts are never reused. Changing the driver code, the image or the
reviewer makes every older receipt ineligible for reuse.

`npm run sandbox:smoke` runs `scripts/sandcastle/verifier-driver-smoke.ts` on the image it built,
so the required CI `check` job drives the real Docker path with a fake reviewer: a good fixture
candidate must receive a receipt that validates from a temporary store, and a candidate that
rewrites its test script to `exit 0` must still fail the base's test. Tests:
`node --test scripts/sandcastle/verifier-driver.test.ts scripts/sandcastle/verification-receipt.test.ts scripts/sandcastle/container-runtime.test.ts scripts/sandcastle/verify-candidate.test.ts scripts/sandcastle/verifier-driver-smoke.test.ts`.

## Trusted publication

`scripts/sandcastle/isolated-publication.ts` (S16, 2026-10-18) hands one verified candidate to
its pull request. It has no npm script yet; wiring it into the public commands is S18:

```sh
node scripts/sandcastle/isolated-publication.ts --artifacts <artifact-dir> --receipt <receipt-sha256> \
  --repository <owner/name> --task <id> --run <id> --base <sha> --candidate <sha> --ref refs/heads/<branch>
```

Run it from a clean control checkout on main or a commit main holds: its own code is the
publishing code, so uncommitted changes to tracked files refuse, and so does a `HEAD` that the
freshly fetched origin/main does not contain (an unpushed local commit). In order, it:

1. Refuses a ref the pre-push branch policy refuses (`refs/heads/main`) before anything else.
2. Fetches origin's main with hooks off and validates the receipt from the host-only store for
   exactly the repository, task, run, base, candidate SHA and check definitions given, plus the
   branch ref. A receipt that lists changed check machinery refuses: it needs human review first.
3. Imports the artifact again into a fresh quarantine. The imported SHA must be the receipt's
   candidate and the manifest's SHA-256 the one the receipt bound (the manifest binds the bundle).
4. Checks the destination with `npm run pr`'s own functions: origin must publish to the receipt's
   repository, `gh` must not be logged in as the owner or a code owner, and the verified base must
   be origin's main itself. A base main does not contain refuses (the pull request would carry base
   commits nobody reviewed), and so does a main that moved on; rebuild and reverify on current main.
5. Reads origin's tip of the branch and applies the pre-push hook's branch policy to the one
   update, so an existing branch holding other work is never rewritten.
6. Pushes the candidate SHA from the quarantine repository with `core.hooksPath=/dev/null`, no
   `--force` and no `--no-verify`, then reuses or creates the pull request with an explicit title
   and body and checks that it is exactly the candidate into main.

The pre-push hook would run `npm run check` from the control checkout, which tests the control
checkout's code and says nothing about the candidate, so publication runs the hook's branch policy
itself and relies on the receipt for the candidate's checks. Its output and the pull request body
say which is which. The only programs it starts are `git` and `gh` from the host's `PATH`; the
candidate is never checked out, and tests plant hooks and scripts in the candidate, the control
checkout and a configured hooks directory to show none of them runs.

Recovery: a refusal before the push leaves origin unchanged. A failed push says it may or may not
have reached origin; inspect the branch on origin before rerunning. After a successful push, every
refusal or error says the SHA is already pushed; rerunning with the same receipt pushes it again (a
no-op) and reuses the matching open pull request. Never force-push to recover.

Limits: no live reviewer is authorised, so no real receipt exists yet and publication has run only
against fake receipts, a faked `gh` and a local bare repository. Tests:
`node --test scripts/sandcastle/isolated-publication.test.ts`.

## Known notes

- The Dockerfile base is `ubuntu:26.04`, the release the owner's machine runs, pinned by digest
  (S12, captured 2026-10-18). Its apt packages come from the dated Ubuntu snapshot named in the
  Dockerfile (`snapshot.ubuntu.com`), so a rebuild installs the same versions; Node is the exact
  `.nvmrc`-matching release from nodejs.org, checked by SHA-256; Claude Code is pinned to 2.1.289.
  The image is amd64 only. `python3` must be 3.12 or later because `evals:test` uses tarfile's
  extraction filters. To update a pin, change it in the Dockerfile and re-read its source: the
  Docker Hub index digest for `ubuntu:26.04`, a snapshot ID from `snapshot.ubuntu.com`, and the
  checksum from the release's signed `SHASUMS256.txt.asc`. `npm run sandbox:smoke` builds the
  image, refuses a guest that is not Ubuntu 26.04 or has an older Python, and runs the repository's
  `lint`, `typecheck`, `test` and `evals:test` inside it; the required CI `check` job runs that on
  every pull request.
- This loop still runs its git cleanup on the host. `npm run sandbox:smoke` shows that a
  `core.fsmonitor` command an agent plants runs during the SDK's `close()` (finding A01): inside
  the smoke test's container that is the intended control, but in this loop it would run on your
  machine. The isolated workflow that moves the coordinator into the container is the audit
  remediation's later work (S13 to S18); until it lands, treat an unattended run as executing
  agent-controlled git configuration on the host.
- `scripts/sandcastle/coordinator.ts` names the model `claude-opus-4-8`. Check that id is current before a
  long run; not verified here.
- The loop is tested without a model (S08, 2026-10-18). `scripts/sandcastle/coordinator-entry.test.ts`
  imports the real `.sandcastle/main.ts` with `@ai-hero/sandcastle` resolved to a fake SDK, in
  disposable Git repositories, and checks the order and options of the planner, sandbox,
  implementer, reviewer, close and merger calls and the log lines. `.sandcastle/*.ts` is linted,
  type-checked and counted in `npm test` coverage. The tests do not cover the real SDK (its
  worktrees, commit collection and `Output.object` parsing), Docker, the models, what the prompts
  make an agent do, or GitHub. The verify-work feature map's "Sandcastle coordinator" entry says
  how to rerun them.
- The already-done guard drops an issue only when its `sandcastle/issue-<number>` branch is
  merged into the current branch and its reflog holds a commit, amend or revert entry whose
  commit is still reachable from the tip and changes content relative to its own parent (an
  empty commit is not work, and a commit that only joins another branch is never the branch's own
  work), and nothing else. The test is per commit, not the tip against the tree the branch was
  created at, because that baseline goes stale as soon as main moves. A rebased branch is therefore not
  recognised as worked: it stays pending and is planned again every round until `MAX_ITERATIONS`
  (10) stops the loop, each round costing an implementer run of up to 100 iterations and losing
  nothing, so do not rebase; the
  prompts forbid rebasing, and a rebased branch ahead of HEAD is still reviewed and, if its review passes, merged. A branch that was created, reset, renamed or
  fast-forwarded and never committed to stays pending, as does one whose commits an agent reset
  away. Four limits follow: a pull request that the owner squash-merges leaves a branch that is
  never an ancestor, so delete that local branch or close the issue; a branch with no reflog
  (for example after its reflog expired) is "unrecognised", stays pending and is planned again,
  and when it is ahead of HEAD it is still reviewed and offered to the merger; a branch that holds only part
  of an issue's work, once merged, is dropped on the next round, so the implementer is told to
  say in the issue comment when a task is incomplete and the owner reads that comment before
  merging; and a reflog entry that names a pruned commit counts as not reachable.
- Known false "done" cases, each unfixed here: a reworded amend of a commit the branch was
  created on (it has content against its parent); a cherry-pick followed by a revert of it (each
  had content); and a non-fast-forward cherry-pick of a
  commit HEAD already holds creates a new commit with the same patch and counts as the branch's
  own work; a `git revert` that is the branch's only change counts, and once merged removes that
  commit from HEAD; and after the owner squash-merges a pull request the issue branch is
  "ahead" of the integration branch forever, so it is reviewed and offered to the merger each round until
  the issue is closed or the local branch deleted. Detecting "same patch as HEAD" needs a
  patch-id comparison, which is follow-up work.
- Two conservative cases that lose nothing but replan: a branch whose only entry is a merge of
  another issue's branch (a `commit (merge)` entry, which has no content of its own) stays
  "unrecognised" and is planned again each round; and a branch pointed with `branch -f` or
  `switch -C` at a commit made on another ref, which later lands in HEAD, is "empty" and is
  planned again although its work is already there. Both cost implementer runs up to
  `MAX_ITERATIONS`.
- VERIFIED on the first real run (2026-10-15, throwaway issues #8 and #9): Sandcastle writes
  `commit:` entries into the host branch reflog, and a branch merged by fast-forward logs
  `merge sandcastle/issue-<number>: Fast-forward` on the target. The already-done guard skipped
  the merged issue in the next round and the planner's round 2 said so. This is one run on one
  host; a different Sandcastle version or provider is not covered.
- An issue that points at another open issue ("after the sentence added for the first trial") is
  planned as blocked by it, and agents never close issues, so it waits until you close the first
  one. Write independent issues when you want them worked in the same round.
- A documentation-only issue still needs a changelog fragment and a work record on its branch,
  because the change-record guard refuses a branch without them when the wrapper lands it
  (`changelog-guard: ... adds no changelog fragment`). Do not write "change no other file" in a
  Sandcastle issue; the implementer prompt already asks for both records.
- The comments an agent posts are authored by whichever account owns the sandbox `GH_TOKEN`. On
  the first run they were posted by the repository owner, because that token was the owner's
  personal one. Use a fine-grained token of the machine account, limited to this repository with
  Issues read and write and Metadata read, so an agent in the sandbox cannot act as the owner.
  Replacing it took several attempts on 2026-10-15; "Token setup" below lists what each one hit.
- The planner's output is validated before anything runs: `id` is a positive number without
  leading zeros, `branch` is `sandcastle/issue-<id>`, an issue appears once, and `title` is
  non-empty after it is normalised to one line of at most 200 characters with backticks and
  control characters replaced. The title is cleaned, not refused, because a code span in an issue
  title is ordinary and a refusal aborts the loop. Sandcastle 0.12.0 marks a prompt's own
  backticked commands before it substitutes arguments, so a title cannot become one; the
  cleaning keeps titles readable in logs and prompts. The schema is not a prompt-injection
  control: the agents have a shell and read the issue text.
- The plan must also carry a `blocked` list, possibly empty. Each entry has an `id`, a `title` and
  `blockedBy`, a non-empty list of distinct issue numbers that excludes its own. The schema refuses
  a plan without the list, an issue both selected and blocked, and a selected issue with
  `blockedBy`, reporting problems in both lists together; a refused plan fails the run (exit 2) before any worker starts. The schema checks
  only this declared metadata. Whether an issue really depends on another is the planner model's
  reading of issue text, which no test proves: a selected issue whose text says "blocked by #3"
  still runs if the plan does not declare it blocked (`scripts/sandcastle/coordinator-queue.test.ts`).
- A merged branch whose typecheck or tests still fail after the merger's fix attempt is not
  undone, and the next round drops it as done; read the integration branch's checks before
  landing it.
- A planned branch that still holds commits HEAD lacks (a reviewer that threw, an aborted merge,
  a sandbox that died after the implementer committed) is reviewed again in the next round even
  when the implementer adds nothing, and reaches the merger only when that review passes for its
  tip (S09).
- A branch whose commits an agent reset away (to its creation point or to any commit HEAD already
  contains), in any order with a rebase, has no reachable commit entry and stays pending. A
  branch reset only part of the way back keeps the commits that are still reachable from its tip
  and counts as worked. A branch ahead of HEAD with no reachable commit entry (a rebase, a tip
  written by `fetch` or `update-ref`, another branch merged onto an empty one) is passed to the
  reviewer and never dropped.
- The merger is an agent with a shell: the prompt tells it to merge only the listed reviewed
  branches, but nothing stops it from merging a held branch. The coordinator reports any listed
  issue it did not merge, not a branch it merged unasked; the AFK wrapper classifies what was
  merged from Git, not from the loop's claims.
- The review prompt runs `git diff <current branch>...` in a shell, so run the loop from a
  branch whose name is plain (letters, digits, `-`, `/`).
- The loop refuses to start on `main` or a detached HEAD, because the merger commits into the
  checked-out branch. `coordinate()` calls `branchRefusal` (`scripts/sandcastle/branch-guard.ts`)
  before any agent runs, and the coordinator tests cover that call through `main.ts`.
- The sandbox image runs the Node release `.nvmrc` names (S12), so a typecheck or test failure
  inside the sandbox is no longer explained by a Node mismatch. The merger is still told not to
  comment on an issue whose checks keep failing.
- With `core.logAllRefUpdates=false` a branch has no reflog, so the guard keeps every issue
  pending and a rerun plans it again.

## Token setup

The steps were captured on the first token swap, 2026-10-15. Each claim about GitHub's behaviour
was re-read on 2026-10-18 against the GitHub pages listed under "Sources" at the end of this
section; a claim marked "observed" comes only from that swap. GitHub's token screens and
organisation policy can change: before a new swap, re-read those pages and the token page itself.

Three checks answer three different questions, and none stands in for another:

- **Identity.** `gh api user --jq .login` prints the account the token authenticates as. A token
  belongs to the user who generated it and acts with that user's access, narrowed by its own
  permissions (sources 1 and 5). It says who, not what the token may do.
- **Expiry.** The `GitHub-Authentication-Token-Expiration` response header carries the token's
  expiry date (source 6). It is metadata for knowing when to replace the token. Two different
  tokens can have the same expiry date, so an equal date does not show that the old token is
  still in the file, and a different date is not required of a new token.
- **Write permission.** Only a real write proves it. A comment needs Issues write (source 3), and
  a token still pending the organisation's approval can read only public resources (source 1);
  the identity read tests neither. Observed 2026-10-15: a token whose read check printed the
  machine account's login still answered 403 on every comment.

1. Sign in to GitHub as the machine account (the page header shows the username) and open
   `Settings > Developer settings > Personal access tokens > Fine-grained tokens` (source 1). A
   token generated while signed in as the owner is the owner's token, whatever its name says.
2. **Resource owner** must be the organisation, because a token can reach only resources owned
   by its resource owner (source 1). Observed 2026-10-15: while `gh api
   orgs/<org>/memberships/<machine-account>` said `pending`, the dropdown listed only the account
   itself, and the organisation appeared once the invitation was accepted and it said `active`.
   With the account itself as resource owner, "Only select repositories" did not offer this
   repository and Issues stayed read-only (observed); GitHub lists contributing to a repository
   where the user is an outside or repository collaborator as a fine-grained token gap (source 1).
3. Choose this repository only, **Issues** read and write, **Metadata** read, no other
   permission. Creating an issue comment is listed under the Issues write permission (source 3).
   Pick an expiry within the organisation's maximum lifetime: the default maximum for
   fine-grained tokens is 366 days, an organisation owner can set another, and a token over the
   limit is blocked from the organisation's resources (source 4). Observed 2026-10-15: the first
   token, with a lifetime over 366 days, was refused by the organisation.
4. If the organisation requires approval, the new token stays `pending` and can read only public
   resources until an organisation owner approves it (sources 1 and 7). This repository is
   public, so a pending token still reads issues. Observed 2026-10-15: every comment answered 403
   until the owner approved the token.
5. Put the value in `GH_TOKEN` in `.sandcastle/.env`, then run the read checks from the same image
   the loop uses, without printing the token:

   ```
   docker run --rm --env-file .sandcastle/.env --entrypoint bash <image> -c \
     'set -eu; gh api user --jq .login; gh api -i user | grep -i "^github-authentication-token-expiration" || echo "no expiry header"'
   ```

   The first line must be the machine account's login. Another login means the file holds a
   token of that account. A non-zero exit with a 401 means GitHub refused the credentials
   (source 9); an expired or revoked token can no longer authenticate (source 8). After several
   requests with invalid credentials in a short period, GitHub answers 403 for that user for a
   while instead, even with valid credentials (source 9), so do not retry in a loop. The expiry line is for your records; do not compare it with the old
   token's. These reads establish identity only.
6. Before the first real run on a new token, check write permission with one comment on a
   throwaway issue. This posts a visible comment and notifies the issue's subscribers, so the
   owner names the issue and approves the comment before it is posted:

   ```
   docker run --rm --env-file .sandcastle/.env --entrypoint bash <image> -c \
     'gh api repos/<org>/<repo>/issues/<n>/comments -f body="token write check" --jq .user.login'
   ```

   `gh api` sends a POST when fields are given (`gh api --help`). It must print the machine
   account's login, which is the comment's author. A 403 with "Resource not accessible by
   personal access token" means the token lacks a permission the endpoint needs (source 2). A
   403 can also mean the token is still pending approval: observed 2026-10-15, an organisation
   token answered 403 on comments until the owner approved it. Observed 2026-10-15: after approval, the comment on the trial issue was
   authored by the machine account. Neither the read checks nor any mocked test shows write
   permission; this comment does.
7. Create a new token instead of editing an old one. Observed 2026-10-15: editing a token's
   permissions left its string and expiry unchanged. The GitHub pages read on 2026-10-18 do not
   say whether a token's resource owner can be changed after creation, so whether an account-owned
   token could become an organisation token is unknown.
8. Revoke the replaced tokens afterwards, including any created under the wrong account. A
   revoked token can no longer authenticate (source 8), so rerunning step 5 after the revocation
   answers 401 if `.sandcastle/.env` still holds a replaced string (source 9). Repeated failures
   may answer 403 instead of 401 (source 9).

Sources, each read 2026-10-18:

1. GitHub Docs, "Managing your personal access tokens",
   <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>.
2. GitHub Docs, "Troubleshooting the REST API", section "Resource not accessible",
   <https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api>.
3. GitHub Docs, "Permissions required for fine-grained personal access tokens", "Repository
   permissions for Issues",
   <https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens>.
4. GitHub Docs, "Setting a personal access token policy for your organization", "Enforcing a
   maximum lifetime policy",
   <https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization>.
5. GitHub Docs, "REST API endpoints for users", "Get the authenticated user",
   <https://docs.github.com/en/rest/users/users>.
6. GitHub Changelog, "Expiration options for personal access tokens", 2021-07-26,
   <https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/>. The
   docs pages above do not describe this header; this announcement is the only GitHub source
   found for it, so treat the header as possibly absent.
7. GitHub Docs, "Managing requests for personal access tokens in your organization",
   <https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/managing-requests-for-personal-access-tokens-in-your-organization>.
8. GitHub Docs, "Token expiration and revocation",
   <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation>.
9. GitHub Docs, "Authenticating to the REST API", section "Failed login limit",
   <https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api>.

## Troubleshooting

Reported by the owner from earlier runs and not reproduced while writing this page.

- The agent refuses its credential: an OAuth token from `claude setup-token` must start with
  `sk-ant-oat`.
- `gh` answers 403 with "Resource not accessible by personal access token": the token is still
  pending approval by the organisation, or it lacks the permission the endpoint needs. The
  `X-Accepted-GitHub-Permissions` response header lists the permission sets the endpoint accepts
  (source 2 under "Token setup"); Issues write is one of them for a comment (source 3). See
  "Token setup".
