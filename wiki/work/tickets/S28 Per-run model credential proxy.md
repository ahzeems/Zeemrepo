---
type: ticket
title: S28 Per-run model credential proxy
summary: A standard-library proxy that accepts only a per-run token on two Messages endpoints, injects the host-held key towards a fixed upstream, streams unbuffered and never reveals the key.
tags: [area/agents, area/auth, area/typescript]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: proposed
owner: agent
priority: P1
next_action: Owner reviews this job spec; when the PR that adds it is merged, build the proxy test first against a fake upstream.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S14 Isolated coordinator preparation and export]]"]
related: ["[[Choose how the model credential reaches the isolated guest]]", "[[Credential proxies for the isolated guest's model calls]]", "[[S29 Per-run guest network and credential wiring]]"]
evidence:
  - "OWNER DECISION: on 2026-10-19 the owner chose \"Build our own tiny proxy (Recommended)\"; the option text is quoted in Choose how the model credential reaches the isolated guest."
  - "INFERRED: this ticket is a follow-up to slices S14 and S18 of the approved remediation plan, not one of the plan's 26 slices, in the way S27 was added by PR 55; it is approved when the owner merges the PR that adds it."
  - "INFERRED: the proxy and the network wiring are split into S28 and S29 because each needs its own red tests and broken controls, and together they would touch the proxy, both S12 and S14 guards, the launcher and the CI smoke in one PR (design-principles: a task that needs more than one plan of three to six lines is too big)."
  - "UNKNOWN: implementation evidence is pending."
---

## Goal

Add `scripts/sandcastle/credential-proxy.ts`, a per-run HTTP proxy that lets the guest call the
Anthropic Messages API with a throwaway token while the real key stays in the host process.

## Inputs

- [[Choose how the model credential reaches the isolated guest]] and its research note.
- Claude Code's gateway requirements as recorded in the research note (llm-gateway-protocol,
  read 2026-10-19); re-read the page before building, since it changes with releases.
- The nearest existing modules: `scripts/sandcastle/isolated-run.ts` (process lifetime, refusal
  style) and `scripts/lib/cli.ts` (exit codes).

## Approach

1. Write the tests first, with a fake upstream started by the test on a loopback port.
2. `startCredentialProxy({ upstream, key, listen })` returns `{ url, token, close }`. The token
   is 32 random bytes from `node:crypto`, made per call. `upstream` is a parameter only so tests
   can pass the fake; the exported default and the CLI entry fix it to `https://api.anthropic.com`.
3. Accept only `POST /v1/messages` and `POST /v1/messages/count_tokens`, matched on the parsed
   path (the query, such as `?beta=true`, is forwarded). Everything else, including `CONNECT`,
   absolute-form targets and `HEAD /api/hello`, gets a fixed refusal and no upstream call.
4. Check `Authorization: Bearer <token>` with `timingSafeEqual`. On a match, drop the client's
   `authorization`, `x-api-key`, `cookie`, `proxy-*`, `host` and hop-by-hop headers, set
   `x-api-key` to the key, and forward `anthropic-*` headers and the body unchanged.
5. Pipe the response back as it arrives: status, `content-type`, `retry-after`,
   `x-should-retry`, `anthropic-ratelimit-*` and `request-id`, and the body including SSE `ping`
   events and error bodies. Never follow a redirect.
6. Scan every response header and body chunk for the key's bytes. Hold back only the longest
   chunk suffix that is a prefix of the key, so a key split across chunks is caught and ordinary
   events are not delayed. On a match, abort the response and log a fixed line.
7. Log only method, path, status and duration. The proxy's own error bodies are fixed strings.
   `close()` stops the listener and destroys open sockets, after which the token is useless.

## Acceptance criteria

- [ ] `node --test scripts/sandcastle/credential-proxy.test.ts` passes, and each case below was
  shown failing at a red commit before the implementation.
- [ ] A request with the right token reaches the fake upstream with `x-api-key` equal to the key
  and no `authorization` header, and its body and `anthropic-version` and `anthropic-beta`
  headers arrive byte for byte.
