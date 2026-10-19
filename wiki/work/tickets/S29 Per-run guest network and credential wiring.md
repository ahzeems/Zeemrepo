---
type: ticket
title: S29 Per-run guest network and credential wiring
summary: Put each isolated run on its own internal Docker network that reaches only the S28 proxy, and let the guards admit exactly ANTHROPIC_BASE_URL and a per-run ANTHROPIC_AUTH_TOKEN.
tags: [area/agents, area/auth, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: agent
priority: P1
next_action: Owner answers the package-egress question in Human checkpoints and reviews this job spec; build after S28 lands.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S28 Per-run model credential proxy]]", "[[S14 Isolated coordinator preparation and export]]", "[[S12 Reproducible runtime and real containment control]]", "[[S15 Independent isolated verification receipts]]"]
related: ["[[Choose how the model credential reaches the isolated guest]]", "[[Credential proxies for the isolated guest's model calls]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner chose \"Build our own tiny proxy (Recommended)\", whose option text includes \"the container gets a private network\" and \"The guards get a narrow exception for exactly those two variables.\""
  - "VERIFIED: at b38ff85 scripts/sandcastle/containment-smoke.ts lines 37 and 38 (ALLOWED_ENV, CREDENTIAL), launchRefusals at lines 72 to 87, the Config.Env check in inspectRefusals at lines 117 and 118, and the CALLS allowlist in scripts/sandcastle/isolated-run.ts lines 117 to 123 refuse what this ticket must admit; the guest setup's npm ci (isolated-run.ts line 64) and the coordinator's npm install hook (coordinator.ts line 54) fetch packages (read by Claude Code, Opus 5.5)."
  - "INFERRED: S15 is a dependency because its verifier driver also runs npm ci in a container launched under S12's checks (verifier-driver.ts line 24), so a changed guard must keep its control green."
  - "UNKNOWN: whether the guest needs general egress for packages is an open owner question (Human checkpoints); implementation evidence is pending."
---

## Goal

Run each isolated guest on a per-run internal Docker network whose only useful peer is the S28
proxy, passing it exactly `ANTHROPIC_BASE_URL` and a per-run `ANTHROPIC_AUTH_TOKEN`, with the
S12 and S14 guards admitting those two names and nothing more.

## Inputs

- [[S28 Per-run model credential proxy]] as landed, and the research note's network findings.
- Docker's `network create --internal` reference (re-read before building): containers on an
  internal network reach each other and the gateway IP, and no other network.
- The guards as they stand on main: `containment-smoke.ts` (`ALLOWED_ENV`, `CREDENTIAL`,
  `launchRefusals`, `inspectRefusals`) and `isolated-run.ts` (`CALLS`, `createArgs`, `SETUP`).
- The owner's answer to the package-egress question below.

## Approach

1. Red first: add guard tests that the two names pass only in their exact form, then the
   network and wiring tests, and commit them failing.
2. Guards: in `containment-smoke.ts`, admit `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` by
   exact name in both launch and inspect checks; every other `CREDENTIAL` match stays refused.
   In `isolated-run.ts`, allow `create` to carry one `--network` and `--env` for those two names
   only, and add the `network create --internal`, `network rm` (and, if the owner picks option
   1 below, `network connect` and `network disconnect`) calls with exact arguments.
3. Launcher: create `sandcastle-<task>` with `--internal`, start the S28 proxy where the guest
   can reach it on that network, pass its URL and token, and remove the network and stop the
   proxy in the same `finally` that removes the container.
4. Put `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `skipWebFetchPreflight: true` in the
   guest's Claude Code settings file inside the tooling, not in the environment, so the
   exception stays at two names.
5. Extend the CI container control (`npm run sandbox:smoke`) with the network probes below and
   a fake upstream; CI keeps using no secret.

## Acceptance criteria

- [ ] Guard tests pass and were red first: `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` are
  admitted; `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN_2`, `anthropic_auth_token`, `GH_TOKEN`,
  `CLAUDE_CODE_OAUTH_TOKEN`, an `--env-file`, and a third `--env` are still refused.
- [ ] The launcher refuses before any Docker call when the token it would pass equals or contains
  the host key, or the base URL is not the proxy's address on the run's network.
- [ ] `docker inspect` of the guest shows `NetworkMode` equal to the run's internal network, and
  the inspect check refuses any other network, `host`, `bridge` or `container:` mode.
- [ ] In CI's real-container control, a fake agent inside the guest gets a reply from the fake
  upstream through the proxy, and reads no variable holding the host key.
- [ ] In the same control, from inside the guest: the fake upstream's own address, a public
  address, a DNS lookup of an outside name, and a listener on another Docker network all fail;
  a listener the test plants on the internal network's gateway IP is reported, so the evidence
  says plainly what the gateway exposes.
- [ ] After the run, success or failure, the network, the container and the proxy are gone.
- [ ] The guest's `npm ci` and the coordinator's `npm install` hook succeed in the way the owner
  chose below, and no package step runs with the token in its environment.
- [ ] S12's, S14's and S15's existing controls still pass, and `npm run check` passes at the
  final commit with CI green and no secret referenced in any workflow.

## Out of scope

- The proxy itself (S28); the public-command cutover and the first real-model run (S18).
- Creating the Anthropic workspace, setting its spend limit or handling the real key.
- A general egress allowlist or a package mirror service.

## Allowed files

- `scripts/sandcastle/containment-smoke.ts`, `scripts/sandcastle/containment-smoke-guest.ts`
  and their tests, for the two-name exception and the network probes.
- `scripts/sandcastle/isolated-run.ts`, `scripts/sandcastle/isolated-run-smoke.ts`,
  `scripts/sandcastle/guest-runner.ts` and their tests.
- `scripts/sandcastle/coordinator.ts` and its test, only for the install hook if the owner's
  answer needs it.
- `scripts/sandcastle/credential-proxy.ts`, only to export what the launcher needs.
- `scripts/test-support/isolated-run-*.ts`, `scripts/test-support/containment-*.ts` and
  `scripts/test-support/fake-anthropic-upstream.ts`.
- `.sandcastle/Dockerfile` for the guest settings file; `.github/workflows/check.yml` only if
  the smoke step's invocation must change.
- `wiki/runbooks/Run Sandcastle on GitHub issues.md`, this ticket and a new `changelog/`
  fragment.

## Forbidden files

- All other files; no wildcard or prefix exception in any guard, no `--cap-add`, no
  `--network host` or `bridge` for the agent phase, no `HTTPS_PROXY` or CA injection.
- No real key, token value or workspace identifier in the repository, CI or evidence.

## Human checkpoints

- **Open owner question: how does the guest get npm packages without general egress?** Options:
  1. Install while the guest is still on Docker's default network, then disconnect it and
     connect it to the internal network before the coordinator or any agent starts, with the
     install hook switched to an offline install from that cache. Recommended: the smallest
     change, and no agent ever runs with egress.
  2. Bake the tooling's `node_modules` into the image at build time, so the guest never
     installs. Adds image rebuilds to every dependency change.
  3. Allow egress to the npm registry only, through a second allowlisting proxy. Adds a second
     proxy to the trust boundary.
  Until the owner answers, this ticket cannot move to ready.
- The owner merges the PR that adds this job spec before work starts.
- No live model run here. The owner creates the dedicated workspace with a spend limit and holds
  the key before any live run, and each live run needs its own authorization (S18).

## Secrets needed

None. CI and local tests use a made-up key and the fake upstream.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke` (CI only, since Docker is
  not installed on the authoring machine); `npm run check`.
- Positive: the two names admitted; the guest reaching the proxy and the fake upstream through
  it; clean teardown.
- Broken controls, red first: each refused name and flag listed in Acceptance criteria; a wrong
  `NetworkMode`; the host key placed in the token; a reachable outside address; a network left
  behind after a failed run.
- Mutants to plant and kill after green: the exception widened to a prefix, the inspect check
  skipped for the two names' values, `--internal` dropped, teardown skipping the network, the
  token copied into a package step's environment.

## Rollback and recovery

Revert the PR. With the exceptions removed, the guards refuse the two names again and runs fall
back to S14's no-credential guest, which fails safely at its first agent.

## Evidence

Record the red and green commits with counts, the mutants, the CI run and the smoke's printed
network probe results at the final head, the owner's quoted answer to the package question, and
a statement that no live call was made.

## Wiki and doc updates

Update `wiki/runbooks/Run Sandcastle on GitHub issues.md` with what the guest receives, what the
owner must set up before a live run (workspace, spend limit, key on the host only), and what the
internal network does and does not block, with the date captured.
