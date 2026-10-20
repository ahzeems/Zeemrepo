---
type: idea
title: npm run pr refuses a code owner's login
summary: npm run pr also refuses when gh is logged in as a user named in .github/CODEOWNERS, because on an organisation-owned repository the owner login is the organisation, not the person.
tags: [area/git, area/agents]
created: 2026-10-13
updated: 2026-10-13
agent: claude-code
status: in-progress
owner: human
priority: P2
next_action: Owner reviews and merges the pull request.
evidence:
  - "VERIFIED: before the change, node --test scripts/git/pr-ready.test.ts ran 24 tests with 19 passing and 5 failing; the code-owner cases failed with 0 !== 1 (exit 0, no refusal) for a gh login named in CODEOWNERS. The negative controls (a different login, no CODEOWNERS file, only comments, a team and an email) already passed, as expected."
  - "VERIFIED: after the change the same file runs 24 tests, all passing, including the refusal for a login in a different case, a refusal that a branch cannot avoid by editing CODEOWNERS on itself, and one message carrying both reasons when the login is the repository owner and a code owner."
  - "VERIFIED: gh repo view Zimfra/software_testing --json owner,isFork reports the owner login Zimfra and isFork true (read 2026-10-13), so before this change a personal code-owner login passed the owner check on this repository."
  - "VERIFIED: after independent review of the first version, scripts/git/pr-ready.test.ts gained three cases (an inline comment that names the login, a comment line that names it, and an unreadable CODEOWNERS tree). Against the first version 3 of 27 failed (the inline comment, the unreadable tree, and the parent of the first); after the change 27 of 27 pass (2026-10-13)."
  - "UNKNOWN: this change was not exercised against a real gh login, because running npm run pr is not allowed in this task; the gh calls are faked in the tests, git is real."
---

## Problem

`npm run pr` refused only when the `gh` login equalled the repository owner's login. In a
repository owned by an organisation that login is the organisation, so the human owner's own
account (the one in `.github/CODEOWNERS`) passed, although ADR-0025 says agents push as the
machine account and the owner never pushes through this tool.

## Desired outcome

The tool also refuses when the authenticated login is a user named in CODEOWNERS (case
insensitive), before anything is pushed, and states why. The existing owner-login refusal stays.

## Next step

Owner review. The change is `codeOwners` and the refusal list in `scripts/git/pr-ready.ts`, its
tests, and one sentence in each of two places in the Merge gate contract.

## Observations

- CODEOWNERS is read from `refs/remotes/origin/main` with `git show`, so a branch cannot edit
  the file to get past the refusal. A file that is absent from that tree, or one with no user
  entries, refuses nothing; a tree that cannot be read stops the tool with exit 2 instead of
  skipping the check. Everything after a `#` on a line is a comment, as on GitHub.
- Team entries (`@org/team`) and email entries are skipped: the tool cannot expand a team, and
  an email is not a `gh` login. A team member's login is therefore not refused.
- ADR-0025 is a decision and keeps its text; the Merge gate contract states the refusal and is updated.
- Not decided here (owner): whether team entries should also be refused, which needs a GitHub API
  call to list members, and whether the machine account should be named as an allowlist instead
  of refusing the owners.
