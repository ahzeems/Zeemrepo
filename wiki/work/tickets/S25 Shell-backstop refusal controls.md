---
type: ticket
title: S25 Shell-backstop refusal controls
summary: Refuse the audited conditional, heredoc-substitution and explicit push-repository forms while preserving legitimate shell data and documented heuristic limits.
tags: [area/shell, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-17
agent: opencode
status: proposed
owner: agent
priority: P3
next_action: Verify approval and S01 completion, then add refusing controls for each audited shell form before changing the parser.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S25, finding A22 and its S01 prerequisite."
  - "UNKNOWN: job-spec approval and implementation evidence are pending."
---

## Goal

Recognize the audited executable shell forms without confusing inert data with commands or overstating the hook's protection.

## Inputs

- Plan S25, audit A22 and `scripts/claude/block-pr-merge.ts` with its existing valid/refusing cases.
- Read the merge-gate contract's stated heuristic limitations and owner-only merge/approval rules.

## Approach

1. Add controls for conditional command positions, substitutions in unquoted heredocs and push repositories supplied by option.
2. Correct recognition while preserving quoted/inert data and bounded parsing behavior.
3. Drive the actual hook function/CLI with structured tool inputs; never execute the forbidden commands themselves.

## Acceptance criteria

- [ ] Each audited form is refused by the actual hook boundary after failing before the fix.
- [ ] Quoted heredoc data, ordinary commit messages and legitimate commands remain permitted.
- [ ] Explicit repo-option forms identify the destination ref correctly, including the equals form.
- [ ] Long inert inputs have bounded behavior; existing wrappers/continuations remain covered.
- [ ] Documentation continues to describe a heuristic backstop, not a sandbox or a bypass of GitHub approval rules.

## Out of scope

A general shell interpreter, new permissions, bypassing server rules and testing real merges or pushes.

## Allowed files

- `scripts/claude/block-pr-merge.ts`, `scripts/claude/block-pr-merge.test.ts`.
- `wiki/reference/Merge gate contract.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files; do not modify deny rules, CODEOWNERS, branch protections or remote state as part of the regression test.

## Human checkpoints

Verify approval and S01 completion. Seek an owner decision if a legitimate command must become newly prohibited beyond the audited forms.

## Secrets needed

None.

## Tests and evals

- `node --test scripts/claude/block-pr-merge.test.ts`; `npm run check`.
- Positive: inert quoted data and representative permitted commands.
- Broken: conditional `gh pr merge`, command substitution in an unquoted heredoc, and `git push --repo` forms targeting main. Pass these as input data to the hook, assert refusal code/reason, and do not execute them.

## Rollback and recovery

If a false positive blocks valid work, preserve its control and repair the narrow parser. Do not work around the hook with obfuscation or disable it; use a reviewed revert if required.

## Evidence

Record input categories, actual hook exits/diagnostics, valid controls and independent review with the remaining limits.

## Wiki and doc updates

Update the documented recognized forms and limits without claiming comprehensive shell analysis.
