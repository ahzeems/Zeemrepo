---
type: session
title: 2026-10-16 Provider-neutral authoring
summary: The owner requested provider-neutral authoring after the audit planning handoff exposed harness restrictions; tests first reproduced the barriers before their removal.
tags: [area/agents, area/wiki]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: active
idea: "[[Allow any agent provider to work in the repository]]"
---

## Goal

Allow the current agent to plan and record audit remediation under the shared repository rules.

## What was done

Identified the author, adapter, governance and workflow-path restrictions. Added targeted tests
and observed their failures before updating the checks. Recorded the owner's policy decision in
[[ADR-0026 Any provider may work under shared rules]] and the workflow in
[[Work with any agent provider]].

The owner then requested committed planning and a pull-request handoff for execution by a
different LLM session. Recorded the baseline inventory, project, map, three unresolved decisions,
publication prerequisite and [[Resume repository audit remediation]].

The owner selected full-workflow isolation with a controlled host import. Recorded the answer in
[[Choose the Sandcastle execution boundary]], updated the map's frontier and opened
[[Establish a feasible isolated Sandcastle handoff]] for the remaining factual design question.

The owner approved the partial-failure policy in [[Define Sandcastle partial-failure outcomes]].
Recorded the four approved behaviors and advanced the map to the history-scope decision.

The owner selected fork-only auditing and requested detailed progress explanations. Verified
the inherited starting commit against Git history and the fork's first merged PR, recorded the
scope in [[Choose the landing audit history scope]], and added the reporting preference to the
fresh-session handoff. Began the isolated-handoff feasibility research.

Moved the publication prerequisite to [[Planning pull request publication is blocked]] and
superseded its map ticket: a delivery authentication issue should not block design-map completion.

Source research identified the SDK's no-sandbox provider as a supported inner runtime for an
outer disposable container. A temporary Git experiment preserved the exported commit SHA,
rejected a missing-prerequisite bundle, and transferred no source config, hook or untracked file.
Recorded the research limits and [[Audit remediation verification approach]] for owner agreement.

After the owner directed the agent to proceed and complete the PR, recorded
[[Repository audit remediation implementation plan]] with 26 proposed slices covering A01-A22,
their dependencies, acceptance controls and the fresh-session approval/execution contract.

The plan exposed a validator defect that counted a downstream plan as an unfinished map ticket.
Added a failing regression control and fixed the type check; all 40 work-tracking tests then
passed. The proposed-plan tree passed the full check with 766 Node and 56 Python tests, plus
all seven trusted guard CLIs from main. The initial plan uses a related map link until that fix lands.

The owner authenticated the machine account. A validated bot-only CLI context ran the normal PR
tool successfully and opened [PR 15](https://github.com/Zimfra/software_testing/pull/15) as zimmybot.
Independent standards/spec reviews and verification at 18e3277 passed; owner review was pending at publication.

GitHub then reported the owner's merge of PR 15 as edb9e35 while the publication-record follow-up
was in flight. The PR tool opened PR 16 for that follow-up. Merged current main into the branch,
recorded the verified plan approval and restored its typed map link so the next session starts
at job-spec creation rather than repeating completed planning or publication work.

After PR 16 merged, the owner requested the build job specs and required issues. Reverified the
plan approval, created S01-S26 from the approved breakdown, linked them from the plan and added
the current Docker-proof and inactive-auth-profile environment issues. Each proposed job records
its file boundaries, acceptance controls, human checkpoints, secrets, recovery and evidence needs.
Structural inspection confirmed all 13 required sections and exact parent lists for each job,
with an acyclic graph and S01 as the sole root. The full check passed 766 Node tests and 56 Python
tests; wiki-lint validated 97 notes.

## Outcome

The implementation and verification are tracked in the originating idea. The work was authored
through OpenCode with GPT-6 Astra, using the repository skills directly rather than an ECC run.
The full check passed 762 Node tests and 56 Python tests. Main's wiki, skill, governance and
ECC-rules guards also passed against the changed tree.

## Open items

The plan and approval handoff are merged. Obtain owner approval of the proposed S01-S26 job specs,
then the next LLM verifies that approval and begins S01 before its dependants. Live containment
proof remains implementation work, with current environment limits recorded in the linked issues.
