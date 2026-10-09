# Instincts and `/ecc:evolve` review (Phase 8)

Zimi's 24 ported lessons and 8 of its decisions, plus two Zeemrepo decisions (ADR-0024 and rule
precedence), became ECC continuous-learning-v2 instincts on 2026-10-09, and `/ecc:evolve --generate` proposed skills and
agents from them. This page records what was run and the decision on each generated item.

## What was run (ECC plugin 2.2.3)

| Step | Command | Result |
|---|---|---|
| Source | `docs/migration/instincts/zimi.instincts.yaml` | 34 instincts; each Evidence line names the note it came from and the check that prevents a repeat, or `none`/`partial` with the reason (16 have none, 2 are partial) |
| Dry run | `instinct-cli.py import <file> --scope project --dry-run` | 34 new, 0 updates, 0 duplicates |
| Import | same, with `--force` | 34 added to project `svrcode` (87743e0e4387) under `~/.local/share/ecc-homunculus/`, outside the repository |
| Analysis | `instinct-cli.py evolve` | 7 skill clusters, 6 agent candidates, 0 command candidates |
| Generate | `instinct-cli.py evolve --generate` | 13 files (7 skills, 6 agents) in the project's `evolved/` folder, outside the repository |

**How the clusters were steered.** `evolve` groups instincts whose triggers share at least two
keywords and half of the smaller keyword set. Each trigger starts with a fixed phrase per intended
group ("when a git hook or test fixture runs git", "when changing a repository check or
validator", and so on), and a read-only run of ECC's own parser and clustering functions confirmed
the seven groups before the import. No instinct uses the `workflow` domain, because evolve turns
those into slash commands and the commands they would describe already exist (`npm run pr`,
`npm run worktree:guard`).

**The committed YAML is the source of truth.** Imported copies live per machine and are keyed by
the git remote; re-import the file to rebuild them.

## Decisions on the generated items

ECC's generator writes each skill as its trigger keywords plus the instincts' first Action
paragraphs, and each agent as a list of instinct ids with read-only tools. Each item was judged on
whether it adds something the rule files, the existing skills and agents, or the wiki do not.

| Generated item | Decision | Reason |
|---|---|---|
| skill `changing-check-repository` (9 instincts) | **Proposed, rewritten** as `.claude/skills/write-guard/` | The only cluster that is a procedure: how to add a check that can fail. The generated text had a keyword description ("Use changing check repository validator") that would not route, and no order. The rewrite puts the tests first, links the rule files and design-actions instead of restating them, names every list a new guard must join, and links each lesson. |
| skill `fixture-git-hook-runs` (4) | **Merged** into `write-guard` step 2 | Only matters while writing tests; too small to route on its own. The rule is also enforced by `scripts/toolchain/fixture-env.test.ts` and `scripts/git/git-state.ts`. |
| skill `documentation-skill-text` (4) | **Rejected**; one line added to `.claude/rules/zeem/wiki-and-docs.md` | Three of four actions are already rules (walkthroughs link, imported skills keep their method, restorations compare the source). The new one, unambiguous placeholders, is now a rule line. |
| skill `agent-credentials-host-sets` (6) | **Rejected** | Host and credential setup is not work this repository does; the six lessons stay recallable through the wiki-memory skill. |
| skill `landing-owner-pull-request` (5) | **Rejected** | Duplicates `.claude/rules/zeem/branch-and-merge.md` and `evidence-and-review.md`, and ADR-0008 and ADR-0022. |
| skill `memory-recording-vault-wiki` (4) | **Rejected** | Duplicates `.claude/rules/zeem/wiki-and-docs.md` and the wiki-memory skill. |
| skill `agent-configuring-harness` (2) | **Rejected** | Duplicates `CLAUDE.md` and ADR-0024. |
| agents `changing-check`, `fixture-git-hook`, `documentation-skill`, `agent-credentials`, `landing-owner-pull`, `memory-recording` | **All rejected** | Each is a list of instinct ids with no instructions. Review is covered by `.claude/agents/finder.md`, `.claude/agents/verifier.md` and the ECC reviewer agents. |

## Overlap search for write-guard

`write-skill` asks for a search before a new skill. The descriptions of this repository's 18 skills
and ECC 2.2.3's skills were searched for checks, guards, validators, linters and gates. The nearest
are `design-actions` (designing an agent action or CLI verb, which write-guard links for its CLI
conventions and names in its description as the other route) and ECC `verification-loop` (running
checks, not writing them). None covers adding a repository check. This was a description search,
not a run of ECC `skill-scout`.

## Re-import after review

Review found that several Evidence lines named advice or a prose rule as a prevention. The file was
corrected, the earlier imported copy removed, and the corrected file imported again; `evolve`
produced the same 7 clusters and 13 items.

## Follow-up

Phase 9 measures whether agents follow `write-guard` and the rule files with ECC `skill-comply`.
The rejected clusters remain as imported instincts, so a later `/ecc:evolve` can revisit them if
new instincts join them.
