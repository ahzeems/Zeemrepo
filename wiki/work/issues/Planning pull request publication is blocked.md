---
type: issue
title: Planning pull request publication is blocked
summary: Planning PR 15 was published as the machine account through a validated bot-only CLI context; the original inactive credential profile remains a local cleanup concern.
tags: [area/auth, area/github, tool/gh]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: human
priority: P1
issue_kind: environment
root_cause: The shared CLI reported an invalid inactive credential profile while the originally active account was a code owner.
fix_ref: https://github.com/Zimfra/software_testing/pull/15
regression_evidence: The earlier npm run pr refused before push; the validated machine-account context ran npm run pr successfully and created PR 15 with author zimmybot and the reviewed head.
prevention: Before publication verify the machine-account actor, repository and clean reviewed SHA; npm run pr still applies authentication, code-owner and branch checks in that context.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
evidence:
  - "VERIFIED: npm run pr at 4cb19802c18914e707fbd39d2a45342d9b6a0158 passed the full check and refused before pushing because gh auth status reported an invalid stored account."
  - "VERIFIED: later read-only checks during planning again returned gh auth status exit 1, identified the active login as a code owner and found no PR for feat/provider-neutral-governance."
  - "INFERRED: the observed authentication state blocked publication and subsequent owner-merged plan approval, but did not block resolving design questions or drafting the proposed plan locally."
  - "VERIFIED: the 2026-10-16 publication recheck identified zimmybot as the repository's write-enabled machine-account collaborator. The first browser authorization returned the code-owner identity again; a second machine-account authorization was requested. No credential or device code is recorded here."
  - "VERIFIED: the owner subsequently authenticated zimmybot, and gh repo view reported WRITE permission. A temporary bot-only CLI context passed gh auth status and verified the actor, repository, branch and clean reviewed SHA without removing saved account profiles."
  - "VERIFIED: npm run pr in that context exited 0 after 766 Node tests, 56 Python tests and all guards passed; PR 15 was created with author zimmybot, base main and head 18e32772ddc74e9debffad66e708b4623e728cf6."
---

## Reproduction

The preceding planning session ran `npm run pr`; its checks passed and publication stopped at
GitHub authentication. Recheck with `gh auth status` and `gh api user --jq .login`, comparing the
active login with the intended machine account and `.github/CODEOWNERS`. Do not copy tokens or
credential-store contents into the evidence.

## Expected and actual

Expected: the PR tool publishes the feature branch through a valid machine-account session.
Initially observed: authentication failed for a stored account, and the active account also
matched a code owner. The branch remained local. The later validated machine-account context
published the branch and opened [PR 15](https://github.com/Zimfra/software_testing/pull/15).

## Root cause

The CLI's whole-account authentication check reports an invalid stored account. Independently,
the active identity does not satisfy the repository's machine-account publication requirement.
Model-provider authentication is a separate concern.

## Fix

The owner completed browser authorization as the intended machine account. Publication used a
temporary `GH_CONFIG_DIR` and HOME with a GitHub credential helper, and the authenticated bot
token was passed only through process memory/environment. The context pinned the actor to
zimmybot, the repository to this fork, and the clean branch to the reviewed SHA before running
the normal PR tool. No saved credential profile was deleted and no publication rule was bypassed.

The original inactive credential still makes the unscoped whole-account check fail. Future
publication needs a valid machine-account context or owner repair of that local profile. The
resolution here establishes publication of this planning PR, not a claim that every local account
was repaired. No token or one-time device code is stored in the repository.

## Verification

The successful preflight checked the authenticated actor, WRITE permission, origin repository,
branch name, clean tree and exact reviewed SHA. GitHub then reported PR 15 as OPEN with author
zimmybot and base main. A created PR does not approve the proposed plan; that still requires the
owner's merge through the existing workflow.

## Prevention

`scripts/git/pr-ready.ts`, run by `npm run pr`, refuses invalid authentication and code-owner
publication. This check prevents publication under the wrong identity; it does not repair local
credentials. A valid machine-account context remains the publication prerequisite.
