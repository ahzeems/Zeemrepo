---
type: ticket
title: Choose how the model credential reaches the isolated guest
summary: The owner chose a tiny in-repo TypeScript proxy that keeps the real key on the host and gives the guest only a per-run token and the proxy address.
tags: [area/agents, area/auth, kind/architecture]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: human
priority: P1
next_action: None. S28 builds the proxy, S29 the network and guard exceptions, and S18 then uses them.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: decision
map: "[[Repository audit remediation map]]"
depends_on: []
related: ["[[Credential proxies for the isolated guest's model calls]]", "[[A scoped model credential for the isolated guest awaits an owner decision]]", "[[S18 Public-command cutover and end-to-end isolation proof]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner wrote: \"https://infisical.com/blog/agent-vault-the-open-source-credential-proxy-and-vault-for-agents#agent-vault -- Research something like this. I want some sort of open-source tool that will do it if we can use something like this, something quick and cheerful. Let's do it.\""
  - "OWNER DECISION: on 2026-10-19, asked \"How should the agent's credential reach the container?\", the owner chose \"Build our own tiny proxy (Recommended)\". The option read: \"One small in-repo TypeScript proxy, no dependencies. A per-run token plus the proxy address go in, the real key stays on the host, the container gets a private network, and the cap is a spend-limited Anthropic workspace. The guards get a narrow exception for exactly those two variables.\" Relayed by the coordinator."
  - "VERIFIED: the research note's evidence lines record what was read for each option on 2026-10-19 (Agent Vault README, LICENSE, docs and issue 445; LiteLLM's virtual-key docs and advisory GHSA-3cv6-jpf6-8222; Caddy's reverse_proxy docs; Claude Code's gateway pages; the Workspaces page) and the repository lines the guards live on (checked by Claude Code, Opus 5.5)."
  - "INFERRED: the decision approves a direction and the S28 and S29 job specs when the owner merges the PR that adds them; it is not authorization to create a workspace, hold a key in any file, or make a live model call."
---

## Question

How should a model credential reach the isolated guest that S14 built, so that S18 can run real
agents there without the real key ever entering the guest?

## Evidence

[[Credential proxies for the isolated guest's model calls]] holds the sources and findings. In
short: S12's launch and inspect checks and S14's Docker call allowlist refuse every credential
variable, `--env` and `--network` today; Claude Code can talk to any gateway named by
`ANTHROPIC_BASE_URL` with a bearer token from `ANTHROPIC_AUTH_TOKEN`; and an Anthropic workspace
other than the Default Workspace can carry a monthly spend limit.

## Options

1. **Build our own tiny proxy.** One small in-repo TypeScript module with no dependencies. The
   guest gets the proxy address and a per-run token; the proxy holds the real key on the host
   and injects it. The guest runs on a private network, and the spend cap is a spend-limited
   workspace. The guards gain an exception for exactly those two variable names.
2. **Agent Vault v0.40.0.** An open-source credential broker. It is a forward MITM proxy that
   needs a trusted CA and `HTTPS_PROXY` in the guest, strict deny mode turned on, and telemetry
   turned off. It is a preview with an open report of 3 reachable vulnerabilities, and its
   container mode adds capabilities S12 refuses.
3. **Caddy reverse proxy.** Mature and streams SSE correctly, but adds a binary to the image and
   CI, and has no per-run token without extra modules or configuration.

## Recommendation

Option 1. It adds no dependency, and its whole behaviour fits in tests this repository already
runs. The guest never needs a CA or proxy variables, and the only guard change is two exact
names. Options 2 and 3 each bring a third-party process into the trust boundary for a job of
about two endpoints.

## Resolution

OWNER DECISION: on 2026-10-19 the owner chose "Build our own tiny proxy (Recommended)". The
option text is quoted in the evidence above. Agent Vault and Caddy were rejected for the reasons
in Options.

The build is split into [[S28 Per-run model credential proxy]] and
[[S29 Per-run guest network and credential wiring]], because the proxy and the network and guard
changes each need their own failing controls and would not fit one pull request. How the guest
gets npm packages without general egress is left as an owner question in S29.
