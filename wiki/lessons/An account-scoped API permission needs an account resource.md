---
type: lesson
title: An account-scoped API permission needs an account resource
summary: Cloudflare API writes kept failing because the token had only a zone resource, so its account-level permissions applied to nothing however often they were added.
tags: [area/auth, kind/pitfall]
created: 2026-09-21
updated: 2026-10-09
agent: claude-code
status: active
---

## What happened

Creating a Cloudflare Tunnel by API returned `10000 Authentication error`, and creating an Access
application returned `1010`. Every read succeeded: tunnels, zones, DNS records, Access
applications. The owner edited the token's permissions twice and the writes kept failing.

A capability probe separated the cases and showed the pattern:

| Operation | Scope | Result |
|---|---|---|
| Tunnel read | account | OK |
| DNS write | zone | **OK** |
| Tunnel write | account | denied |
| Access write | account | denied |

The zone-scoped write worked and both account-scoped writes did not. The permissions had been
added; they were inert. A Cloudflare token lists permissions **and** the resources each scope
applies to, and a token with only a *Zone Resources* entry can hold account permissions that never
apply to anything. Adding the permission again changes nothing, because the permission was never
the missing part.

Adding an *Account Resources* entry naming the account fixed all of it at once.

## Fix

Probe capabilities before assuming a permission is missing, and separate the scopes. A reversible
write tells you more than rereading the token's configuration, which had already been misread
twice:

```bash
# zone-scoped write: create a TXT record, then delete it
curl -s -X POST ".../zones/$ZONE_ID/dns_records" -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"TXT","name":"_probe","content":"probe","ttl":60}'
```

If a zone write succeeds while an account write fails, the token is missing an account
**resource**, not an account **permission**.

## How to apply

When a credential authenticates but is refused, ask what *scope* the refused operation belongs to
before asking what permission it needs. A grant has two halves (what may be done, and what it may
be done to), and an interface that shows them in separate sections invites you to fill in one and
believe you are finished. The error message names neither half.

More generally, a partial capability is the useful signal. Everything failing suggests a bad
credential; some things failing locates the gap. Probe the axes separately, with a reversible
write, and let the pattern say where the hole is. Keep account and zone identifiers in
environment variables, never in notes or commands you paste into the wiki.

Ported from Zimi `wiki/lessons/An account-scoped API permission needs an account resource.md` at 9fb36b2.
