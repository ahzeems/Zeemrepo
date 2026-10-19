---
type: decision
title: ADR-0027 One integration branch per piece of work
summary: A piece of work, however many phases, issues or tickets, lives on one integration branch with one pull request at the end; parallel agents merge local worktree branches into it.
tags: [area/git, area/agents, kind/convention]
created: 2026-10-19
updated: 2026-10-19
agent: claude-code
status: active
related: ["[[ADR-0025 Agents use a machine account and the owner approves]]", "[[ADR-0026 ECC wins over the repository rules]]", "[[Land a change]]", "[[Idea to execution]]"]
---

## Context

Until 2026-10-19 each phase, ticket or settled change started its own branch from `main` and landed
in its own pull request, and a plan was approved only by the owner merging the pull request that added
it. The agent workflow review alone opened PRs #27, #28 and #29 for three phases in one day, and two
more branches were waiting.

The owner decided: "i want to stop creating multiple pull requests for all the work, everything should
be assigned to a singal branch which can be updated until the work is completed, only then a PR will be
required. right now we open too many branches and too many pull requests, the scoped work may require
mutiple phases and multiple issus and tickets but i want them all in one branch so we can build multiple
features and multiple agents and terminals can work from a single branch" (OWNER DECISION, 2026-10-19).
Asked how parallel work shares the branch, how plans are approved and who merges, the owner chose
"Worktrees merge into it (Recommended)", "Your quoted approval (Recommended)" and "You merge it
(Recommended)".

Git checks out a branch in only one worktree at a time, so parallel agents cannot all sit on the same
branch. ECC's `git-workflow` skill never rebases a branch that others have pushed or pulled.

## Decision

Each piece of work has one integration branch, `work/<topic>`, from current `main`. All its phases,
issues and tickets land there, and it gets one pull request through `npm run pr` when the work is
complete. A parallel agent or terminal works in its own worktree on a local branch
`work/<topic>--<name>` and merges it into the integration branch locally; only the integration branch
is pushed. The integration branch is kept current by merging `main`, never rebased. A plan is approved
by the owner's own words, recorded as `OWNER DECISION: "<words>" (YYYY-MM-DD)` in `approval_ref`. Only
the owner approves and merges the pull request.

## Consequences

- Fewer branches and one review: the owner reviews the whole piece of work in one pull request.
- The pull request is large, so the work record carries the evidence for each slice, and review at
  the end covers the whole branch.
- The imported `manage-branch`, `plan-tickets` and `write-plan` skills change to match (revisions in
  `.claude/skills/import-baseline.json` cite this decision).
- `wiki:lint` accepts the quoted approval in `approval_ref` as well as a merged pull request.
- `governance:check` refuses the retired wording that gave each piece of work its own fresh branch or
  approved a plan by a merged pull request alone (claims `branch-per-piece` and `plan-approval-by-merge`).
