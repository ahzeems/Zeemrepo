# Rules distillation (Phase 7)

ECC `rules-distill`, run on 2026-10-09 over the 68 rules listed in `skill-stocktake.md` ("Rules to distill") and
the rule catalog in `zimi-audit.md` section 2. Each rule was compared with the vendored ECC rules in
`.claude/rules/ecc/common/`, and given a verdict:
- **Rule file**: the rule now lives in a `.claude/rules/zeem/` file.
- **ECC**: Already Covered by an ECC rule; not restated.
- **Skill**: Too Specific; it stays in the skill that owns it.
- **Dropped**: it was dropped by an owner decision.

`rules-distill` normally asks for approval of each candidate before writing. Here that approval is the owner
merging this pull request, the same as for every rule change in this repository.

Rule files: `branch-and-merge.md` (BM), `change-records.md` (CR), `evidence-and-review.md` (ER),
`owner-authority.md` (OA), `design-principles.md` (DP), `wiki-and-docs.md` (WD), `skills.md` (SK).
`CLAUDE.md` holds only the three non-negotiables and points to the rule files.

## Stocktake rules

| Source skill | Rule | Verdict |
|---|---|---|
| architecture-principles | Abstraction only after two real consumers | DP |
| | No feature flags or compat shims for changeable code | DP |
| | Definition of done: code, deps, docs, work record in one PR | CR |
| | Discovered work goes to a work record unless blocking | CR |
| | Every open item names a blocker; a decision is a work item | CR |
| | A completed item cites its PR | CR |
| automate-me | Codify a preference only after 2+ independent sessions | OA |
| branch-review | Builder never certifies its own work | ER |
| | Review pinned SHAs, not branch names | ER |
| | Reviews never approve or merge | BM, ER |
| coding-standards | Validate at real boundaries only | DP (narrows ECC `coding-style.md` Input Validation) |
| | Comments only for a non-obvious why | DP |
| | Proportional test effort | Dropped: ECC TDD is mandatory, no exceptions (owner) |
| | Prefer stdlib; justify each new dependency | CR |
| | Language naming conventions | DP; ECC `coding-style.md` Naming covers the principle |
| design-actions | Spending, infra, deletion, external sends need owner authorization | OA |
| | CLI verbs validate and refuse before side effects; exit codes | DP |
| diagnose-bug | Reproduce before fixing; repro becomes the regression test | ER |
| | Prevention names a real failing check, or `none: <reason>` | ER |
| diagram-wiki | No unobserved path drawn as a working edge | WD |
| documentation-standards | Define terms; give reasons and real examples | WD |
| | README is orientation only | WD |
| | Version-sensitive pages state capture date and re-check | WD |
| | Document only what was verified working | WD |
| | Agent-drafted standards start as draft | WD |
| domain-modeling | ADR only when hard to reverse, surprising, a real trade-off | WD |
| eval-driven-development | Trust a checker only after it fails a broken control | ER |
| | Report structural, selection and outcome results separately | ER |
| fullstack-engineer | Read the nearest similar module first | DP |
| | Plan in 3-6 lines or say the task is too big | DP |
| | Find callers before editing | DP |
| | Challenge duplicating or boundary-crossing briefs | DP |
| | Wiki commits separate, `docs(wiki):` | BM; enforced by `wiki:compliance` |
| | Builder never merges, closes its own item or writes its verdict | BM, ER, CR (an item is done only when the owner merges its PR) |
| grill-plan | Never infer an owner decision | OA |
| | Do not ask what a command can settle | OA |
| learn-from-failure | Prevention runs in an existing command and fails on the defect | ER |
| | Never repoint a prevention to look complete | ER |
| | Drive-by fixes limited to touched lines | CR |
| maintain-verification-skill | Docs drift vs regression; never paper over | ER |
| manage-branch | Never push to or merge into main | BM |
| | Merge main in; never rebase or force-push published history | BM |
| | Stage files explicitly | BM |
| | Never discard another session's work; delete only merged branches | BM |
| plan-tickets | Build tickets only from an owner-merged plan | OA; enforced by `wiki:lint` (`approval_ref`) |
| principle-laziness-protocol | Prefer deletion; smallest diff | DP |
| | Look for a direct path before threading a new signal | DP |
| | One source of truth for a repeated decision | DP |
| principle-minimize-reader-load | Collapse single-caller wrappers and pass-throughs | DP |
| | Shrink state scope; derive instead of sync | DP |
| | The 30-second reader test | DP |
| principle-redesign-from-first-principles | Integrate a requirement as if original | DP |
| publish-to-site | Outbound content needs authorization and redaction | OA |
| research-trends | External claims cite a primary source with a date | ER |
| resolve-conflicts | Merge, never rebase or force-push | BM |
| | Stage by name | BM |
| | Regenerate generated files | BM |
| standards-reinforcement | Cleanup adds no behavior | CR |
| | Plant the violation before fixing an unenforced standard | ER |
| | Report "ready for review", never "approved" | BM |
| verify-work | Verifier judges artifacts and its own runs | ER, `.claude/agents/verifier.md` |
| | Verifier never edits, commits or approves; discloses self-review | ER, `.claude/agents/verifier.md` |
| wayfinder | Agents never answer owner decisions | OA |
| write-plan | A plan holds only settled decisions | Skill (`write-plan`) |
| | A branch never approves its own plan | OA |
| write-skill | Retire what is replaced in the same PR | CR |
| | Never prescribe a check nothing runs | ER |
| | Agents draft skills; the owner approves by merge | SK |

