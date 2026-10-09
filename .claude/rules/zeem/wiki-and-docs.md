# Wiki and docs

The wiki is this repository's shared memory (`wiki/decisions/ADR-0001 Wiki is an Obsidian vault in the
repository.md`). Its schema and workflow live in the `wiki-memory` skill; this file holds only the rules that
apply everywhere.

## Wiki

- Load the `wiki-memory` skill before reading for recall or writing anything under `wiki/`.
- Decision and session bodies are not edited after their day. To change a decision, write a new one and mark
  the old one `superseded` with `superseded_by`.
- Record an ADR only when the decision is hard to reverse, surprising without its context, and the result of
  a real trade-off.
- A diagram never shows a proposed, failed or unobserved path as a working edge. Every arrow traces to a cited
  source.
- Tags and allowed agents change in a commit of their own, before the note that uses them.

## Who holds what

| Role | Where |
|---|---|
| Constitution: the rules agents follow | `CLAUDE.md` and `.claude/rules/zeem/` |
| Map: where things are | `wiki/Home.md` and `wiki/reference/Memory index.md` |
| Status: what is in flight | `wiki/work/` |
| History: why and what changed | `wiki/decisions/` and `CHANGELOG.md` |

## Writing

- Load the `unslop` skill before writing prose someone else will read. Avoid em dashes (OWNER DECISION,
  2026-10-09).
- A page a newcomer lands on defines each term on first use and gives the reason behind a convention, with a
  real example (a PR number, an actual failure) rather than a hypothetical one.
- `README.md` is orientation only: what this is, the layout, a quick start and links. Depth lives in the wiki.
- A reference page or runbook about version-sensitive facts (tools, services, hardware) states the date they
  were captured and how to re-check them.
- Document only what was verified working. An alternative discussed during design is never written up as the
  live setup.
- A standards page an agent drafted without owner input starts with `> **Status:** draft`, removed only after
  the owner confirms it.
- Walkthroughs link to the skill or rule that owns a step instead of restating it.
- Example values cannot be mistaken for real ones: write `<your-name>`, not `Your Name`; readers run
  examples exactly as written.
