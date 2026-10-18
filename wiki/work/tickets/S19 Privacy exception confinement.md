---
type: ticket
title: S19 Privacy exception confinement
summary: Keep the sandbox-home exception confined to genuine role-name paths for every runtime identity, including traversal cases.
tags: [area/wiki, area/compliance, area/planning]
created: 2026-10-16
updated: 2026-10-18
agent: opencode
status: done
owner: agent
priority: P2
next_action: None. It landed as PR 35.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: build
plan: "[[Repository audit remediation implementation plan]]"
depends_on: ["[[S01 Fixture Git containment]]"]
related: ["[[Repository audit findings 2026-10-16]]"]
evidence:
  - "VERIFIED: this job spec preserves approved slice S19, finding A15 and its S01 prerequisite."
  - "VERIFIED: job-spec approval is PR 17, MERGED by the code owner (gh pr view 17, 2026-10-18); parent S01 has status done on main and its PR 18 is MERGED by the code owner."
  - "VERIFIED: before any change, the base redaction checks returned no finding for a home path that climbs out of the role-name home with .. (direct, nested, after ./ and //), under the logins agent, node and a personal placeholder login, when the path names a home other than the login (2026-10-18 probe)."
  - "VERIFIED: at test commit d4e8e0c, node --test scripts/wiki/redaction.test.ts scripts/wiki/wiki-validation.test.ts against the base redaction.ts exited 1 with 106 passed and 3 failed: the escaping-path matrix (first failure under login agent, expected one home-path finding, got none), the case pairing a traversal with a token, and the validateWiki case under the role-name logins agent and node."
  - "VERIFIED: at fix commit edb9211 the same command exited 0 with 109 of 109 passing; npm run lint and npm run typecheck exit 0."
  - "VERIFIED: matrix, each case run under the logins agent, node and a personal placeholder: 15 escaping forms are flagged (direct, bare and trailing-slash climbs, nested, ./ and // before the climb, double- and single-quoted, a climb that re-enters the home, a PATH list entry, inside parentheses, after a prefix, as the second path on a line); 9 look-alike or other homes are flagged (longer, hyphen, dot, underscore, two other cases, trailing dot, two other names); 15 inside paths pass, including x/../y, a/b/../../c, x/.., ./x, a trailing ., //, an ellipsis segment, a quoted path and a later cd .. in its own word."
  - "VERIFIED: ten planted mutations of redaction.ts, each run against both test files: the old regex alone, flagging only climbs of two levels, counting an empty or a dot segment as a level, keeping quotes, judging only the final depth (normalisation), flagging every role-home path, checking only the first role-home occurrence and dropping the look-alike lookahead were all caught (3 to 9 failing tests each). Matching the role home case-insensitively survived; it is equivalent, because a differently cased home is already flagged by the name pattern."
  - "VERIFIED: the existing secret and identity checks stay in FIXED_CHECKS and redactionChecks unchanged; a test pairs a traversal with a GitHub token and gets both findings, and asserts the finding does not contain the path's name. A 15 000-occurrence role-home line scans in under 2 seconds."
  - "VERIFIED: npm run check before this record exited 1 only at memory:guard (no work record; writing-standards.md without an operating doc); every earlier step passed, npm test 915 of 915 with redaction.ts at 100% lines and functions."
  - "VERIFIED: with this record committed at f3992d9, npm run check exited 0: npm test 915 of 915, wiki:lint, skills:lint, governance, wiki:compliance, changelog:guard and memory:guard all pass."
  - "VERIFIED: gh pr checks 35 on 2026-10-18 reported check and guards passing on head 60643e0."
  - "VERIFIED: the coordinator's message of 2026-10-18 reports that an independent verifier rated PR 35 at 60643e0 PASS with one MEDIUM and several LOW findings. MEDIUM M1: the look-alike pattern ran on the raw line, so a quote or backslash after the role-name home ended the name. LOW: missing tests for the home segment check, a role home deeper in a path, and single-quoted or backslash-escaped dots; undocumented limits; a doubled slash after /home; the stale idea note."
  - "VERIFIED: probe before the round-one fix, under the logins agent, node and a personal placeholder: the four M1 forms (double quotes, single quotes or a backslash after the role-name home, and a backslash-separated climb) and a climb followed directly by & or && returned no finding."
  - "VERIFIED: at round-one test commit 0cdc130, node --test scripts/wiki/redaction.test.ts scripts/wiki/wiki-validation.test.ts exited 1 with 108 passed and 2 failed: the escaping matrix stopped at the climb followed by && and the new quote and backslash test stopped at the double-quoted look-alike, each expecting one home-path finding and getting none."
  - "VERIFIED: at round-one fix commit 89878b7 the same command exited 0 with 110 of 110; npm run lint, npm run typecheck and npm run wiki:lint exit 0 and the tracked files gain no new finding."
  - "VERIFIED: six round-one mutations, each run against both test files, were caught: the look-alike pattern on the raw line (the M1 fix reverted), single quotes not removed, backslashes not removed, the home segment check dropped, a role home accepted only at the start of a path, and & not ending a path."
  - "VERIFIED: with the round-one record committed at e56c0b8, npm run pr ran npm run check to exit 0 (npm test 916 of 916) and pushed it; gh pr checks 35 on 2026-10-18 reported check and guards passing on e56c0b8."
  - "VERIFIED: gh pr checks 35 on 2026-10-18 reported check and guards passing on 2c4bd96."
  - "VERIFIED: the coordinator's message of 2026-10-18 reports that an independent re-verification at 2c4bd96 rated PASS with four LOW findings: removing whitespace from the break set survived the tests although a climb ended by a space is then missed; the quote and backslash removal over-flags an apostrophe or backslash escape after the role home without saying so; the break list omitted the comma, < and >, and the limits named only one shell expansion; and the discovered work, which the coordinator will record in a separate records PR."
  - "VERIFIED: round-two tests at 66d7d82 (climbs ended by a space, by a comma and by a closing parenthesis, and an apostrophe, a backslash n and a backslash b after the role home pinned as flagged) pass against the unchanged redaction.ts, 111 of 111; they target behaviour the code already has, so their red runs are the planted mutations."
  - "VERIFIED: three break-set mutations of redaction.ts, each run against both test files, were caught (3 failing lines each): whitespace removed, the comma removed and the parentheses removed from PATH_BREAK."
  - "VERIFIED: on 2026-10-18 gh pr view 35 reported MERGED by the code owner's account as 62c682d, and git merge-tree --write-tree 62c682d^ b74327a gave 62c682d's own tree, so main received exactly the reviewed head b74327a."
  - "VERIFIED: on 2026-10-18 gh run list showed check and guards passing on b74327a."
  - "INFERRED: per the final report of an independent verifier (Claude Code subagent, Opus 5.5, separate context), relayed to the coordinator and not reproduced here, b74327a rated PASS. Its LOWs were this ticket's stale UNKNOWN about CI and its stale next_action, both corrected here."
