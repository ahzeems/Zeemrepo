---
type: decision
title: ADR-0025 Agents use a machine account and the owner approves
summary: Agents act as a machine account that cannot approve its own work; with code-owner review on and no owner credential on their machine, only the owner's approval counts.
tags: [area/git, area/github, area/agents, kind/architecture]
created: 2026-10-10
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[ADR-0008 Owner merges pull requests on GitHub]]", "[[Merge gate contract]]", "[[Land a change]]"]
---

## Context

[[ADR-0008 Owner merges pull requests on GitHub]] made the owner the only one who merges, and
the `protect-main` ruleset enforced that nothing reaches `main` except through a pull request
with passing checks. A security review on 2026-10-10 found the gap that ruleset left. Agents ran
`gh` with the owner's own login, which GitHub cannot tell apart from the owner. A pull request
with passing checks could therefore be merged by an agent. Against that, only the Claude Code
hook and deny rules stood, and a determined command (a variable, an alias, a script) gets past
any hook.

Requiring an approving review does not help on its own. GitHub never lets the author approve
their own pull request, and the agents' pull requests were authored by the owner's account. So a
required approval would have blocked every merge, unless the owner were on the bypass list, which
would hand the bypass to the agents too.

The owner chose a machine account (OWNER DECISION, 2026-10-10: "Machine account
(Recommended)"), and removed their own login from the machine agents use ("Yes, browser-only
(Recommended)").

## Decision

Agents push branches and open pull requests as a machine account with write access. The
`protect-main` ruleset is to require one approving review from a code owner (with
`.github/CODEOWNERS` naming the owner alone, so only the owner's approval counts), dismiss stale
approvals, require approval of the most recent push, and allow no bypass actors. The owner
approves and merges in the browser. No credential for the owner's GitHub account (a `gh` login
or an SSH key registered to it) is to be stored on the machine agents use.

When this decision was recorded (2026-10-10), the owner's `gh` login had been removed and the
ruleset required one approval, but two owner steps were still pending: turning on code-owner
review in the ruleset, and removing an SSH key registered to the owner's account from this
machine. The work record tracks them. `npm run pr` refuses to run
when `gh` is logged in as the repository owner.

## Consequences

- Once both owner steps are done, no agent can merge, because only the owner's approval counts and
  no credential for the owner's account is on this machine. This holds even for a command the hook does not recognise. It
  depends on the code-owner requirement: without it, the machine account could approve a pull
  request it did not open, such as a Dependabot one. It also depends on keeping SSH keys
  registered to the owner's account off this machine, since a push made with one counts as the
  owner's.
- The owner's routine changes: on each pull request, approve under **Files changed**, then
  merge. Dependabot pull requests are approved the same way.
- The machine account's token lives on this machine (`gh` stores it in plain text where no
  keyring exists), so that account needs two-factor authentication and nothing beyond write
  access to this repository.
- Logging the owner's account into `gh` on this machine again reopens the gap. `npm run pr`
  refuses to run under that login, but other `gh` commands would not.
- The hook and deny rules stay as defence in depth; they are no longer the only control.
