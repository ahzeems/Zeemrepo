# Zimi audit

This audit covers Zimi (`ahzeems/Zimi`, `main` @ `9fb36b2`, 614 commits), read-only, on 2026-10-09. It decides what moves into Zeemrepo and in what form.

**Method.**
- Three read-only explorations: governance and rules, eval and compliance scripts, and wiki and packages.
- The read-only checks were run: lint, typecheck, `wiki:lint` (214 notes), `skills:lint` (34 skills), `eval:lint` (32 cases), `governance:check` (275 surfaces), the four change guards, and 279 I/O-free tests. All of them passed.
- The full `npm test` (about 700 tests) was not run, because it writes `dist/` and temporary repositories.
- Each finding was then reviewed against the matching ECC surface: the common rules, `rules-distill`, `skill-stocktake`, `skill-comply` and `continuous-learning-v2`.

**Scope decisions (owner, 2026-10-09).**
- The source is `main`. The active branch `docs/foundations-rewrite` (`.worktrees/foundations-review`, 66 commits ahead, one uncommitted file) is used for ideas only, and Zimi itself is never modified.
- All governance and wiki validators are ported and refactored.
- Evals are limited to skill and rule compliance through ECC `skill-comply`.
- The wiki brings its system plus durable knowledge only.

## 1. Inventory

| Area | Size | Disposition |
|---|---|---|
| `AGENTS.md` / `INTENT.md` / `README.md` | 32 KB / 11 KB / 14 KB | Distilled into `CLAUDE.md` + `.claude/rules/zeem/` |
| `scripts/` | 34 TS modules, 38 test files, 1 shell script | 23 modules ported (section 3), the rest left behind |
| `scripts/fixtures/eval-cases` | 32 JSON cases | Task and criteria text become `evals/compliance/seeds.md` |
| `.agents/skills` | 34 skills (some verbatim third-party imports) | Stocktake (section 4) |
| `wiki/` | about 270 pages, about 268k words | System + about 23 lessons + 8 ADRs + 5 reference/runbook pages |
| `packages/web-platform`, `packages/obsidian` | about 13k TS lines, never deployed | Left behind |
| `.opencode/`, `opencode.json`, `agents/openai.yaml` | multi-harness configuration | Dropped (Zeemrepo is Claude Code only) |
| Policy JSON | 5 files at the repo root | Moved to `config/`; `confinement-checks.json` dropped |

## 2. Rule catalog

**Enforcement key:**
- `check`: part of `npm run check`.
- `hook`: a git hook, which `--no-verify` can bypass.
- `gate`: `npm run gate`.
- `prose`: written down, but nothing checks it.

**Verdict key:**
- **keep:** ported as it is, with fixes where noted.
- **ECC:** ECC already covers it; marked "Already Covered" and not duplicated.
- **fix:** ported, with the defect corrected.
- **drop:** not ported.

### A. Git workflow and landing
| # | Rule (source) | Enforcement | Verdict | Target |
|---|---|---|---|---|
| 1 | Work on a fresh branch; never commit on main (AGENTS:13) | hook (branch-guard) | keep | `scripts/git/branch-guard.ts`, `rules/zeem/branch-and-merge.md` |
| 2 | One writer per checkout; separate worktrees for parallel sessions (AGENTS:26) | prose | keep | `rules/zeem/branch-and-merge.md` |
| 3 | Merge main into the branch; no rebase of published history, no force-push (AGENTS:27) | hook (pre-push) | keep | branch-guard |
| 4 | A remote branch may be deleted only once merged into `origin/main` (branch-guard:83) | hook | keep | branch-guard; written into the rule too, since Zimi only had it in code |
| 5 | Land only through `npm run gate`; agents merge and push main themselves (AGENTS:386, ADR-0008) | gate + pre-push | **replace (owner decision 2026-10-09):** nothing is ever pushed to main; every change lands by pull request, and only the owner merges on GitHub | GitHub ruleset + CI `check` + pre-push guard + `.claude/settings.json` deny rules; ADR-0008 rewritten |
| 6 | Gate needs a clean tree, a review note with 0 Blockers, and a passing check on the merge result (gate.ts:195) | gate | fix: becomes `npm run pr` (`pr-ready.ts`): same preconditions, then push the branch and open or update the PR; never merges. Review notes become a PR review from `/ecc:review-pr`. | `scripts/git/pr-ready.ts` |
| 7 | Every first-parent main commit carries evidence (`.evidence-policy.json`) | audit (manual) | fix: git notes don't travel with fetch; `audit.ts` now flags any main commit that isn't a merged PR | `scripts/git/audit.ts` |
| 8 | Run `worktree:guard` before removing a checkout (AGENTS:82) | prose | keep | `scripts/git/worktree-guard.ts` |
| 9 | Conventional commits; stage files explicitly | prose | ECC | `rules/ecc/common/git-workflow.md` |
| 10 | `codex/` branch prefix | prose | drop | none (Codex-only) |
| 11 | Inspect `hooksPath` before installing hooks | prose | keep | runbook "Verify a repository change" |