---

## Goal

Allow genuine role-name sandbox paths without letting that exception hide a path outside the allowed home.

## Inputs

- Plan S19, audit A15, `scripts/wiki/redaction.ts` and its identity-injected tests.
- Read the existing allowed-path, look-alike, case and traversal cases before changing matching semantics.

## Approach

1. Add the escaping-path control under role-name identities, where the personal-login check cannot mask the gap.
2. Confine the exception using the actual path semantics while retaining valid sandbox paths.
3. Drive the result through the existing redaction/wiki validation path.

## Acceptance criteria

- [x] Escaping traversal fails the baseline control under both role-name runtime identities.
- [x] Genuine sandbox paths pass under role and personal identities; safe internal normalization has explicit coverage.
- [x] Escaping paths, look-alike home names and nonallowed homes are detected without depending on the current login.
- [x] Existing secret/identity checks remain active and diagnostics do not echo sensitive input.
- [x] Redaction tests, wiki validation and the full check pass.

## Out of scope

Changing the general privacy policy, collecting real identifiers or widening other path exceptions.

## Allowed files

- `scripts/wiki/redaction.ts`, `scripts/wiki/redaction.test.ts`, relevant wiki-validation tests/fixtures.
- `.claude/skills/wiki-memory/references/writing-standards.md`, this ticket and a new `changelog/` fragment.

## Forbidden files

All other files, real credential files and real personal home paths in published test data.

## Human checkpoints

Verify approval and parent landing. Obtain owner agreement before changing which homes or identity classes are exempt.

## Secrets needed

None; construct synthetic paths/identities in tests rather than copying this machine's identifiers.

## Tests and evals

- `node --test scripts/wiki/redaction.test.ts scripts/wiki/wiki-validation.test.ts`; `npm run wiki:lint`; `npm run check`.
- Positive: permitted role home, exact boundary and valid nested paths.
- Broken: direct and nested traversal escaping that boundary, longer/suffixed names and other-case/nonallowed homes. Run the matrix across role and personal identities and prove the relevant path check catches it.

## Rollback and recovery

Keep newly detected published data out of new evidence. If a false positive is found, add its valid control and repair the narrow matcher rather than broadly disabling privacy checks.

## Evidence

Record the identity/path matrix, red/green findings and command exits using redacted or generated values, plus independent verification.

## Wiki and doc updates

Describe the implemented exception precisely and correct any affected claim without rewriting historical changelog entries.

## Observations

- The exception is stricter than path normalisation: a path that climbs above the role-name home and back in is
  flagged, because it names the home it passed through. A bare climb to `/home` is flagged too. The tests and
  the redaction checklist in `.claude/skills/wiki-memory/references/writing-standards.md` describe this.
- Path breaks: whitespace, `,`, `:`, `;`, `&`, `|`, `<`, `>`, brackets, braces, parentheses and backticks. A `#`
  straight after `..` is part of a name for the shell, so it is not treated as a break.
- Fails closed: quotes and backslashes are removed before the scan, so an apostrophe or a backslash escape
  (`\n`, `\b`) right after the role home reads as a look-alike and is flagged.
- Out of reach: a shell that joins words split by whitespace (such as `cd` to the home, then a separate `cd ..`)
  is not followed, URL-encoded dots are not decoded, a path continued onto the next line with a trailing
  backslash is not joined, and no shell expansion next to the home is followed: a variable (`$x`), a command
  substitution (`$(echo ..)`) or a default such as `${HOME:-/home/agent}/../<user>`.
  The redaction checklist names the same limits.
- Discovered gap, present before this branch for every home: a doubled slash after `/home`, as in
  `/home//<user>` or the same form before the role-name home followed by a climb, is not flagged. Next action:
  a separate job spec that treats repeated slashes after `/home` as one, with refusing tests for both forms.
- The idea note "Wiki privacy scan allows the sandbox home path" records on 2026-10-14 that its tests covered
  a path that climbs out of the home; finding A15 shows that case used a personal login. That note is outside
  this job's allowed files. Discovered work, next action: correct that idea note's evidence in a separate
  records PR.
- [no-doc-change: the redaction checklist in writing-standards.md is the operating doc for this scan and is
  updated in this branch; no decision, reference or runbook states the home-path rule]
