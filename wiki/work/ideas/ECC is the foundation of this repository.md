---
type: idea
title: ECC is the foundation of this repository
summary: The ECC plugin and its skills are the foundation the repository builds on; nothing added here may block ECC, and ECC wins where a repository rule disagrees.
tags: [area/agents, area/planning, tool/ecc]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: in-progress
owner: human
priority: P1
next_action: Owner merges the pull request that adds the ECC foundation plan; then slice 1 starts on a fresh branch.
evidence:
  - "OWNER DECISION: 2026-10-19, the owner wrote: 'the ECC skills are the foundation, everything should be build around them, nothing should restrict ecc or block them ... the ECC plugin and skills are the foundation helped to build this repo and nothing we add should block ecc'."
  - "OWNER DECISION: 2026-10-19, asked how the rule treats ECC steps that meet the landing decisions, the owner chose the option labelled 'ECC wins everywhere'. The option's description, written by the agent, read: 'ECC skills and rules take precedence over every repository rule. The Overrides of ECC sections are retired, and the push/force-push/merge deny rules and hook are reviewed for removal.'"
  - "OWNER DECISION: 2026-10-19, asked which ECC hooks should run in this repository, the owner chose 'Keep all'."
  - "OWNER DECISION: 2026-10-19, the owner said: 'dont build nothing, just commit the plan to main so we can commit, will work on this tomorrow'."
  - "VERIFIED: CLAUDE.md lines 30-31 say the zeem rule wins over an ECC rule or skill, and .claude/rules/zeem/ holds 14 Overrides of ECC entries across five files (read 2026-10-19)."
---

## Problem

The repository's rules put themselves above ECC: `CLAUDE.md` says the `zeem` rule wins, and
each rule file lists where it overrides ECC. On 2026-10-19 the ECC plugin turned out not to be
installed, and a same-day branch (`fix/ecc-command-overrides`, never pushed) went on to deny
five ECC commands. That is the opposite of what the owner wants.

## Desired outcome

ECC is the foundation. Repository rules, skills, hooks and checks build on it and never stop an
ECC skill, agent or command from loading or running; where they disagree, ECC wins and the
repository text changes. What stays of the controls on merge and approve steps is an open owner
question in the plan.

## Next step

The plan is [[ECC foundation plan]]. Nothing is built until the owner merges it.

## Observations

- The unpushed branch `fix/ecc-command-overrides` contradicted this decision. It was never pushed
  or opened as a pull request, and the owner had it deleted on 2026-10-19 ("delete the old
  branch"); its last commit was `01f876c`.
