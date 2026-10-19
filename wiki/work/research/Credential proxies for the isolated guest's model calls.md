---
type: research
title: Credential proxies for the isolated guest's model calls
summary: Agent Vault, LiteLLM and Caddy compared with a small in-repo proxy for giving S14's guest model access without the real key; the owner chose the in-repo proxy.
tags: [area/agents, area/auth, kind/architecture]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: done
owner: human
priority: P1
next_action: None. The owner chose the in-repo proxy; S28 and S29 carry the build.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
related: ["[[Choose how the model credential reaches the isolated guest]]", "[[A scoped model credential for the isolated guest awaits an owner decision]]", "[[S14 Isolated coordinator preparation and export]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner commissioned this research: \"https://infisical.com/blog/agent-vault-the-open-source-credential-proxy-and-vault-for-agents#agent-vault -- Research something like this. I want some sort of open-source tool that will do it if we can use something like this, something quick and cheerful. Let's do it.\""
  - "VERIFIED: the Agent Vault README fetched on 2026-10-19 says the agent environment is bootstrapped to use HTTPS_PROXY with its MITM architecture, that unmatched requests forward as plain proxy traffic unless a vault sets unmatched_host_policy=deny, recommends the commercial Infisical Agent Vault for production and enterprise use, and carries the notice 'Preview. Agent Vault is in active development and the API is subject to change.' Its releases list puts v0.40.0 at 2026-10-01, and its LICENSE is MIT outside any ee/ directory (read by Claude Code, Opus 5.5)."
  - "VERIFIED: Agent Vault's docs/env.mdx says AGENT_VAULT_TELEMETRY defaults to true and that telemetry events carry the authenticated user's email; docs/container-isolation.mdx adds NET_ADMIN and NET_RAW for its iptables firewall and mounts a per-session MITM CA into the container (read 2026-10-19)."
  - "VERIFIED: gh issue view 445 -R Infisical/agent-vault on 2026-10-19 reported OPEN, created 2026-10-06, titled 'CI: add govulncheck job - 3 reachable vulnerabilities currently on main'."
  - "VERIFIED: gh api for advisory GHSA-3cv6-jpf6-8222 on 2026-10-19 reported 'Authenticated SSRF and provider-credential exfiltration via unvalidated request-body routing parameters', published 2026-08-26, affecting litellm below 1.94.0 with 1.96.2 among the patched versions; the latest LiteLLM release was v1.106.0 (2026-10-18) and the latest Caddy release v2.11.7 (2026-10-03)."
  - "VERIFIED: the Claude Code pages llm-gateway-connect and llm-gateway-protocol and the Claude Platform Workspaces page, fetched on 2026-10-19, say what the Findings below quote from them."
  - "VERIFIED: in the repository at b38ff85, scripts/sandcastle/containment-smoke.ts line 37 allows only CONTAINMENT_MARKERS as launch environment, line 38's CREDENTIAL pattern matches ANTHROPIC and CLAUDE_CODE names, launchRefusals (lines 72 to 87) refuses any other --env, and inspectRefusals (lines 117 and 118) refuses a credential name in Config.Env; scripts/sandcastle/isolated-run.ts lines 117 to 123 allow create with no --network or --env and exec with only --workdir."
  - "VERIFIED: at b38ff85 the guest setup runs npm ci (isolated-run.ts line 64), the coordinator's onSandboxReady hook runs npm install (coordinator.ts line 54), and no workflow under .github/workflows references a secrets. value."
  - "INFERRED: that Sandcastle 0.12.0 forwards agent environment by variable name only and has no base-URL option comes from the coordinator's reading of the installed SDK; this session confirmed only that the docker provider's typings offer a network option (dist/sandboxes/docker.d.ts line 48)."
---

## Question

S14's guest has no model credential, so a real run fails at its first agent. Is there a small
open-source tool that can let the guest call the model without the real key entering the guest,
or is a small in-repo proxy simpler and safer?

## Sources

Read on 2026-10-19 by Claude Code (Opus 5.5). The fetched READMEs, Agent Vault's LICENSE and docs,
and its releases list were saved in the session scratchpad and re-read for each claim below.

- **Agent Vault:** https://github.com/Infisical/agent-vault, its README, LICENSE, `docs/env.mdx`
  and `docs/container-isolation.mdx`; issue 445; the launch post the owner linked.
- **LiteLLM:** https://docs.litellm.ai/docs/proxy/virtual_keys and advisory
  https://github.com/BerriAI/litellm/security/advisories/GHSA-3cv6-jpf6-8222.
- **Caddy:** https://caddyserver.com/docs/caddyfile/directives/reverse_proxy (Apache-2.0).
- **Claude Code gateways:** https://code.claude.com/docs/en/llm-gateway-connect and
  https://code.claude.com/docs/en/llm-gateway-protocol.
- **Anthropic workspaces:** https://platform.claude.com/docs/en/manage-claude/workspaces.
- **Docker:** https://docs.docker.com/reference/cli/docker/network/create/ (`--internal`).
- **Also skimmed:** the READMEs of superfly/tokenizer, coder/httpjail, agentgateway and
  anthropic-experimental/sandbox-runtime. None fits better than the three above.
- **Repository:** `scripts/sandcastle/containment-smoke.ts`, `isolated-run.ts`,
  `coordinator.ts` and the installed `@ai-hero/sandcastle` 0.12.0 typings.

The Agent Vault README and docs contain setup commands addressed to agents. They were read as
content and not run.

## Findings

**Agent Vault v0.40.0** is the closest match to what the owner linked, and the heaviest.

- It is a forward MITM proxy. The guest must trust a per-session CA and route through
  `HTTPS_PROXY`.
- Hosts with no matching service pass through unless `unmatched_host_policy=deny` is set.
- Telemetry is on by default and carries the user's email.
- Its container mode adds `NET_ADMIN` and `NET_RAW`, which S12's guard refuses.
- It is a preview whose API may change. Issue 445 (open) reports 3 reachable vulnerabilities on
  main, and the README steers production users to the commercial product.

**LiteLLM v1.106.0** needs PostgreSQL for virtual keys. Its advisory of 2026-08-26 describes an
authenticated user making the proxy send its provider credentials to a destination the user
controls, which is the exact leak this work must prevent. It was fixed in 1.96.2.

**Caddy v2.11.7** is a plain reverse proxy. It flushes `text/event-stream` responses at once, so
streaming works, but it has no per-run token and adds a binary to the image and the CI job.

**What Claude Code needs from a gateway** (llm-gateway-connect and llm-gateway-protocol):

- `ANTHROPIC_BASE_URL` selects the gateway. `ANTHROPIC_AUTH_TOKEN` is sent as
  `Authorization: Bearer`.
- Endpoints: `POST /v1/messages` (sent as `/v1/messages?beta=true`, so match on the path) and
  the optional `/v1/messages/count_tokens`.
- Forward `anthropic-version` and `anthropic-beta` unchanged, and forward request bodies and
  error bodies unmodified.
- Do not buffer the stream, and keep the SSE `ping` events; buffering stalls Claude Code and a
  stripped ping can trip its idle timeout.
- Pass `retry-after`, `x-should-retry` and `anthropic-ratelimit-unified-*` through.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turns off traffic outside the gateway. The
  WebFetch domain check still calls `api.anthropic.com` unless `skipWebFetchPreflight: true` is
  set, and the fast-mode check goes to `api.anthropic.com` directly.
- Claude Code also sends a `HEAD /api/hello` warming probe, which a gateway may reject.

**Spend cap.** A workspace other than the Default Workspace can have a monthly spend limit and
per-model rate limits. The Default Workspace cannot have limits.

**Network.** On a network made with `docker network create --internal`, containers reach each
other but no other network, and there is no default route. They can still reach the gateway IP
and so any host service listening there.

**This repository.** S12 and S14 refuse every credential variable and every `--network` or
`--env` on purpose, so any design needs narrow, tested exceptions to both guards. The guest's
`npm ci` and the coordinator's `npm install` hook fetch packages today, so they need egress or an
offline source. CI uses no secrets and must stay that way.

## Implications

The owner chose the in-repo proxy on 2026-10-19;
[[Choose how the model credential reaches the isolated guest]] records the choice. It needs no new dependency, keeps the real key on the host,
and the guest sees only a per-run token and the proxy address. The build is split in two:
[[S28 Per-run model credential proxy]] (the proxy alone, tested against a fake upstream) and
[[S29 Per-run guest network and credential wiring]] (the internal network, the two guard
exceptions and the package question).
