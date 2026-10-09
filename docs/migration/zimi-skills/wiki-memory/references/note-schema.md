# Note schema

Every note in `wiki/`, except `Home.md` and files in `templates/`, begins with this frontmatter. `npm run wiki:lint` enforces it.

```yaml
---
type: lesson
title: Root shell hides user-installed tools
summary: One sentence an agent can match on without opening the note.
tags: [area/wsl, tool/homebrew, kind/pitfall]
created: 2026-09-19
updated: 2026-09-19
agent: claude-code
status: active
related: ["[[2026-09-19 WSL bootstrap and Zimi creation]]"]
---
```

## Fields

| Field | Required | Rule |
|---|---|---|
| `type` | yes | A memory or work type from the tables below. Must match the folder. |
| `title` | yes | Must equal the file name without `.md`. Session titles start with the date. Decision titles start with `ADR-NNNN`. |
| `summary` | yes | One sentence, under 200 characters. This is what retrieval matches on, so make it specific. |
| `tags` | yes | YAML list (inline or block), at least one tag, all from the allowed list below. |
| `created` | yes | `YYYY-MM-DD`. Never changes. |
| `updated` | yes | `YYYY-MM-DD`. Change on every edit. |
| `agent` | yes | The original author. Never changes when someone else updates the note, since git history records editors. Must be one of the allowed agents listed below; the linter reads that list. |
| `status` | yes | Memory: `active`, `draft`, or `superseded`. Work: see the workflow states below. |
| `related` | no | YAML list of quoted wikilinks (inline or block). Every link must resolve to a note. |
| `superseded_by` | when superseded | One quoted wikilink to the replacement. |
| `job_specs` | plans only, optional | `required`. Every build ticket of the plan must then carry the job-spec sections listed in the ticket row below. `wiki:lint` refuses the field on any other note, and any other value. |

YAML caution: a `title` or `summary` that contains a colon followed by a space, or a space followed by `#`, must be wrapped in double quotes. Rewording is usually simpler.

## Note types

| Type | Folder | Answers | Mutability | Required body sections |
|---|---|---|---|---|
| `session` | `sessions/` | What happened in one working session? | Append-only | Goal, What was done, Outcome, Open items |
| `runbook` | `runbooks/` | How do I do X? | Updated in place | When to use, Prerequisites, Steps, Verify |
| `lesson` | `lessons/` | What trap exists and how do I avoid it? | Updated in place | What happened, Fix, How to apply |
| `decision` | `decisions/` | Why is it this way? | Append-only, supersede to change | Context, Decision, Consequences |
| `reference` | `reference/` | What are the facts? | Updated in place | free form, prefer tables |

The types follow the Diataxis split: runbooks are how-to guides, reference notes are reference, sessions and decisions are explanation. Decisions follow the ADR format.

## Work notes

Work records live inside the vault so Properties, Bases, internal links, and graph view
read the same files as agents. The original five memory types remain unchanged. Home routes to Memory index, which
indexes memory; [[Project hub]] and the native Work tracking.base views index work records
automatically. A work note does not need a duplicate entry in the memory index.

| Type | Folder | Required sections |
|---|---|---|
| idea | work/ideas/ | Problem, Desired outcome, Next step |
| project | work/projects/ | Outcome, Scope, Acceptance criteria, Work links |
| map | work/maps/ | Destination, Notes, Open decisions, Decisions so far, Not yet specified, Out of scope |
| plan | work/plans/ | Problem, Destination, Constraints, Decisions, Test seams, Implementation slices, Acceptance criteria, Out of scope |
| ticket | work/tickets/ | Build: Goal, Approach, Acceptance criteria, Out of scope. For a plan with `job_specs: required`, also Inputs, Allowed files, Forbidden files, Human checkpoints, Secrets needed, Tests and evals, Rollback and recovery, Evidence, Wiki and doc updates. Other kinds: Question, Evidence, Options, Recommendation, Resolution. |
| spec | work/specs/ | Behavior, Constraints, Acceptance criteria |
| research | work/research/ | Question, Sources, Findings, Implications |
| issue | work/issues/ | Reproduction, Expected and actual, Root cause, Fix, Verification, Prevention |

