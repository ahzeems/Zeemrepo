---
type: research
title: Software factory functions, gaps and build inventory
summary: Hermes Agent's functions mapped to what Zeemrepo already has, what is missing, and the tools, skills and connectors the factory needs.
tags: [area/agents, area/planning, kind/architecture]
created: 2026-10-18
updated: 2026-10-19
agent: claude-code
status: proposed
owner: human
priority: P1
next_action: The owner reviews this research and the requirement interview in the idea; on approval a planner writes the factory plan and its first slice through write-plan.
idea: "[[Software factory runs ideas to completion]]"
related: ["[[Repository tickets drive parallel agent work on a kanban board]]", "[[Smallest slice of a repository ticket board and its evals]]", "[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "OWNER DECISION: on 2026-10-18 the owner named Hermes Agent as the reference: \"hermes is a good example of functionalikty required\"."
  - "VERIFIED: Hermes Agent docs and repository read on 2026-10-18 (sources below); latest release v0.22.2, 2026-10-15."
  - "VERIFIED: on 2026-10-18 scripts/sandcastle/ held afk, already-done, branch-guard, containment-smoke and plan-schema with tests; there was no scripts/work/ directory and no board, dispatcher, notification or usage-ledger code (ls)."
  - "VERIFIED: on 2026-10-18 .sandcastle/plan-prompt.md ran gh issue list, scripts/sandcastle/plan-schema.ts accepted only numeric ids and sandcastle/issue-<n> branches, and scripts/sandcastle/afk.ts matched branches with ISSUE_BRANCH (read)."
  - "VERIFIED: after merging main on 2026-10-18 the Sandcastle loop lives in scripts/sandcastle/coordinator.ts (S08, PR 39), and plan-prompt.md, plan-schema.ts and afk.ts still carry the GitHub-issue coupling (grep)."
  - "VERIFIED: on 2026-10-18 the owner's machine had no docker command (command -v docker); still none on 2026-10-19."
  - "VERIFIED: after merging main on 2026-10-19, S01-S17 and S19-S27 are done and S18 is proposed (ticket front matter); scripts/sandcastle/ now holds isolated-run.ts (S14), verifier-driver.ts and verification-receipt.ts (S15), isolated-publication.ts (S16), and run-state.ts, recovery.ts and notifications.ts (S17) (ls, read)."
  - "VERIFIED: on 2026-10-19 the landed pipeline keys its state by issue: run-state.ts keeps one JSON file per issue, recovery.ts recovers a Sandcastle issue, and notifications.ts posts each notice as a comment on the issue with gh (read)."
  - "INFERRED: the Hermes requirements the owner chose map onto existing Zeemrepo parts as listed under Findings; each row names its evidence path."
---

Use evidence and owner decisions; do not invent approval.

## Question

What functions does a software factory need, taking Hermes Agent as the reference? Which of them
does Zeemrepo already have, which are missing, and what tools, skills and connectors are needed for
it to work here under the decisions recorded in [[Software factory runs ideas to completion]]?

## Sources

All read on 2026-10-18.

- Hermes Agent repository: https://github.com/NousResearch/hermes-agent (MIT, v0.22.2 of 2026-10-15)
- Kanban: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Skills: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Memory: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Security: https://hermes-agent.nousresearch.com/docs/user-guide/security
- This repository: `.sandcastle/`, `scripts/sandcastle/` (including `coordinator.ts`), `scripts/wiki/work-tracking.ts`,
  `scripts/git/pr-ready.ts`, `.claude/agents/`, `.claude/rules/zeem/`, `wiki/decisions/`.

## Findings

### What Hermes does

- **Board.** A Kanban stored in SQLite per board, statuses triage, todo, ready, running, blocked,
  review, done, archived; a task becomes ready when its parents are done.
- **Dispatcher.** Runs every 60 seconds inside the gateway: claims ready tasks, starts one worker
  process per task with a named profile, recovers stale or crashed work, blocks a task after
  repeated failures.
- **Worker protocol.** Workers end through `kanban_complete`, `kanban_block` or
  `kanban_request_review`; exiting without one is a protocol violation.
- **Workspaces.** Scratch directory, an existing directory, or a git worktree per task.
- **Review.** A separate reviewer with the bundled `sdlc-review` skill; optionally gated on GitHub
  checks.
- **Self-improvement.** The agent writes skills (`SKILL.md` folders) through `skill_manage`; an optional
  `write_approval` queue holds them for review.
- **Memory.** Small Markdown files loaded each session; session history in SQLite.
- **Surfaces.** Terminal UI, a web dashboard with the Kanban plugin, a chat gateway (Telegram,
  Discord, Slack, WhatsApp, Signal, email), a scheduler.
- **Where it conflicts with this repository.** Its board and history live outside the repository in
  SQLite; it has no hard merge gate; a second model can auto-approve commands; skills are saved
  without review by default.

### Function map

State is what exists on `main` on 2026-10-19, after S01-S17 and S19-S27 landed. Decisions refer to the numbered interview answers in
the idea.

| Function | Hermes | Zeemrepo state | Evidence | Factory requirement (decision) |
|---|---|---|---|---|
| Work records | Cards in SQLite | **Exists.** Typed notes, 11 statuses, `depends_on`, job specs, evidence labels | `scripts/wiki/work-tracking.ts` | Wiki notes are the only store (11) |
| Board view | Dashboard plugin | **Missing.** No board command | no `scripts/work/` | Read-only board over `main` and `factory/*` branches (5, 10) |
| Eligibility | Parents done | **Partial.** Lint refuses a started ticket with open parents; nothing lists startable ones | `work-tracking.ts` | ready + `owner: agent` + parents done + plan approved + no open checkpoint (4) |
| Picking | Dispatcher | **Partial.** A model plans from GitHub issues | `.sandcastle/plan-prompt.md` | Deterministic script; model only implements (4) |
| Claims | Database row | **Missing** | none | Pushed `factory/<slug>` branch is the claim (5) |
| Worker runtime | Process per task | **Exists.** Coordinator and agents in one disposable container, exporting a candidate artifact; public commands switch over in S18 (proposed) | `coordinator.ts` (S08), `isolated-run.ts` (S14) | Sandcastle with a wiki tracker instead of issues (5, 11) |
| Worker report | `kanban_*` tools | **Missing.** Reports are issue comments | `implement-prompt.md`, `notifications.ts` | complete, block, request-review commands writing to the ticket note (5) |
| Review | Separate reviewer | **Exists.** Reviewer pass, no-edit agents, and a trusted verifier driver that writes host-only receipts | `.claude/agents/verifier.md`, `verifier-driver.ts`, `verification-receipt.ts` (S15) | Keep; independent context (ADR-0022) |
| Landing | None built in | **Exists.** `npm run pr`, owner merges | `scripts/git/pr-ready.ts`, ADR-0025 | Agents stop at an open PR |
| Failures | Retry, then block | **Partial.** Durable per-issue state resumes missing phases; failed verification holds the issue; no retry limit or stale re-queue | `already-done.ts`, `run-state.ts`, `recovery.ts` (S17) | 2 retries, then blocked + email + lesson; 6 h stale re-queue (9) |
| Planning | Not built in | **Partial.** Skills exist, run by hand | `grill-plan`, `write-plan`, `plan-tickets` | Planner agent opens plan PRs; merge approves (2) |
| Completion | Card done | **Partial.** `done` needs evidence; no outcome check | `work-tracking.ts` | Verifier checks the idea's outcome; gaps loop back (12) |
| Schedule | Cron | **Missing** | none | Dispatcher loop on the owner's machine (6) |
| Containment | Docker and other backends | **Partial.** Reproducible image and a real containment control (S12, done); no Docker on this machine | `containment-smoke.ts`, `container-runtime.ts` | Install Docker; keep agents off personal files and logins (6) |
| Budget | Not found | **Missing** | none | Subscription login; 3 workers, iteration and daily caps; usage ledger (7) |
| Notifications | Chat gateway | **Partial.** Issue comments, deduplicated by a hidden marker; no email | `notifications.ts` (S17) | Gmail email with redaction (8) |
| Learned skills | `skill_manage`, write approval | **Missing.** Skills change only by PR | `owner-authority.md` | Versioned overlay used at once; promotion PRs (3) |
| Lessons | Memory files | **Exists**, by hand | `wiki/lessons/` | Failures draft lesson candidates (9) |
| Run history | SQLite sessions | **Partial.** Per-issue JSON run state in a host-only directory; nothing shows it | `run-state.ts` (S17) | Per-run record in the ledger, shown on the board (7, 10) |
| Front end | TUI, web, chat | **Missing** | none | Read-only board and run history first (10) |
| Multiple repos | Any directory | **Missing** | none | Later; Zeemrepo is the control plane (1) |

### Build inventory

Each part reuses what exists. Part names are working names for the plan.

| # | Part | Kind | Reuses | Notes |
|---|---|---|---|---|
| 1 | Board reader (`npm run board`) | script | `work-tracking.ts` parsing | Slice 0 of the kanban research, plus `factory/*` branches |
| 2 | Picker | script | board reader | Deterministic; evals E1-E6 and R1 of the kanban research |
| 3 | Dispatcher loop | script | `coordinator.ts`, `isolated-run.ts`, `recovery.ts`, `branch-guard.ts`, `already-done.ts`, `afk.ts` | Claims, caps, retries, stale re-queue |
| 4 | Wiki tracker for Sandcastle | adapter | `@ai-hero/sandcastle` custom tracker | Replaces `gh issue` reads, numeric ids, `sandcastle/issue-<n>`, and the issue keys in run state, recovery and notifications |
| 5 | Worker report commands | script | wiki schema and evidence labels | complete, block, request-review |
| 6 | Planner run | skill chain | `grill-plan`, `write-plan`, `plan-tickets` | Opens plan PRs from new ideas |
| 7 | Outcome verifier | agent | `verifier.md`, `verify-work` | Final check; gaps become tickets |
| 8 | Usage ledger and run history | script and wiki note type | `run-state.ts`, evidence labels | Needs a schema change for a run record |
| 9 | Email notifier | connector | `notifications.ts` delivery and marker pattern | Gmail send with redaction; credential kept out of sandboxes |
| 10 | Learned-skill overlay | store and script | `skills:lint`, `write-skill` | Separate versioned store; promotion PRs |
| 11 | Local runtime | environment | `sandbox:smoke` | Docker install; dispatcher service |
| 12 | Board front end | UI | board JSON | Read-only; Obsidian Bases view possible meanwhile |

### Governance changes needed (each by owner-merged PR)

- An ADR and an `owner-authority.md` amendment allowing the learned-skill overlay (decision 3).
- What replaces decision 11's plan amendment. INFERRED: S10 and S14 landed before it was written up (done on 2026-10-19), so there is nothing left to re-scope; the issue keys now run through S08-S17 and S27 instead.
- A decision authorising email as an outbound destination, with its redaction rule (decision 8).
- Schema additions for `owner: agent` eligibility and run records, if the plan keeps them as fields.

### Unknowns

- UNKNOWN: whether `@ai-hero/sandcastle` 0.12.0's custom tracker can carry non-numeric ids without
  changes to the library; the kanban research found the option but did not build one.
- UNKNOWN: how the Claude subscription's usage limits surface to a running worker, which the stop rule
  depends on.
- UNKNOWN: which Gmail sending mechanism suits a headless dispatcher (API with OAuth, or SMTP with an
  app password); none is connected here.
- UNKNOWN: Hermes goal-mode cards and its skill curator were listed in its docs but not read.

## Implications

- The first slice is unchanged from the kanban research: a read-only board and picker with offline
  evals. It needs no Docker, no model and no new connector, and it helps the remaining remediation.
- The dispatcher waits on Docker locally (part 11) and on S18, which switches the public commands to the isolated path.
- The four governance changes are owner decisions; none is assumed here.
- Next: the owner reviews this note and the idea; a planner then writes the factory plan with
  `job_specs: required` and dependency-linked slices in this inventory's order.
