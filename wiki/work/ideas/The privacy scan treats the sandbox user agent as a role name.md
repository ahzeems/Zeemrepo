---
type: idea
title: The privacy scan treats the sandbox user agent as a role name
summary: The wiki redaction scan lists agent beside node and runner as a role name, so wiki:lint passes for the Sandcastle sandbox user and agents need no --no-verify for it.
tags: [area/wiki, area/agents]
created: 2026-10-12
updated: 2026-10-13
agent: claude-code
status: done
owner: human
priority: P2
next_action: None; the role-name change and the home-path follow-up are both delivered.
evidence:
  - "VERIFIED: pull request #2 on Zimfra/software_testing, which added agent to the role names, was merged by the owner on 2026-10-13 (merge commit bf3e407)."
  - "VERIFIED: the home-path follow-up is delivered by branch feat/sandcastle-integration: scripts/wiki/redaction.test.ts failed before the change and passes 36 of 36 after it, and a path under the agent home is allowed while the agentsmith, agent-smith and alice homes are still flagged for the agent, node and alice logins."
  - "OWNER DECISION: \"add agent to the role names which roles explain this with an example\" (2026-10-12), after the options were laid out: add agent to the role names, or rename the sandbox user."
  - "VERIFIED: scripts/wiki/redaction.test.ts failed before the change (the service-account test, 1 of 35, because agent counted as a personal username) and passes after (35 of 35); scripts/wiki/wiki-validation.test.ts passes 59 of 59; npm run lint and npm run typecheck are clean."
  - "OWNER DECISION: asked whether the explanation and an example should live in the code comment (B) or only be given in chat (A), the owner answered \"b\" (2026-10-13)."
  - "VERIFIED: the Sandcastle implementer's own log for issue 1 (a local, untracked file under .sandcastle/logs) shows two commits made with git commit --no-verify (log lines 65 and 95), and lines 86 to 88 read (line breaks joined): - Committed with --no-verify: the pre-commit wiki:lint step fails only on an environment artifact (sandbox username \"agent\" matches the word \"agent\" in every note's `agent:` field); it fails identically on clean main. The log is not in this pull request, so the owner can only check it on the machine that ran Sandcastle. That is the bypass this change removes the cause of."
  - "VERIFIED: after review of 65456da, redaction.test.ts has 36 tests, all passing. In a scratch copy, removing agent from the list fails 2 tests, and making the home-path pattern skip the agent user fails 1 (the new home-path test). The earlier login assertion matched /username/, which also matches the home-path check names, so it could not fail; the tests now match the exact check name."
  - "VERIFIED: local only, it needs the untracked sandbox image and cannot be reproduced from this pull request. In the Sandcastle sandbox image running as the user agent, npm run wiki:lint on a copy of this branch exits 0. Before the change the same check, run as agent, flagged the agent: field of repository notes as this machine's username."
  - "VERIFIED: local only, in the same untracked sandbox image. A control note containing a home path with a real username is still flagged by wiki:lint there, so the list entry did not switch off the path check."
  - "VERIFIED: the upstream Sandcastle README (https://github.com/mattpocock/sandcastle/blob/main/README.md, read 2026-10-12, paraphrased here, not quoted) names a non-root agent user as required and mounts the repository under that user's home directory."
  - "VERIFIED: in a local container of the built sandbox image, /etc/passwd lists agent with uid 1000 and a home directory named after the user (observed 2026-10-12). Not reproducible from this pull request, because .sandcastle/ is untracked; the Dockerfile there sets the user id argument to 1000."
---

## Problem

The Sandcastle sandbox image runs as a user named `agent`. The wiki privacy scan
(`scripts/wiki/redaction.ts`) flags the machine's login name wherever it appears, and `agent` is
also the value of the `agent:` field in every note. Run as `agent`, `wiki:lint` therefore failed
on the notes, so the pre-commit hook failed inside the sandbox and the agents committed with
`--no-verify`.

## Desired outcome

`agent` counts as a role name, like `node`, `runner` and `ci`, so the scan passes in the
sandbox while a login that names a person is still flagged.

## Next step

Owner review. The change is one word in `SERVICE_ACCOUNTS`, the comment above it that says what a
role name is, and the assertions in `scripts/wiki/redaction.test.ts`.

## Observations

- Renaming the sandbox user was the alternative. The Sandcastle README says the `agent` user is
  required and bind-mounts the repository under that user's home directory, and any other name of
  four characters or more would be flagged the same way unless it was also added to the list.
- Not covered by pull request #2: the sandbox user's home-directory paths in `.sandcastle/Dockerfile`.
  They tripped the separate home-path pattern (`redaction.ts`, "home path with username"), which
  allowed only `<user>` and `linuxbrew`. Branch feat/sandcastle-integration also allows a path
  under the role-name home `agent`, with a test-first change.
- [no-doc-change: the change adds one name to an existing list and a comment above it, and no written rule states the list]
- A rule that lists accounts is built from the environment, so it has to be tested in the
  environment that fails: [[A rule built from the environment needs testing in that environment]].