Duplicates across skills (for example "merge, never rebase" in manage-branch and resolve-conflicts) map to one
line in one file.

## Audit catalog rules not covered above

| # | Rule | Verdict |
|---|---|---|
| 1-8 | Branch, worktree, landing and audit rules | BM, plus the guards ported in Phase 6 |
| 9 | Conventional commits | ECC `git-workflow.md`; BM adds scopes and `docs(wiki):` |
| 11 | Inspect `hooksPath` before installing hooks | BM |
| 12 | Evidence labels | ER; enforced by `wiki:lint` on work records |
| 13 | Owner statements set intent, not machine state | OA |
| 14-16 | Pinned review, independent reviewer, read-only verifier | ER; ADR-0022; `.claude/agents/` |
| 17 | Valid and broken controls | ER |
| 19, 21 | Plan confirmation; ask before destructive actions | ECC (`/ecc:plan`, Claude Code permissions); OA adds the authorization specifics |
| 20 | Never answer an owner-authorization prompt | OA |
| 22-25, 32, 42 | Change records, doc updates, wiki commits, new extensions | CR; enforced by the change guards |
| 26, 28 | Load wiki-memory; decisions and sessions are not edited after their day | WD |
| 29 | Write a session note after meaningful work | Skill (`wiki-memory`) |
| 27 | Redaction | Enforced by `wiki:lint`; OA covers outbound text |
| 31 | Governance alignment | CR; `governance:check` |
| 33-37 | Skill library, provenance, standards, user-only, denial | SK; enforced by `skills:lint` |
| 35 (route file) | Skills reachable from a route file | Dropped: Claude Code finds skills by description (`scripts/skills/skill-standards.ts`) |
| 38 | Read unslop before prose | WD |
| 39 | TypeScript strictness | `tsconfig.json`, `eslint.config.ts`; ECC TypeScript rules |
| 48, 49 | Identify the checkout; do not work as root | BM; ADR-0021 |
| 50 | Subagents | ECC `agents.md` |

## ECC overrides

Each override is written in the rule file it belongs to, under "Overrides of ECC":

| ECC source | Override | File |
|---|---|---|
| `development-workflow.md` steps 4-5, "Commit & Push" then checks | Ends at `npm run pr` (checks, then push); the owner merges | BM |
| `git-workflow` skill: `git rebase origin/main`, `--force-with-lease` | Not on pushed branches | BM |
| `git-workflow.md` commit format | Scopes allowed; wiki commits `docs(wiki):` | BM |
| `git-workflow.md` `includeCoAuthoredBy` note | Attribution trailers are kept | BM |
| `code-review.md` "Approve" | Means "ready for the owner"; no agent approves | BM |
| `testing.md` 80% coverage | 80% lines and functions, 70% branches | ER |
| `testing.md` E2E tests | CLI runs against real temporary repositories | ER |
| `coding-style.md` validation and error handling "at every level" | No defensive checks past the boundaries | DP |

Not an override: nesting depth stays at ECC's 4 (OWNER DECISION, 2026-10-09: "4, as ECC (Recommended)").
