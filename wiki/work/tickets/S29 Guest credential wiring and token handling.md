---
type: ticket
title: S29 Guest credential wiring and token handling
summary: Guards admit exactly ANTHROPIC_BASE_URL and a per-run ANTHROPIC_AUTH_TOKEN passed by name, and a run fails if its output or exported artifacts contain the token.
tags: [area/agents, area/auth, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: agent
priority: P1
next_action: Owner reviews this job spec; when the PR that adds it is merged, build the guard exceptions test first, in parallel with S28.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S14 Isolated coordinator preparation and export]]", "[[S12 Reproducible runtime and real containment control]]", "[[S15 Independent isolated verification receipts]]"]
related: ["[[Choose how the model credential reaches the isolated guest]]", "[[Credential proxies for the isolated guest's model calls]]", "[[S30 Per-run internal guest network]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner chose \"Build our own tiny proxy (Recommended)\", whose option text includes \"the container gets a private network\" and \"The guards get a narrow exception for exactly those two variables.\""
  - "VERIFIED: at b38ff85 scripts/sandcastle/containment-smoke.ts lines 37 and 38 (ALLOWED_ENV, CREDENTIAL), launchRefusals at lines 72 to 87, the Config.Env check in inspectRefusals at lines 117 and 118, and the CALLS allowlist in scripts/sandcastle/isolated-run.ts lines 117 to 123 refuse what this ticket must admit; the guest setup's npm ci (isolated-run.ts line 64) and the coordinator's npm install hook (coordinator.ts line 54) fetch packages (read by Claude Code, Opus 5.5)."
  - "INFERRED: S15 is a dependency because its verifier driver also runs npm ci in a container launched under S12's checks (verifier-driver.ts line 24), so a changed guard must keep its control green."
  - "INFERRED: from the coordinator's relay of the independent verifier's review of PR 66 at a213a15 (Claude Code verifier subagent, Opus 5.5): on an internal Docker network the guest can still reach the gateway IP, so any host service bound there or on 0.0.0.0 answers it, and the proxy must listen on that same address; the token must reach docker by name only and never appear in output or exported artifacts. This ticket was amended on 2026-10-19 to make both pass/fail criteria (Claude Code, Opus 5.5)."
  - "VERIFIED: at f72f0d0, scripts/sandcastle/isolated-run.ts passes the exported candidate to quarantineCandidate from scripts/sandcastle/quarantine.ts (line 244), so the artifact token scan belongs there (read by Claude Code, Opus 5.5)."
  - "INFERRED: from the coordinator's relay of the independent review of PR 67 at 9cf2c09: with the gateway probe, token passing, scans and the two owner questions, one ticket would touch both guards, the launcher, quarantine, the guest image and the CI smoke, which is more than one pull request. It was split on 2026-10-19: this ticket keeps the guard exceptions, token passing by name and the token scans; [[S30 Per-run internal guest network]] takes the network, the proxy start, the gateway exposure, package egress and both owner questions (Claude Code, Opus 5.5)."
  - "INFERRED: S29 does not depend on S28: it takes the base URL and token as plain inputs, its tests use a made-up token, and S30 starts the proxy, so S28 and S29 can be built in parallel and S30 depends on both (Claude Code, Opus 5.5)."
  - "UNKNOWN: implementation evidence is pending."
---

## Goal

Let the S12 and S14 guards admit exactly `ANTHROPIC_BASE_URL` and a per-run
`ANTHROPIC_AUTH_TOKEN`, passed to docker by name, and fail any run whose output or exported
artifacts contain the token value.

## Inputs

- [[S28 Per-run model credential proxy]] for context only; this ticket does not call it.
- The guards as they stand on main: `containment-smoke.ts` (`ALLOWED_ENV`, `CREDENTIAL`,
  `launchRefusals`, `inspectRefusals`), `isolated-run.ts` (`CALLS`, `createArgs`) and
  `quarantine.ts` (`quarantineCandidate`).

## Approach

1. Red first: add guard, token-passing and scan tests and commit them failing.
2. Guards: in `containment-smoke.ts`, admit `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` by
   exact name in both launch and inspect checks; every other `CREDENTIAL` match stays refused.
   In `isolated-run.ts`, allow `create` to carry `--env` for those two names only, in the bare
   `--env NAME` form.
3. Launcher: take the base URL and token as inputs and pass both to `docker create` by name,
   with the values in the docker child process's own environment, never as `NAME=value` in
   argv. Starting the proxy and choosing the address belong to S30.
4. Refusal and inspect messages name a variable but never print its value.
5. The smoke scans its own captured output, and `quarantine.ts` scans the exported candidate
   bundle and recovery data, for the token value and fails if it appears, since an agent could
   write its environment into a committed file.

## Acceptance criteria

- [ ] Guard tests pass and were red first: `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` are
  admitted; `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN_2`, `anthropic_auth_token`, `GH_TOKEN`,
  `CLAUDE_CODE_OAUTH_TOKEN`, an `--env-file`, a third `--env`, and `ANTHROPIC_AUTH_TOKEN=<value>`
  in argv are still refused.
- [ ] The token reaches docker by name only: the recorded `docker create` argv contains
  `ANTHROPIC_AUTH_TOKEN` and never its value, and every refusal and inspect message names the
  variable without its value.
- [ ] The CI smoke's output and the exported candidate bundle and recovery data are scanned for
  the token value, and a planted control (a fake agent that writes its environment into a
  committed file, and one that prints it) makes the run fail.
- [ ] S12's, S14's and S15's existing controls still pass, and `npm run check` passes at the
  final commit with CI green and no secret referenced in any workflow.

## Out of scope

- The proxy itself (S28); the internal network, starting the proxy, the gateway exposure, the
  guest's Claude Code settings and package egress ([[S30 Per-run internal guest network]]); the
  public-command cutover and the first real-model run (S18).
- Creating the Anthropic workspace, setting its spend limit or handling the real key.

## Allowed files

- `scripts/sandcastle/containment-smoke.ts`, `scripts/sandcastle/containment-smoke-guest.ts`
  and their tests, for the two-name exception and the output scan.
- `scripts/sandcastle/isolated-run.ts`, `scripts/sandcastle/isolated-run-smoke.ts`,
  `scripts/sandcastle/guest-runner.ts` and their tests.
- `scripts/sandcastle/quarantine.ts` and its test, only for the token scan of the exported
  candidate.
- `scripts/test-support/isolated-run-*.ts` and `scripts/test-support/containment-*.ts`.
- This ticket and a new `changelog/` fragment.

## Forbidden files

- All other files, including `.github/workflows/` and `.sandcastle/Dockerfile`; no wildcard or
  prefix exception in any guard, no `--network` in `create`, no `--cap-add`, no `HTTPS_PROXY`
  or CA injection, and no token value in any argv, log line or refusal message.
- No real key, token value or workspace identifier in the repository, CI or evidence.

## Human checkpoints

- The owner merges the PR that adds this job spec before work starts. No other owner answer is
  needed; the open questions belong to S30.
- No live model run here. The owner creates the dedicated workspace with a spend limit and holds
  the key before any live run, and each live run needs its own authorization (S18).

## Secrets needed

None. CI and local tests use a made-up token and key.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke` (CI only, since Docker is
  not installed on the authoring machine); `npm run check`.
- Positive: the two names admitted in the bare `--env NAME` form; a run whose output and
  artifacts do not contain the token passes the scans.
- Broken controls, red first: each refused name and flag listed in Acceptance criteria;
  `ANTHROPIC_AUTH_TOKEN=<value>` in argv; the value printed in a refusal; a fake agent that
  writes its environment into a committed file and one that prints it to output.
- Mutants to plant and kill after green: the exception widened to a prefix, the inspect check
  skipped for the two names' values, the token passed as `NAME=value`, a refusal that prints the
  value, the output scan removed, the artifact scan removed.

## Rollback and recovery

Revert the PR. With the exceptions removed, the guards refuse the two names again and runs fall
back to S14's no-credential guest, which fails safely at its first agent.

## Evidence

Record the red and green commits with counts, the mutants, the CI run at the final head and the
smoke's printed scan results, and a statement that no live call was made.

## Wiki and doc updates

The runbook changes wait for S30, when the guest can reach the proxy; until then this ticket
records `[no-doc-change: the two names are admitted but no run passes them until S30 starts the proxy]`.