### B. Evidence, claims and review
| # | Rule | Enforcement | Verdict | Target |
|---|---|---|---|---|
| 12 | Label claims VERIFIED / INFERRED / RECOMMENDED / UNKNOWN / OWNER DECISION (AGENTS:43) | prose | fix: drop RECOMMENDED, which is not an evidence state; enforce only on work-record `Evidence` bullets (D9) | `rules/zeem/evidence.md`, `work-tracking.ts` |
| 13 | Owner statements set intent, not machine state; inspect before asking | prose | keep | `rules/zeem/evidence.md` |
| 14 | Review on pinned base/head SHAs; a changed head needs a new review | gate checks only that a note exists | keep | `.claude/agents/finder.md` + gate |
| 15 | A builder's own review is never independent (ADR-0022) | prose | keep | ADR-0022; reviewer subagents |
| 16 | `verify-work` runs read-only after each slice | prose | keep | `.claude/agents/verifier.md` |
| 17 | Every checker has a valid and a broken control | convention | fix: make it structural with a `scripts/fixtures/{valid,broken}/` pair per checker | fixtures |
| 18 | Agentic changes define eval cases first | `eval:lint` (structure only) | drop: replaced by `skill-comply` reports | `evals/compliance/` |
| 19 | The owner approves job specs before implementation | prose | ECC | `/ecc:plan` waits for confirmation |
| 20 | An agent never answers an owner-authorization prompt | prose | keep | `rules/zeem/evidence.md` |
| 21 | Ask before destructive, external, credential, infrastructure or spending actions | prose | ECC | Claude Code permissions + ECC `safety-guard` |

### C. Vault, changelog and wiki
| # | Rule | Enforcement | Verdict | Target |
|---|---|---|---|---|
| 22 | Every branch needs a changelog entry under **today's UTC** heading, plus an updated work record with evidence | check (memory-guard) | fix: any date from the merge-base onward (D3); changelog moves to the repo root (D2) | `scripts/changes/` |
| 23 | A workflow-critical change touches a decision, reference or runbook doc, or says `[no-doc-change: reason]` | check | fix: one shared policy list (D4) | `lib/change-policy.ts` |
| 24 | No post-merge facts in the changelog (ADR-0007) | hook + check | fix: stale "owner merges" wording at `changelog-validation.ts:7,24` | changelog-validation |
| 25 | Wiki files are committed alone with a `wiki:` subject | hook + check | fix: subject becomes `docs(wiki): …` (D5) | `scripts/wiki/wiki-compliance*.ts` |
| 26 | Load wiki-memory before any wiki write | prose | keep; measure with skill-comply | `.claude/skills/wiki-memory` |
| 27 | No secrets, emails, hostnames or user paths in tracked files | check (redaction sweep) | keep; sweep targets updated (`packages/` gone; `.claude/`, `config/` added) | wiki-validation |
| 28 | Session and decision bodies are append-only; supersede instead | prose | keep | `rules/zeem/wiki-memory.md` |
| 29 | Write a session note after meaningful work | prose | keep (optional) | wiki-memory skill |
| 30 | A requirement change names the affected skills | prose | drop: duplicates 23 and 31 | none |
| 31 | No declared surface may assert a replaced rule (governance alignment) | check (`*.md` only) | fix: scan code and config too (D12) | `scripts/governance/` |
| 32 | A workflow rule change updates AGENTS.md in the same branch | partial | fix: becomes "updates the single rule file", enforced by 23 | `rules/zeem/change-records.md` |