- [ ] Missing, wrong or reused-after-close tokens get 401, the fake upstream records no request,
  and the response contains neither the token nor the key.
- [ ] Other methods and paths (`GET`, `CONNECT`, `/v1/models`, `/v1/messages/../x`,
  `//evil.example/v1/messages`, an absolute-form target, a `Host: evil.example` header) are
  refused without an upstream call.
- [ ] Exfiltration controls all fail to reveal the key: a fake upstream that echoes the request
  headers into its body, one that echoes them into response headers, one that splits the echoed
  key across two chunks, one that returns 307 to another host, one whose error body carries the
  request, and a client that sends its own `x-api-key` or a second `Authorization` header.
- [ ] A streamed fake response whose events are written 200 ms apart arrives at the client event
  by event (the first event lands before the fake upstream ends), and `ping` events arrive.
- [ ] `retry-after`, `x-should-retry` and `anthropic-ratelimit-unified-*` from the fake upstream
  reach the client unchanged, and a 429 or 529 error body arrives unmodified.
- [ ] Log output captured across every case contains neither the key nor the token.
- [ ] The exported default upstream is `https://api.anthropic.com`, asserted by a test.
- [ ] No new dependency: `package.json` and `package-lock.json` are unchanged.
- [ ] `npm run check` passes at the final commit.

## Out of scope

- Starting the proxy from the launcher, the guest's network, and the S12 and S14 guard
  exceptions: [[S29 Per-run guest network and credential wiring]].
- Any live call to `api.anthropic.com`, creating a workspace, or handling a real key.
- Rate limiting or spend accounting in the proxy; the workspace spend limit is the cap.
- Other providers, `/v1/models` discovery, and Bedrock or Vertex formats.

## Allowed files

- New `scripts/sandcastle/credential-proxy.ts` and `scripts/sandcastle/credential-proxy.test.ts`.
- New `scripts/test-support/fake-anthropic-upstream.ts` if the fake is shared with S29.
- `scripts/lib/change-policy.ts` and its test, only if the new path needs classification.
- This ticket and a new `changelog/` fragment.

## Forbidden files

- All other files, including `scripts/sandcastle/containment-smoke*.ts`,
  `scripts/sandcastle/isolated-run*.ts`, `.github/workflows/`, `package.json` and
  `package-lock.json`.
- Any file holding a real key or a key-shaped literal that could be mistaken for one; test keys
  read as obvious fakes, such as `test-key-not-real-0001`.

## Human checkpoints

- The owner merges the PR that adds this job spec before work starts.
- No live model call, workspace or key is needed or allowed here. Before any live run, the owner
  creates a dedicated Anthropic workspace (not the Default Workspace) with a monthly spend limit
  and holds its key on the host; each live run needs its own authorization (S18). CI uses only
  the fake upstream.

## Secrets needed

None. Tests use a made-up key and a fake upstream on loopback. CI gets no secret.

## Tests and evals

- `node --test scripts/sandcastle/credential-proxy.test.ts`; `npm run check`.
- Positive: forwarding of the two endpoints with the key injected, unbuffered streaming with
  pings, passed-through retry and rate-limit headers.
- Broken controls, each written before the code and shown red: wrong token, other paths and
  methods, host redirection, the five echo and redirect upstreams above, a client-supplied
  credential header, a key split across chunks.
- Mutants to plant and kill after green: header strip removed, key scan removed, carry-over of
  the split key removed, path match loosened to a prefix, `close()` leaving sockets open,
  buffering the whole response before sending.

## Rollback and recovery

The proxy is unused until S29 wires it in, so a revert of this ticket's PR removes it with no
other effect.

## Evidence

Record the red and green commits with counts, the mutants and their results, the test output for
the streaming timing case, and the CI run at the final head. State that no live call was made.

## Wiki and doc updates

The module's own header comment states what the proxy accepts and refuses. The runbook changes
wait for S29, when the proxy is usable; until then this ticket records
`[no-doc-change: the proxy has no caller until S29 wires it into the launcher]`.
