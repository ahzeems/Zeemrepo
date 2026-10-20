---
type: ticket
title: S30 Per-run internal guest network
summary: Run each isolated guest on its own internal Docker network whose only open peer is the S28 proxy bound to the gateway IP, with the gateway exposure and package egress handled as the owner chooses.
tags: [area/agents, area/auth, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: agent
priority: P1
next_action: Owner answers the package-egress and gateway-exposure questions in Human checkpoints and reviews this job spec; re-size this ticket after both answers, then build after S28 and S29 land.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S29 Guest credential wiring and token handling]]", "[[S28 Per-run model credential proxy]]", "[[S14 Isolated coordinator preparation and export]]", "[[S12 Reproducible runtime and real containment control]]", "[[S15 Independent isolated verification receipts]]"]
related: ["[[Choose how the model credential reaches the isolated guest]]", "[[Credential proxies for the isolated guest's model calls]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner chose \"Build our own tiny proxy (Recommended)\", whose option text includes \"the container gets a private network\"."
  - "VERIFIED: at f72f0d0 the guest setup runs npm ci (scripts/sandcastle/isolated-run.ts line 64) and the coordinator's onSandboxReady hook runs npm install (scripts/sandcastle/coordinator.ts line 54), so both need egress or an offline source; S12's Forbidden files section (line 97 of its ticket) refuses credential copying, which is why the sidecar option below needs an owner decision (read by Claude Code, Opus 5.5)."
  - "INFERRED: from the coordinator's relay of the independent verifier's review of PR 66 at a213a15 (Claude Code verifier subagent, Opus 5.5): on an internal Docker network the guest can still reach the gateway IP, so any host service bound there or on 0.0.0.0 answers it, and the proxy must listen on that same address."
  - "INFERRED: from the coordinator's relay of the independent review of PR 67 at 9cf2c09: S29 as amended was too big for one pull request, so the network, the proxy start, the gateway exposure, package egress and both owner questions moved here on 2026-10-19, with a UDP probe of a few common ports added beside the TCP sweep (Claude Code, Opus 5.5)."
  - "UNKNOWN: how the guest gets packages without general egress, and how the gateway exposure is closed, are open owner questions (Human checkpoints); implementation evidence is pending."
---

## Goal

Run each isolated guest on a per-run internal Docker network whose only open peer is the S28
proxy, bound to that network's gateway IP, and pass the guest the proxy's URL and token through
S29's two-name exception.

## Inputs

- [[S28 Per-run model credential proxy]] and [[S29 Guest credential wiring and token handling]]
  as landed, and the research note's network findings.
- Docker's `network create --internal` reference (re-read before building): containers on an
  internal network reach each other and the gateway IP, and no other network.
- The owner's answers to the two questions below.

## Approach

1. Red first: add the network, proxy-binding and probe tests and commit them failing.
2. In `isolated-run.ts`, allow `create` to carry one `--network`, and add the
   `network create --internal`, `network inspect`, `network rm` (and, if the owner picks package
   option 1 below, `network connect` and `network disconnect`) calls with exact arguments.
3. Launcher: create `sandcastle-<task>` with `--internal`, read its gateway IP from
   `docker network inspect`, start the S28 proxy bound only to that address, and hand its URL
   and token to S29's by-name passing. Remove the network and stop the proxy in the same
   `finally` that removes the container.
4. Close the gateway exposure and provide packages in the ways the owner chose below.
5. Put `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `skipWebFetchPreflight: true` in the
   guest's Claude Code settings file inside the tooling, not in the environment, so the
   exception stays at two names.
6. Extend the CI container control (`npm run sandbox:smoke`) with the probes below and a fake
   upstream; CI keeps using no secret.

## Acceptance criteria

- [ ] The launcher refuses before any Docker call when the token it would pass equals or contains
  the host key, or the base URL is not the proxy's address on the run's network.
- [ ] The launcher binds the proxy only to the run network's gateway IP; a test refuses a run
  whose proxy address is loopback, a wildcard or another network's gateway. S28 binds to
  whatever single address it is given, so this test is what guarantees the address is the gateway.
- [ ] `docker inspect` of the guest shows `NetworkMode` equal to the run's internal network, and
  the inspect check refuses any other network, `host`, `bridge` or `container:` mode.
- [ ] In CI's real-container control, a fake agent inside the guest gets a reply from the fake
  upstream through the proxy, and reads no variable holding the host key.
- [ ] In the same control, from inside the guest: the fake upstream's own address, a public
  address, a DNS lookup of an outside name, and a listener on another Docker network all fail.
- [ ] No host service other than the proxy answers on the run network's gateway IP: a TCP
  connect sweep of every port on that address from inside the guest finds only the proxy port
  open, and a UDP probe of ports 53, 123 and 5353 gets no reply. The control fails when the
  test plants a host TCP listener on `0.0.0.0` or on the gateway IP, or a UDP responder on one
  of those ports. This criterion is met in the way the owner chose below.
- [ ] After the run, success or failure, the network, the container and the proxy are gone.
- [ ] The guest's `npm ci` and the coordinator's `npm install` hook succeed in the way the owner
  chose below, and no package step runs with the token in its environment.
- [ ] S12's, S14's, S15's and S29's existing controls still pass, and `npm run check` passes at
  the final commit with CI green and no secret referenced in any workflow.

## Out of scope

- The proxy itself (S28); the two-name guard exception, token passing and token scans (S29); the
  public-command cutover and the first real-model run (S18).
- Creating the Anthropic workspace, setting its spend limit or handling the real key.
- A general egress allowlist or a package mirror service.

## Allowed files

- `scripts/sandcastle/containment-smoke.ts`, `scripts/sandcastle/containment-smoke-guest.ts`
  and their tests, for the network checks and probes.
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

- All other files, including `scripts/sandcastle/quarantine.ts`; no wildcard or prefix exception
  in any guard, no token value in any argv, log line or refusal message, no `--cap-add`, no
  `--network host` or `bridge` for the agent phase, no `HTTPS_PROXY` or CA injection, no proxy
  bound to a wildcard or loopback for a run, and no host firewall change before the owner
  authorizes it.
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
- **Open owner question: how is the gateway IP exposure closed?** On an `--internal` network the
  guest can still reach the gateway IP, so any host service bound there or on `0.0.0.0` (SSH, a
  dev server, a TCP Docker API) answers it, and the proxy must listen on that same address.
  Options:
  1. A host firewall rule that lets the run network reach the gateway IP only on the proxy
     port. This is an infrastructure change on the owner's machine and the CI runner, and needs
     the owner's authorization.
  2. Run the proxy in a sidecar container on the internal network. This puts the real key in a
     container, which S12's no-credential rule refuses, so it needs an owner decision to change
     that rule.
  3. The owner accepts the exposure as a documented residual risk, and the sweep criterion
     records which ports answer instead of failing on them.
- Until the owner answers both questions, this ticket cannot move to ready. After both answers,
  and before it is marked ready, re-size it: a firewall or sidecar answer can add enough work to
  need another split.
- The owner merges the PR that adds this job spec before work starts.
- No live model run here. The owner creates the dedicated workspace with a spend limit and holds
  the key before any live run, and each live run needs its own authorization (S18).

## Secrets needed

None. CI and local tests use a made-up key and the fake upstream.

## Tests and evals

- `node --test "scripts/sandcastle/*.test.ts"`; `npm run sandbox:smoke` (CI only, since Docker is
  not installed on the authoring machine); `npm run check`.
- Positive: the guest reaching the proxy and the fake upstream through it; the gateway sweep and
  UDP probe finding only the proxy port; clean teardown.
- Broken controls, red first: a wrong `NetworkMode`; the host key placed in the token; a proxy
  address that is loopback, a wildcard or another network's gateway; a reachable outside
  address; a host TCP listener on `0.0.0.0` and on the gateway IP; a UDP responder on 53, 123 or
  5353; a network left behind after a failed run.
- Mutants to plant and kill after green: `--internal` dropped, teardown skipping the network,
  the token copied into a package step's environment, the proxy bound to `0.0.0.0`, the gateway
  sweep skipped, the UDP probe skipped.

## Rollback and recovery

Revert the PR. The guest falls back to running with no network peer for the model, and its first
agent fails safely, as under S14.

## Evidence

Record the red and green commits with counts, the mutants, the CI run and the smoke's printed
network probe, gateway sweep and UDP probe results at the final head, the owner's quoted answers
to the package question and to the gateway-exposure question, and a statement that no live call
was made.

## Wiki and doc updates

Update `wiki/runbooks/Run Sandcastle on GitHub issues.md` with what the guest receives, what the
owner must set up before a live run (workspace, spend limit, key on the host only), and what the
internal network does and does not block, with the date captured.

List as expected, not as faults: Claude Code's fast-mode check goes to `api.anthropic.com`
directly, and WebFetch fetches from the guest itself, with its domain check also calling
`api.anthropic.com` if `skipWebFetchPreflight` is ever off (research note, llm-gateway-protocol
read 2026-10-19). On the internal network these calls fail closed. The smoke and S18 treat those
failures as expected and record them in evidence as such.