### D. Skills
| # | Rule | Enforcement | Verdict | Target |
|---|---|---|---|---|
| 33 | One skill library; no copies or projections | prose | keep: `.claude/skills/` only | |
| 34 | Third-party imports are byte-preserved and hashed in `import-baseline.json` | check | keep; re-baseline once after the stocktake | `scripts/skills/` |
| 35 | Description ≤160 characters, body ≤6000; names match directories; cited paths resolve; skill reachable from a route file | check | keep, except the route-file check: dropped in Phase 4, because Claude Code finds skills by their descriptions | `config/skill-standards.json` |
| 36 | User-only skills are confirmed in three places (frontmatter, `openai.yaml`, `opencode.json`) | check | fix: native `disable-model-invocation` + one `userOnly` list (D6) | skill-validation |
| 37 | A denied skill stops work; reading a file does not get around a denial | prose | keep | `rules/zeem/skills.md` |
| 38 | Read unslop before any prose | OpenCode injection only | keep; measure with skill-comply | unslop skill |
| 39 | TS strict, `noUncheckedIndexedAccess`, no casts or `any`, kebab-case files | check | keep + ECC TypeScript rules | `tsconfig.json`, `eslint.config.ts` |

### E. Packages
| # | Rule | Verdict |
|---|---|---|
| 40 | Root scripts reach a package only via `--workspace` | drop (no packages) |
| 41 | A package tooling change carries docs | drop |
| 42 | A new file extension updates lint, eslint, tsconfig and redaction | keep as prose in `rules/zeem/change-records.md` |

### F. Confinement and controlled launch
| # | Rule | Verdict |
|---|---|---|
| 43 | Launch only Claude Code versions recorded in `confinement-checks.json` | drop: the list already lags the installed 2.1.295; the eval runtime is out of scope |
| 44 | Refuse a tracked `.claude/settings*.json` or a symlinked `.claude` | drop: Zeemrepo tracks `.claude/settings.json` on purpose (it enables ECC) |
| 45 | Launch prerequisites (bwrap, socat) and launch settings | drop |
| 46 | Refuse ancestor instruction files that differ | drop |
| 47 | Never fall back to another client | drop |

### G. Agent behaviour
| # | Rule | Enforcement | Verdict | Target |
|---|---|---|---|---|
| 48 | Report path, worktree, branch, HEAD and clean state before acting; stop at the bare root | prose | fix: the bare-root premise is **stale** (`core.bare=false` at the audit; see the correction under Contradictions); keep only "identify the checkout" | `rules/zeem/branch-and-merge.md`, rewritten ADR-0021 |
| 49 | Don't work as root | prose | keep | `rules/zeem/branch-and-merge.md` |
| 50 | Subagents only when a skill prescribes them | prose | ECC | `rules/ecc/common/agents.md` |
| 51 | `skill-reader` profile limited to Read, Grep and Glob, mirroring the OpenCode twin | test | drop: the profile belonged to the eval runtime | none |

### Contradictions and drift found
1. **Bare-root premise.** "Root is bare storage" appears in AGENTS.md, INTENT.md, README.md and ADR-0021. At the audit `core.bare=false` and `main` is checked out at the root.
   *Correction (Phase 7 port review):* the premise was true when written. Zimi's root was bare (`core.bare=true`) on
   2026-10-06 and became an ordinary work tree by 2026-10-08 (Zimi ADR-0024, after 9fb36b2). The fault was a layout
   assumption written as a permanent rule, not a rule that was never true.
