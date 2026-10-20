---
type: research
title: Smallest slice of a repository ticket board and its evals
summary: A first slice that only reads wiki/work into a board and an agent-ready lane, proved by offline code-graded evals, before Sandcastle or claims change.
tags: [area/agents, area/planning, area/evals]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: proposed
owner: human
priority: P2
next_action: The owner reviews this research and decides the eligibility rule and the slice-0 scope; a plan through write-plan follows only after that.
idea: "[[Repository tickets drive parallel agent work on a kanban board]]"
related: ["[[Run Sandcastle on GitHub issues]]"]
evidence:
  - "OWNER DECISION: on 2026-10-17 the owner commissioned this research: \"Think of a very small tear we can do. Evals which prove this workflow. Deep researcher this using ecc skills\"."
  - "VERIFIED: scripts/wiki/work-tracking.ts already refuses a dependency cycle, a depends_on that is not a ticket, and a ready or executing ticket whose dependencies are not done; npm run wiki:lint runs it (read 2026-10-17)."
  - "VERIFIED: the installed @ai-hero/sandcastle 0.12.0 README offers the issue trackers github-issues, beads and custom, and the custom choice scaffolds a tracker the user wires up (node_modules/@ai-hero/sandcastle/README.md lines 752 and 781, read 2026-10-17)."
  - "VERIFIED: Obsidian's Bases views page lists a Kanban layout from version 1.14 whose columns come from a grouped property (https://obsidian.md/help/bases/views), and its Kanban page says dragging a card to another column updates the grouped property in that note, and that cards cannot be moved when the board is grouped by a formula (https://obsidian.md/help/bases/views/kanban); both read 2026-10-17."
---

## Question

What is the smallest slice towards a kanban board of parallel initiatives built from the
repository's own tickets, and which evals would prove it works, offline and without model
calls?

## Sources

Read on 2026-10-17. The method followed ECC's `deep-research` skill. Its Firecrawl and Exa
tools are not configured here, so Claude Code's web search and fetch stood in for them. A
research subagent (Claude Code, Opus 5.5, separate context) read the external sources. The
session spot-checked the Sandcastle and Obsidian claims, which the evidence lines record.

- **Backlog.md:** https://github.com/MrLesk/Backlog.md and its `ADVANCED-CONFIG.md`.
  - One Markdown file per task with YAML frontmatter (`status`, `assignee`, `dependencies`).
  - Board columns come from configured statuses.
  - A `checkActiveBranches` setting reads task state across branches.
  - MIT; v1.54.0 released 2026-10-16.
- **Task Master AI:** https://github.com/eyaltoledano/claude-task-master and
  `docs/task-structure.md`. Tasks live in a JSON file with `status`, `dependencies` and
  `priority`, and a `next` command ranks ready tasks. Licence: MIT with Commons Clause.
- **beads:** https://github.com/steveyegge/beads. A Dolt database with `bd ready`, and an atomic
  `bd update --claim`. Not file-based: its JSONL export is "not the source of truth".
- **git-bug:** https://github.com/git-bug/git-bug. Bugs stored as git objects; no agent features.
- **Sandcastle:** `node_modules/@ai-hero/sandcastle` 0.12.0 (latest on npm, published
  2026-06-29).
  - The work list enters the planner prompt through a `` !`command` `` expansion.
  - The planner is a model call whose output must match `{issues:[{id,title,branch}]}`.
  - Implementers run in parallel.
