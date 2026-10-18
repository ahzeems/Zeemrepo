---
type: idea
title: Shared git config changes while agents work
summary: Worktrees share one repository config, so agents and probes rewrote keys such as core.hooksPath and branch tracking while others ran their checks.
tags: [area/git, area/agents, kind/pitfall]
created: 2026-10-18
updated: 2026-10-18
agent: claude-code
status: backlog
owner: human
priority: P2
next_action: Plan which config keys agents may write, and whether npm run hooks:install or a check notices a changed core.hooksPath.
related: ["[[Improvement loop turns every finding into tracked work]]", "[[Pre-push state check misfires when agents share a repository]]"]
evidence:
  - "INFERRED: the S06 agent reported about 12 refused npm run pr runs on 2026-10-18 because other sessions moved refs or wrote shared config, branch.*.merge and once core.hooksPath, during the check."
  - "INFERRED: in the same session a probe added safe.directory entries to the user's global git config; the owner approved removing them, and core.hooksPath was set back to .githooks."
  - "VERIFIED: on 2026-10-18 git config --get core.hooksPath in the main checkout reported .githooks, and git config --global --get-all safe.directory reported nothing."
---

## Problem

Agents in worktrees of one repository share `.git/config`, and some tools write the global config too. A changed
`core.hooksPath` silently turns the repository's hooks off for every checkout, and stray global entries outlive
the session that wrote them.

## Desired outcome

Agents write only the config keys their own branch needs, a changed `core.hooksPath` is noticed by an existing
command, and probes use a private global config, as the containment guest already does.

## Next step

Reproduce a changed `core.hooksPath` in a fixture and decide which existing command should refuse it.