2. **`.githooks/` classification.** `changelog-validation.ts:5` exempts it, while `repo-memory-validation.ts:43` lists it as workflow-critical.
3. **Merge wording in code.** "Owner merges" wording survives in `changelog-validation.ts`, which contradicts ADR-0008. `governance:check` can't see it because it scans `.md` only.
4. **Pull-request wording.** The docs say "PR" (AGENTS:69,401), but the gate merges locally and no PR is ever opened.
5. **Primary harness.** "Codex desktop is primary", but only Claude Code has a launch adapter.
6. **User-only skills.** tdd, technical-writing and the principle-* skills are marked user-only, yet AGENTS.md tells agents to consult them.
7. **Pre-commit is heavy.** It runs the full `check`, so the first commit on a branch fails until the changelog and work record exist.
8. **Duplication.** The vault paragraph appears 3 times and the `wiki:` rule 5 times. `governance-alignment.json` carries about 35 exact-text allowances as the cost of that duplication.
9. **Unused config content.** `wiki-compliance.json` is read only for its existence; its `note` field does nothing.

## 3. Validator inventory and defects

**Ported** (target `scripts/<area>/`):

| Module(s) | Area | Defects fixed during the port |
|---|---|---|
| wiki-validation, work-tracking, wiki-lint | wiki | Shared `lib/frontmatter`; agents allowlist becomes claude-code + human; redaction targets updated |
| wiki-compliance{,-validation} | wiki | `docs(wiki)` subject; the unused `note` field |
| skill-validation, markdown-references, skill-lint | skills | OpenCode/Codex coupling at `skill-validation.ts:173,196` removed (D6) |
| governance-validation, governance-guard | governance | Scans `.md` only (`governance-guard.ts:20`); now covers code too (D12) |
| changelog-validation, changelog-guard | changes | Stale wording; `CHANGELOG` constant defined twice; `.githooks` exemption |
| repo-memory-validation, repo-memory-guard | changes | UTC-today rule; exemptions for `.opencode` and `.claude` |
| branch-guard, worktree-validation, worktree-guard | git | Copied `git()` helper |
| evidence, gate, audit | git | Copied `git()` helper; `gate` uses `git reset --hard` in restore (security review) |

**Code duplication fixed by `scripts/lib/`:**
- the `git()` helper, copied 8 times (audit:9, gate:15, branch-guard:6, changelog-guard:5, operating-model-guard:10, repo-memory-guard:10, wiki-compliance:8, worktree-guard:7);
- `isRecord`, about 10 copies;
- the git-free environment setup, copied between two fixtures.

**Not ported:**

| Module | Reason |
|---|---|
| agent-admission (1452 lines; test 1759) | Eval runtime; out of scope. Would also breach the 800-line ceiling. |
| controlled-launch-confinement, fixtures/controlled-launch | Eval runtime; needs a re-check on every Claude Code release |
| eval-contracts, eval-lint, eval-sandbox, sandbox-policy, eval-sandbox-smoke | Replaced by `skill-comply` |
| agent-profile-validation, skill-coverage | Tied to skill-reader and the Skill flow matrix |
| operating-model-*, deploy-docs-*, vault-docs-* | Tied to `packages/` and to specific docs |
| bootstrap-wsl.sh | Machine setup for WSL, Homebrew and OpenCode |
| `src/`, `dist/` | Placeholder |

## 4. Skills (initial verdicts; confirmed by `skill-stocktake` in Phase 4)

| Verdict | Skills |
|---|---|
| Keep | wiki-memory, verify-work, manage-branch, resolve-conflicts, grill-plan, unslop, technical-writing (import), domain-modeling (import), design-actions, diagnose-bug, teach, bro (both user-only) |
| Merge into ECC | tdd → `tdd-workflow`; coding-standards → `coding-standards` + rule deltas; fullstack-engineer → `feature-dev`; standards-reinforcement → `orch-refine-code`; branch-review → `code-review` + finder agent; write-skill → `skill-create`/`skill-scout`; learn-from-failure → `learn-eval` + instincts; write-plan, plan-tickets, wayfinder, find-deepenings → `plan`/`blueprint` (decided per skill); documentation-standards → technical-writing + `living-docs-governance` |
| Distill into rules | principle-laziness-protocol, principle-minimize-reader-load, principle-redesign-from-first-principles, architecture-principles → `rules/zeem/design-principles.md` |
| Drop | publish-to-site, research-trends (web platform); eval-driven-development, maintain-verification-skill (eval runtime); automate-me → ECC `learn`; diagram-wiki (unless still needed) |