- **Obsidian Bases:** https://obsidian.md/help/bases/syntax, https://obsidian.md/help/bases/views and
  https://obsidian.md/help/bases/views/kanban.
  - A `.base` file is YAML; a view can `groupBy` a property.
  - The Kanban layout arrived in 1.14 and was public on 2026-10-05
    (https://obsidian.md/changelog/).
- **Evals:** Anthropic, "Demystifying evals for AI agents", 2026-01-09,
  https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents.
  - Prefer code-based graders on the final state, not the transcript.
  - Start each trial from a clean environment.
  - pass^k is the probability that all k trials succeed; it comes from τ-bench,
    arXiv:2406.12045.
- **Repository:** `scripts/wiki/work-tracking.ts`, the note schema in
  `.claude/skills/wiki-memory/references/note-schema.md`, and `.sandcastle/` (read in this session).

Agent-directed text was found in the Backlog.md and beads READMEs (setup commands for agents)
and in Sandcastle's prompt templates. It was treated as content and not followed.

## Findings

- **Prior art: frontmatter tickets, a board built from them, and a deterministic "next" or
  "ready" query.** Backlog.md is closest to this repository's model. None of the file-based tools
  documents a safe claim when state changes only through merged pull requests. Beads gets an
  atomic claim from a database, which this repository does not have. Confidence: high on the
  formats, low on claim behaviour.
- **Most of the board's logic already exists here.** The work-note schema already has board
  columns: the workflow states, including ready, in-progress, in-review and done. Projects
  already group tickets into initiatives. `npm run wiki:lint` already guarantees that a `ready`
  ticket has every dependency done, and that the dependency graph has no cycle. What is missing
  is a view, and a rule for which ready tickets an agent may take. INFERRED from
  `work-tracking.ts`.
- **Sandcastle needs no fork to change its work source.** Its work list is a shell command in
  the prompt, and the run loop is ordinary user code. A deterministic command that prints the
  agent-ready lane could therefore replace both `gh issue list` and the model planner. INFERRED
  from the installed README and template.
- **Moving a card in Obsidian's Kanban view edits the ticket.** The Bases Kanban view can render
  the board from the same frontmatter with no code. Dragging a card to another column rewrites the
  grouped property in that note on disk; grouping by a formula instead makes cards immovable. A
  drag is therefore a local edit of `status` that, like any edit, lands only through a pull request
  and must pass `wiki:lint` (which already refuses a `ready` ticket with unfinished dependencies).
- **Claims are the hard part, so they wait.** One candidate claim is pushing the ticket's
  deterministic branch. INFERRED: git refuses an unforced push that does not fast-forward the
  remote branch, so two agents that start the same ticket from the same base and commit
  different work cannot both push; but a push that fast-forwards is accepted, so this is not a
  lock. No primary source documents this pattern. It belongs after the read-only slice, together with the
  audit remediation tickets S10 and S14, which own Sandcastle's planner and coordinator.

## Implications

**Slice 0, read-only board.** It touches no Sandcastle, Docker, GitHub or model.

- `npm run board` (`scripts/work/board.ts` with a sibling test) reads `wiki/work/` through the
  same record loading `wiki:lint` uses.
- It prints each project's tickets grouped by status, then one **agent-ready lane**.
- `--json` emits that lane as `{id, title, branch}` items, with the branch derived from the
  ticket's file name.
- Recommendation for the eligibility rule: a note of type `ticket` with status `ready`,
  `owner: agent`, and no human checkpoint left open. The owner sets `ready` by merging a pull
  request. A checkpoint that needs authorization during the work (S12's infrastructure
  authorization, for example) is not cleared by that merge, because approval does not carry
  over from one action to the next (`owner-authority.md`); how a ticket records that its
  checkpoints are clear is an open decision. The rule is the owner's to choose.
- An optional `wiki/Board.base` file gives the Obsidian Kanban view. The owner chooses between a
  read-only board (grouped by a formula over `status`, so cards cannot be dragged) and a
  draggable board (grouped by `status`, where a drag edits the note and lands by pull request).

**Evals for slice 0.** E1 to E6 are code-graded `node:test` cases in `npm test`, each over a
fresh temporary fixture wiki per trial, with no network or model. The board takes its list of
records as an input, so a test can supply them in any order.

| Eval | Kind | Valid case | Broken control |
|---|---|---|---|
| E1 Parallel initiatives | capability | Two projects each with one eligible ticket: both appear in the lane | A lane that keeps only the first project fails |
| E2 Dependencies | capability | A ticket whose parent is done is eligible | A `ready` ticket with an unfinished parent: `wiki:lint` refuses it, and the board excludes it even unlinted |
| E3 Eligibility | capability | A `ready` ticket with `owner: agent` and no open checkpoint is listed | Looping over every other workflow state, `owner: human`, a `ready` plan or spec, and a `ready` ticket with an open checkpoint: none appears in the lane |
| E4 Board columns | capability | Every ticket appears once, under its own status and project | A ticket missing or duplicated fails |
| E5 Branch names | capability | Each branch passes `git check-ref-format` and is the same on every run | Two tickets mapped to one branch fail |
| E6 Determinism (pass^k) | reliability | k = 5 runs, each given the records in a different seeded permutation, give byte-identical output, so pass^5 must be 1 | An implementation that keeps input order fails, because the permutations are injected rather than left to directory order |
| R1 Real repository | regression | An invariant test over the real `wiki/work/`: every ticket appears exactly once, and every lane item is a `ready` agent ticket | A planted duplicate or ineligible lane item fails it; current counts are not pinned, so closing a ticket never breaks `npm test` |

Each eval is shown failing before the code exists, as the repository's test-first rule
requires. The planted broken controls above are the mutation checks. `npm run check` passing is
the landing gate, not an eval. A one-off board run at the implementation commit (the audit
remediation project with S01 to S05 and S07 done, and an empty lane on 2026-10-17) belongs in the
work record's evidence, not in a test.

**Later slices, each its own owner decision.**
1. The lane's `--json` replaces `gh issue list` and the model planner in Sandcastle. This is
   evaluated with a fake agent provider (Sandcastle exports `AgentProvider`) inside fixture
   repositories, and reconciled with S10 and S14 first.
2. A claim mechanism for parallel agents, with its own stale-claim rule.
3. Retiring GitHub issues as a work source, which also removes the sandbox `GH_TOKEN`.