In addition to the common fields, every work note has owner, priority (P0-P3), and a
next_action while open. Use a role or agent name as owner, never an email address.
Every work note except an idea links to exactly one originating idea with an idea field.
A project also links to its idea. An idea may link to its delivery project; that project
must link back to the same idea. Project notes do not need self-links. Other work notes may have a project link when the idea
has become a project. Parent artifacts must belong to the same idea and project. Dependencies may cross projects within the same idea.

Relationships use quoted internal links to unique full note titles, without aliases or
headings, for example `idea: "[[Shared wiki idea]]"`. Use `related` for contextual links;
use named fields for their specific meanings. Memory notes may also have idea and project
fields to connect outcomes and lessons to the work. In prose, aliases and heading links
are allowed when useful. Keep links sparse: ownership and actual dependencies in properties, a few structural routes in prose. Do not repeat property links in prose or connect general guidance to every project.

| Field | Applies when | Rule |
|---|---|---|
| idea | Every non-idea work note; optional on memory | Exact link to an idea note. |
| project | Ideas or other work with a project; optional on memory | Exact link to a project with the same originating idea. Match the map or plan's project on its children. |
| map | Non-build ticket; optional on plan | Exact link to its owning map. |
| plan | Build ticket | Exact link to an owner-approved plan. |
| ticket_kind | Every ticket | build, decision, research, prototype, or prerequisite. |
| depends_on | Ticket dependencies | List of ticket links. No self-reference or cycle; never use its owning map or plan as a dependency. |
| blocker | status blocked | Concrete reason and who or what can unblock it. |
| approval_ref | Approved or executing plan/spec | Reference to actual owner approval; for plans, the approved merge. A field alone never establishes authority. |
| evidence | Work marked done | Nonempty list of inspectable results, merge references, or owner acceptance. |

Workflow states are backlog, clarifying, proposed, approved, ready, in-progress, blocked,
in-review, done, parked, and superseded. These are available states, not a mandatory
sequence for every note. Start an idea in backlog, a map in clarifying, and a plan or spec
in proposed. Approve plans only after checking the owner's approved merge. Build tickets
are created only from such a plan. Ready or executing tickets require completed dependencies.
A blocked item names its blocker; done needs evidence. Use superseded_by for superseded
records. The backlog is the view of records with status backlog, not another document.

Update the owning record, status, next_action, updated date, relationships, and evidence
when a skill session changes them. Keep the decision or deliverable in one canonical note;
map and plan sections link to ticket notes rather than copying their bodies. Session notes
record the conversation and link to the work. Templates are examples, not proof of approval.

## Issue records

An issue reports an observed failure; it is not a build ticket or implementation approval.
Use issue_kind bug, environment, or documentation. Capture reports without a plan and
keep unknown causes explicit. Before done, record nonempty root_cause, fix_ref,
regression_evidence, prevention, and the usual evidence list. Fix references may identify
a commit, pull request, or a verified environment resolution. Name an existing prevention
check, or state none with a reason and the actual manual control. Link substantial build
work through an approved plan/ticket. The Issues view reads these canonical records.

## Allowed agents

The original author of a note. To add one, add it to this list in a commit of its own, before the note
that uses it, exactly as with tags. Keeping the set closed is what stops a second spelling of
the same author, such as `claude` beside `claude-code`, from accumulating unnoticed.

<!-- agents:start -->
- `claude-code`
- `codex`
- `opencode`
- `human`
<!-- agents:end -->

## Allowed tags

Tags are namespaced. To add one, add it to this list in a commit of its own, before the note that uses it; `npm run wiki:compliance` refuses a commit that mixes `wiki/` with this file. The linter reads this list.

<!-- tags:start -->
- `area/wsl`
- `area/shell`
- `area/git`
- `area/github`
- `area/auth`
- `area/docs`
- `area/agents`
- `area/typescript`
- `area/planning`
- `tool/homebrew`
- `tool/gh`
- `tool/ssh`
- `tool/node`
- `tool/obsidian`
- `tool/claude-code`
- `tool/codex`
- `tool/opencode`
- `kind/pitfall`
- `kind/setup`
- `kind/convention`
- `kind/architecture`
- `kind/overview`
<!-- tags:end -->