## 5. Wiki dispositions

**Kept as the system:**
- `note-schema.md`, with its tag and agent marker blocks kept, since the linter parses them;
- the 14 templates;
- the wiki-memory skill;
- Home and the Memory index, rebuilt.

**Decisions:**
- **Kept:** ADR-0001, 0005, 0007, 0008, 0009, 0011, 0022.
- **Rewritten:** ADR-0021, as "Authority comes from an identified checkout", without the bare-root premise.
- **New:** ADR-0024 "Claude Code is the only harness". It supersedes Zimi 0002 and 0004.
- **Left behind:**

  | ADRs | Reason |
  |---|---|
  | 0012–0018, 0020 | Web platform and hosting |
  | 0003 | Homebrew |
  | 0019, 0023 | Eval runtime |
  | 0002, 0004, 0006, 0010 | Superseded or multi-harness |

**Lessons kept (23):**
- **Git and fixtures:**
  - Git hooks route child Git commands to the hooked repository
  - Git notes do not travel with fetch or pull
  - A refused commit leaves its staging behind
  - Bare worktree records are not checkouts
- **Validators:**
  - Prose rules do not enforce themselves
  - An advisory check cannot stop a commit
  - Documentation checkers need counterexamples
  - A rule built from the environment needs testing in that environment
  - Redaction checks must cover code, not only notes
  - Wiki validation needs parsed metadata
  - Wiki frontmatter must accept Windows line endings
  - Test commands must discover actual tests
  - A passing memory guard does not prove current content
- **Credentials and hosts:**
  - Agents cannot enter a sudo password
  - Passphrase-protected SSH keys block agent pushes
  - Fine-grained tokens cannot upload SSH keys
  - An account-scoped API permission needs an account resource
  - sshd takes the first value, so the lowest drop-in wins
  - Root shell hides user-installed tools
- **Docs and skills:**
  - Placeholder values get copied literally
  - Walkthroughs should not duplicate skill rules
  - Skill integration must preserve the method
  - Skill restoration needs source comparison

**Lessons left behind (9):** these are environment- or platform-specific (WSL distro, Obsidian Bases, SSH passphrase loss, and so on), or superseded (changelog reconciliation).

**Reference and runbooks kept:** "Idea to execution", "Maintain the repository wiki", "Verify a repository change", "Merge gate contract" (slimmed), "Skill standards" (slimmed).

**Left behind:**
- 49 sessions;
- the 949-line changelog history;
- `wiki/work/*`, mostly blocked S-series tickets;
- the deploy, WSL and eval runbooks.

## 6. Security notes
- **No secrets in tracked files.**
- **Tunnel token on disk.** `packages/web-platform/deploy/.env` holds a live `TUNNEL_TOKEN`. It is untracked, gitignored, mode 600 and never in history, and it is not migrated.
- **Hardcoded paths, all left behind:** `~/Github/Zimi`, `\\wsl.localhost`, `/home/linuxbrew`, `/tmp/claude-<uid>`, and the rootless Docker socket.
- **One destructive operation:** `gate.ts` restores with `git reset --hard` behind a clean-tree check. ECC `security-reviewer` covers it in Phase 6.

## 7. ECC tie-ins
| Need | ECC surface | Phase |
|---|---|---|
| Rule catalog becomes rule files, with no duplicates against ECC common rules | `rules-distill` | 7 |
| Skill keep, merge and drop decisions | `skill-stocktake`, `skill-scout` | 4 |
| Test-first ports and review | `tdd-guide`, `typescript-reviewer`, `code-reviewer`, `silent-failure-hunter`, `security-reviewer` | 2–6 |
| Doc roles (constitution, map, status, history) | `living-docs-governance` | 7 |
| Lessons become instincts, then evolved skills | `instinct-import` → `/ecc:evolve --generate` | 8 |
| "Are the rules actually followed?" | `skill-comply` + a wrapper that loads repo context (the stock runner uses an empty `/tmp` sandbox) | 9 |
| Final readiness | `harness-audit`, `security-scan`, `orch-review` | 10 |
