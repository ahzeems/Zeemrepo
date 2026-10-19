---
type: ticket
title: S25 Shell-backstop refusal controls
summary: Refuse the audited conditional, heredoc-substitution and explicit push-repository forms while preserving legitimate shell data and documented heuristic limits.
tags: [area/shell, area/git, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: claude-code
status: done
owner: agent
priority: P3
next_action: None. It landed as PR 36. The discovered limits below continue as idea notes, the text-after-opener gap first.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S25, finding A22 and its S01 prerequisite."
  - "VERIFIED: gh pr view 17 on 2026-10-18 reported MERGED by the code owner; it added this job spec. The S01 ticket on origin/main has status done, and gh pr view 18 (S01) reported MERGED by the code owner."
  - "VERIFIED: before the fix, the hook's own isPrMerge and isPushingToMain returned false for if, elif, while and until conditions holding a merge, for $(...) and backticks in an unquoted heredoc body, and for git push --repo=origin main and its separate-value form."
  - "VERIFIED: git 2.53, run in a scratch repository on 2026-10-18 with a harmless branch name, read the first positional after --repo=<path> as the repository (it reported that the branch name does not appear to be a git repository), so git itself does not push such a positional as a refspec."
  - "INFERRED: from that probe, the hook cannot know whether an author who wrote --repo meant the first positional as a refspec, so it judges every positional as a destination when --repo is present. This refuses more than git would push: with --repo, a first positional whose destination resolves to main is now refused, whether it is main, refs/heads/main, HEAD:main, x:main, +main or :main. No workflow here passes such a word as the repository."
  - "VERIFIED: at red commit b8991f4, node --test scripts/claude/block-pr-merge.test.ts passed 7 tests and failed the 3 new ones, each with actual 0 and expected 2 from main() on the first audited form (the if condition, the unquoted heredoc substitution, git push --repo=origin main)."
  - "VERIFIED: at fix commit 95358e1 the same command passed all 10 tests, including the new permitted controls (quoted and escaped heredoc substitutions, commit messages, until gh pr checks, --repo pushes of feature branches, a remote named main without --repo)."
  - "VERIFIED: twelve planted mutations, each run alone against the test file, were all caught: dropping if, elif, while or until from the wrappers; not collecting heredoc substitutions; expanding quoted heredocs; ignoring the backslash escape; not collecting backticks; ignoring the --repo= form; always or never honouring --repo; and not consuming the --repo value."
  - "VERIFIED: every long input in the timing test, including 50,000 repeated if words, unterminated $( and backtick runs in a heredoc and 10,000 heredocs, took at most 156 ms for both functions on the authoring machine, against the test's 2,000 ms bound. That was a plain node run; the verifier reported that coverage-mode runs (npm test) are several times slower, and one npm run pr attempt failed the 100,000-newline input at 2,246 ms under load."
  - "VERIFIED: a probe on 2026-10-18 showed a nested $(...) in a heredoc is followed and a subshell inside one, $( (cmd) ), is not; the merge gate contract states that limit."
  - "VERIFIED: the coordinator relayed on 2026-10-18 that an independent verifier rated PR 36 at 4cc84ef PASS and reported two MEDIUM and four LOW findings: quadratic time on unterminated heredoc openers, made worse by this branch (it measured 0.98 s on base and 1.99 s on head at 1,000 openers); a fixed wall-clock bound that flakes under load; an even run of backslashes read as escaping a heredoc substitution; no permitted control for a single-quoted substitution on an opener line; four limits missing from the contract; and an overstated INFERRED line. Its harness and model were not relayed (UNKNOWN)."
  - "VERIFIED: at red commit 3a68f50 the new growth test failed on unterminated openers (212 ms at 1,000, 767 ms at 2,000 lines) and the heredoc test failed on \\\\$(gh pr merge 5); the other 8 tests passed."
  - "VERIFIED: at fix commit 2bfe278 all 10 tests passed in 4.7 s. Doubling each timed input about doubled its time; unterminated openers took 76 ms at 8,000 lines and 142 ms at 16,000."
  - "VERIFIED: of eight mutations planted one at a time at 2bfe278, seven were caught: a quadratic closer scan (by the growth test), the backslash-parity revert, reading the opener line as body, and four heredoc-handling reverts. The survivor lets an opener line close itself, which cannot happen because a delimiter line holds only a word."
  - "VERIFIED: probes at 2bfe278 confirmed the verifier's out-of-scope limits pass the hook (eval with an unquoted argument, also under if; coproc; an opener inside quotes; $(case ...) in a heredoc), plus a double-quoted \\\\$(cmd) outside a heredoc. The contract lists them and the Discovered work section records them."
  - "VERIFIED: the coordinator relayed on 2026-10-18 that an independent verifier re-reviewed PR 36 at 9a355c1 and rated it PASS with no regressions (it reported 121 hand probes and 400,000 fuzzed commands). It reported two MEDIUM findings: six scanner-invariant mutants survive the test file and permit a merge, and the growth test still fails under CPU load. It reported one LOW finding: a small-constant quadratic closer lookup (sorted.find) survives. It also reported four limits present on base: text after an opener on the same line, a backtick in double quotes, a delimiter cut short to word characters, and an opener in a comment or arithmetic shift."
  - "VERIFIED: at 191cccb, the test file at 9a355c1 let all six scanner-invariant mutants pass: < to <= in the binary search, lines before a heredoc dropped, the here-string guards removed from the opener, the skip past a closed body removed, an unclosed opener taken as data, and a closer without tab stripping. The new scanner test fails each one. The code already met these invariants, so this round changes tests only."
  - "VERIFIED: with the previous test file, the sorted.find mutant failed only narrowly on this machine (ratio 3.3 against a threshold of 3), consistent with the verifier seeing it survive. With the new growth test (four times the input, threshold 8) it fails at 362 ms against 4,686 ms (12.9 times). A full quadratic closer scan fails at 147 ms against 2,290 ms."
  - "VERIFIED: on 2026-10-18 the PR 36 body says the F7 ratio in the line above was measured under --experimental-test-coverage, as npm test and CI run it; the review line below covers a plain run. Recorded by Claude Code (Opus 5.5) in the records PR after S15, replacing a qualifier PR 43 had added to the line above without a source."
  - "VERIFIED: the new growth test passed 10 of 10 rounds with 8 busy loops on 8 cores (load average 29) and 10 of 10 with 16 busy loops (load average 39); the previous test passed 8 of 10 with 8 busy loops."
  - "VERIFIED: probes on 2026-10-18 confirmed that the four reported limits pass the hook at 9a355c1, each with a merge or a push to main as the command. A delimiter cut short makes the hook close at a later line than bash, for example <<END-OF closed at END. The contract and the Discovered work section list them; the text-after-opener gap is marked highest priority."
  - "INFERRED: the coordinator relayed an owner decision of 2026-10-18 that every discovered gap becomes follow-up work, as ideas, then plans, then tickets, and said it is turning these into idea notes. This agent did not see the owner's words directly."
  - "VERIFIED: on 2026-10-18 gh pr view 36 reported MERGED by the code owner's account as 5530475, and git merge-tree --write-tree 5530475^ 0f32592 gave 5530475's own tree, so main received exactly the reviewed head 0f32592."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, 0f32592 rated PASS. Its one LOW: the sorted.find mutant (F7) fails the growth test only under coverage, as npm test and CI run it; under plain node --test it passed 6 of 6 runs at ratios of 7.1 to 7.6, below the threshold of 8. The line on the growth test above now says so, and the gap is recorded as an idea note."
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

- [x] Each audited form is refused by the actual hook boundary after failing before the fix.
- [x] Quoted heredoc data, ordinary commit messages and legitimate commands remain permitted.
- [x] Explicit repo-option forms identify the destination ref correctly, including the equals form.
- [x] Long inert inputs have bounded behavior; existing wrappers/continuations remain covered.
- [x] Documentation continues to describe a heuristic backstop, not a sandbox or a bypass of GitHub approval rules.

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

## Discovered work

These forms pass the hook on base and on this branch, and are outside A22. The review rounds found
them, except the double-quoted backslash run, which probing for them found. They are listed as
limits in [[Merge gate contract]] and are not fixed here.

- **Highest priority:** text after a heredoc opener on the same line is never judged, because the
  hook drops it with the heredoc: `cat <<EOF; cmd`, `cat <<EOF && cmd`, `cat <<EOF | cmd` and
  `cat <<EOF > "$(cmd).md"` all pass with a merge or a push to main as `cmd`. These are ordinary
  forms, not obfuscation.
- A backtick substitution inside double quotes outside a heredoc (``echo "`cmd`"``).
- A delimiter the hook reads shorter than bash does, because it takes only word characters
  (`<<"E"OF`, `<<E\OF`, `<<END-OF`, `<<EOF.`): the hook closes the heredoc at a later line than
  bash and takes the commands between as data.
- An opener inside a comment (`# <<EOF`) or an arithmetic shift (`$((1<<EOF))`), which the hook
  reads as a heredoc, so the lines up to the delimiter are taken as data.
- `eval` with an unquoted argument (`eval cmd`), also as an `if` condition.
- `coproc cmd`.
- A heredoc opener written inside quotes (`echo "<<'EOF'"`), which makes the lines up to the next
  `EOF` be read as data.
- A `case` inside a heredoc substitution (`$(case x in x) cmd;; esac)`).
- An even run of backslashes before `$(` inside double quotes outside a heredoc (`"\\$(cmd)"`): the
  top-level substitution pattern still treats any preceding backslash as an escape.

Next action: take these forward from their idea notes on main, to plans and then tickets:
[[Merge hook ignores commands after a heredoc opener]] first, then
[[Merge hook shell-form gaps beyond the audit]]. None of them blocks S25.
