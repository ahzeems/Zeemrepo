---
type: decision
title: ADR-0025 Agents use a machine account and the owner approves
summary: Agents push and open pull requests as a machine account that cannot approve its own work; the ruleset requires the owner's approval, and the owner's GitHub login is not on the machine agents use.
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
`protect-main` ruleset requires one approving review, dismisses stale approvals, requires
approval of the most recent push, and has no bypass actors. The owner approves and merges in the
browser; the owner's GitHub login is not stored on the machine agents use. `npm run pr` refuses
to run when `gh` is logged in as the repository owner.

## Consequences

- No agent can merge, because the machine account cannot approve the pull requests it authors,
  and the account that can approve is not on this machine. This holds even for a command the
  hook does not recognise.
- The owner's routine changes: on each pull request, approve under **Files changed**, then
  merge. Dependabot pull requests are approved the same way.
- The machine account's token lives on this machine (`gh` stores it in plain text where no
  keyring exists), so that account needs two-factor authentication and nothing beyond write
  access to this repository.
- Logging the owner's account into `gh` on this machine again reopens the gap. `npm run pr`
  refuses to run under that login, but other `gh` commands would not.
- The hook and deny rules stay as defence in depth; they are no longer the only control.
