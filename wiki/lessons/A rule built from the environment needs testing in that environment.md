---
type: lesson
title: A rule built from the environment needs testing in that environment
summary: A redaction rule derived the account name serving a page; in a container that name was node, so every page was withheld while every test passed.
tags: [area/auth, area/typescript, kind/pitfall]
created: 2026-09-21
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Redaction checks must cover code, not only notes]]"]
---

## What happened

In Zimi, a publication guard refused a page containing the operator's own identifiers. Rather
than committing a hostname or username to the repository, it derived them at run time from the
process:

```ts
const user = userInfo().username;
if (user.length >= 4 && user !== "root") rules.push({ name: "this machine's username", ... });
```

On a workstation that is a person's name, and the rule is right. The first time the service ran
in a container it answered `500` on every page. The account serving it was `node`, a word on
nearly every page of a vault about a TypeScript repository. The guard was working as written and
withholding the entire site.

Every test passed, before and after. They ran as a user whose name is not a common word, so the
rule under test never matched anything. The suite could not have found this, because the input
that breaks it comes from the environment rather than from the test.

The same latent fault sat in the wiki validator, which built the same rule the same way.
Validating a checkout while logged in as `node` or `ubuntu` would have failed every note that
mentions them.

## Fix

Ignore account names that identify a role rather than a person (`node`, `ubuntu`, `deploy`,
`www-data` and similar) and keep the rule for names that look like people. Both implementations
were fixed, each with its own test.

Zeemrepo carries the fix in `scripts/wiki/redaction.ts`: `isPersonalAccount` rejects names
under four characters and a fixed set of service accounts (including `node`, `root`, `ubuntu`,
`runner`, `deploy`), and `redactionChecks` takes the identity as a parameter, so tests never
depend on the machine running them. `scripts/wiki/redaction.test.ts` asserts that a service
account is not redacted as a personal identifier. The web publication guard was not ported.

## How to apply

When a rule takes its input from the environment (the username, the hostname, the working
directory, the locale, the clock), the test suite only ever sees the environment it runs in. A
green suite says the rule is correct here.

Before shipping such a rule, name the environments it will actually run in and ask what the value
becomes in each. A container's user is a service account. A CI runner's is `runner`. A container
hostname is often a random hex string. Then test those values directly, as a pure function over
the input, or accept that the first real deployment is the test.

The failure was visible at once because the service logged every withheld page with the rule
that fired, and never the value. A guard that refuses silently would have looked like an empty
site with no explanation.

Ported from Zimi `wiki/lessons/A rule built from the environment needs testing in that environment.md` at 9fb36b2.
