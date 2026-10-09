# Day 1 feature map

This map is the verification interface for the current repository. It lists recipes,
not passed results. A change review selects affected entries; an explicit maintenance
audit covers all entries and reports missing required coverage as blocked.

## Launch and evidence

Run from the selected feature checkout as the normal WSL user. Before each CLI recipe,
inspect `git status --short`, `node --version`, and `npm --version`; use Node >=22.18 and
dependencies installed there with `npm ci`. Confirm the pinned source has not changed.
These are preflight checks, not a nonexistent doctor command. After surprising output,
inspect the failure and restore a known state before retrying.

Capture output in ignored .codex/ files and check that each exists before cleanup. Record
commands, revision, named tests, results, and limits in the PR or wiki after review. Do
not remove someone else's processes or files. Short-lived CLI probes get fresh processes;
UI checks use one known vault instance. Stop only processes this run started.

## Features and recipes

Paths below are relative to the repository root.

| Feature | Source to inspect | Live recipe and expected observation |
|---|---|---|
| Local eval boundary | scripts/eval-sandbox.ts, scripts/sandbox-policy.ts, scripts/fixtures/sandbox-probe.ts | After the local setup runbook, run node --test scripts/sandbox-policy.test.ts and npm run eval:sandbox. Inspect source hashes, six assertions and all three traces. No model runs; keep that outcome separate. |
| Eval specifications | scripts/eval-contracts.ts, scripts/eval-lint.ts, scripts/fixtures/eval-cases/ | Run npm run eval:lint and node --test scripts/eval-contracts.test.ts scripts/eval-lint.test.ts. Valid/broken controls verify the actual checker and observation aggregation. This does not launch agents or authenticate evidence. |
| TypeScript starter | src/index.ts, src/greet.ts, src/greet.test.ts, package.json | Run `npm run build`, `npm start`, and `node --test dist/greet.test.js`. Start prints `Hello, world!`; the named greeting test passes. Generated dist/ is ignored. |
| Wiki validation | scripts/wiki-lint.ts, scripts/wiki-validation.ts, scripts/wiki-validation.test.ts | Run `npm run wiki:lint` and the wiki validation tests through `npm test`. The CLI accepts this vault; fixtures prove invalid metadata and unresolved links are rejected. Do not corrupt live notes to test refusal. |
| Work tracking | scripts/work-tracking.ts, scripts/work-tracking.test.ts, wiki/Work tracking.base, wiki/reference/Project hub.md | Run `npm test` for ownership, dependency, and approval fixtures. With Obsidian available, open this checkout's wiki vault, switch Project hub views, and follow an idea to its project. Check project groups and rendered properties. Without that UI, record the exact missing access and attempted route; file tests do not prove rendering. |
| Branch guards | scripts/branch-guard.ts, scripts/branch-guard.test.ts, .githooks/ | Run `node --test scripts/branch-guard.test.ts` and inspect `git config --get core.hooksPath`. Disposable repositories prove main/refspec refusal, history protection, and landed-branch cleanup. They clean up their own temporary directories. Never probe main by pushing to the real remote. |
| Worktree preservation guard | scripts/worktree-guard.ts, scripts/worktree-validation.ts, scripts/worktree-guard.test.ts, scripts/worktree-validation.test.ts | Run `node --test scripts/worktree-guard.test.ts scripts/worktree-validation.test.ts`, then run `node scripts/worktree-guard.ts --json` in the actual topology. Disposable bare-common-root fixtures prove clean linked worktrees pass, linked work at risk is reported, and inspection failure stays distinct from clean. The live command may report this branch's own work at risk; that is a valid refusal, not a failing check. Never remove a worktree to test the guard. |
| Shared admission controls | scripts/agent-admission.ts, scripts/agent-admission.test.ts, package.json | Run `node --test scripts/agent-admission.test.ts`. Disposable repositories prove required revision-pinned wiki roles and finding IDs, a closed manifest schema, pre-launch pointer revalidation, single pinned fetch and push identities with pre-publication revalidation, atomic remote-branch creation, current-base setup, original-base and current-main ancestry, published tracking identity, exact-record partial-publication and descendant-HEAD retry, retained retry evidence, per-property worktree drift refusal, a real non-symlink managed root, controller-storage symlink refusal, inherited Git-configuration refusal, shared-Git identity checks, selection of only the named fake launcher for all three clients, and each client's preflight: a missing executable, a version line or (for OpenCode) an executable name that misidentifies the client, and for Claude Code a missing `bwrap` or `socat` each refuse before Git setup; the PATH search skips non-executables and relative entries, the version probe stops a hanging client, and an unrefused admission carries the exact launch plan in the evidence. With a fake client, the Claude Code adapter runs the exact arguments in the worktree with only the allow-listed environment, passes the task on stdin, makes controller files private, captures events with a launch header outside the worktree, kills the client's process group at the time limit or when the controller is interrupted, and records a client that never started as `launch-not-started`; `--launch` refuses other clients, and Claude Code refuses a tracked project settings file or symlinked `.claude`, before setup; `--launch` refuses a Claude Code version without a recorded confinement check. `node --test scripts/controlled-launch-confinement.test.ts` covers the accepted-runtime-list classifier and runs the confinement check end to end with a fake client. They do not prove real OpenCode, Claude Code or Codex confinement, cross-client recall or handoff, website freshness, or foundation completion. |
| Shared skill loading | .agents/skills/, AGENTS.md, INTENT.md, opencode.json | Inspect each SKILL.md name, description, references, and matrix coverage. If OpenCode is installed, run `opencode --pure debug skill` and compare repository locations with the library. This proves discovery only. For an authorized authenticated model trial, request a read-only explanation and observe the selected skills; missing login is a blocker for that behavior claim. No copied library or new connector is required. |
| WSL setup interface | scripts/bootstrap-wsl.sh, wiki/runbooks/Bootstrap a WSL dev machine.md | Run `bash -n scripts/bootstrap-wsl.sh`, `bash scripts/bootstrap-wsl.sh --help`, and `bash scripts/bootstrap-wsl.sh --dry-run`. An unknown flag must exit 2 without installation. These prove syntax, preview, and refusal only. Full installation needs an owner-authorized disposable WSL environment with human sudo access; never run it on the active machine merely to complete an audit. |

## Coverage boundaries

`npm run check` covers lint, types, automated behavior, and wiki validation. It does not
prove Obsidian rendering, model compliance, GitHub permissions, or fresh-machine setup.
For a full maintenance audit, unavailable UI, model, or installation prerequisites remain
explicitly blocked coverage. A `verified-unreachable` entry is not a passing feature.

Add a feature only with its real source path, prerequisite, and observable recipe. Future
helpers are **created later** only when a repeated check justifies them. Product defects
go to wiki issues; the maintenance skill must not rewrite behavior to make this map pass.
