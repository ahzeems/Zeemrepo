---
type: idea
title: Sandcastle token setup lessons
summary: Swapping the sandbox GH_TOKEN to the machine account hit five distinct failures; the runbook now lists the steps and the checks that tell them apart.
tags: [area/agents, area/github, tool/claude-code]
created: 2026-10-15
updated: 2026-10-18
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews and merges the pull request, then revokes the replaced tokens, including the one created under the owner account by mistake.
related: ["[[Run Sandcastle on GitHub issues]]", "[[First real Sandcastle run and the wrapper probe fix]]"]
evidence:
  - "VERIFIED: on 2026-10-15 the first machine account token was refused by the organisation for a lifetime over 366 days, and the second could read issues but answered addComment with 'Resource not accessible by personal access token' in the agents' logs."
  - "VERIFIED: a check from the sandbox image with the env file printed the login and the token expiry; a token created under the owner account printed the owner login and could comment, and a token with the machine account as resource owner printed the machine login and answered 403 on comments."
  - "VERIFIED: gh api orgs/<org>/memberships/<machine-account> returned pending while the resource owner list offered only the account itself, and active after the invitation was accepted."
  - "VERIFIED: a new token with the organisation as resource owner still answered 403 until the owner approved it; after approval a comment on the trial issue was authored by the machine account."
  - "UNKNOWN: whether a token created before the invitation is accepted could ever be edited into an organisation token; the runbook says to create a new one because the string and expiry did not change after edits."
  - "VERIFIED: on 2026-10-18 S26 rewrote the runbook's Token setup section: the expiry date is no longer used to tell the old token from the new one, the read check is described as identity evidence only, and a separate owner-approved comment is the write check. GitHub claims cite GitHub Docs pages and one GitHub Changelog post read on 2026-10-18; claims from the 2026-10-15 swap are marked observed."
  - "INFERRED: two different tokens can carry the same expiry date, so the earlier step that read an unchanged date as proof that the file still held the old string was unsupported (audit finding A16)."
---

## Problem

The first real run showed the sandbox token was the owner's personal one. Replacing it with a
machine account token took several rounds because each failure looked like the previous one: a
403 on comments.

## Desired outcome

The runbook's "Token setup" section lists the order that works (accept the invitation, pick the
organisation as resource owner, Issues read and write, owner approval, a read check that prints
the login, then an owner-approved comment that proves write access) so the next swap needs one
pass.

## Next step

Owner review, then revoke the replaced tokens.

## Observations

- [no-doc-change: the runbook itself is updated in this branch; no script or guard changes]
- The check in the runbook runs inside the sandbox image, so it tests the string the loop will
  use and not the one in the owner's shell.
- The expiry date is metadata, not identity: the 2026-10-15 steps compared it with the old
  token's, which an equal date from a different token would defeat. S26 replaced that step with
  a 401 check after revoking the replaced token.
