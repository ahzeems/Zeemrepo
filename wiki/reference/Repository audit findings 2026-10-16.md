---
type: reference
title: Repository audit findings 2026-10-16
summary: Baseline audit findings, source locations and evidence limits for planning remediation without relying on the original conversation.
tags: [area/compliance, area/agents, area/evals, area/git]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: active
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
---

## Baseline and use

The audit inspected commit `616a4ea59f84885cae294f0aa5f31dd9dffac129`, with recent changes compared
against `f9c1b9d3853226fe8a1a3181703f884106393ad0`. Locations below refer to that baseline. Inspect
the current definitions before changing them. The audit used OpenCode and separate GPT-6 Astra
reviewer contexts; it was not an ECC execution.

These are inputs to [[Repository audit remediation map]], not approved implementation tickets.
Each proposed slice must reproduce the behavior, establish its desired outcome and name the
test that proves the repair. Source inspection establishes code shape; a mocked reproduction
establishes only the exercised boundary. Neither establishes a live Docker or authenticated
GitHub outcome. Temporary audit logs are not bundled here and must not be cited as a fresh run.

## Findings

### Execution and Git boundaries

| Finding | Baseline evidence | Required follow-up |
|---|---|---|
| A01 Host Git executes before the sandbox tampering check | `.sandcastle/main.ts:169-170` closes the sandbox before `scripts/sandcastle/afk.ts:319-323` checks the loop's aftermath. The pinned SDK source below performs host-side Git during cleanup against mounted Git metadata. A harmless fsmonitor command probe executed; a Docker escape was not run. | Resolve the execution-boundary decision, then reproduce the real boundary with a harmless sentinel and disposable repositories. |
| A02 Python fixture inherits Git routing | `evals/compliance/test_run_comply.py:312` passes plain `subprocess.run` to `run_comply.py:308`. A mocked run retained inherited Git-routing variables despite the fixture cwd. | Prove fixture initialization targets only the disposable fixture when a decoy Git environment is inherited; extend the fixture-environment control to Python. |
| A03 Explicit runner cwd does not scrub Git routing | `scripts/git/pr-ready.ts:26-31` calls `environmentFor({})` even with an explicit cwd. A mocked subprocess retained decoy Git variables. | Exercise the actual runner with an inherited decoy environment and verify the identified checkout is authoritative. |
| A04 Checks can change the commit later certified for publication | `pr-ready.ts:45-56,93-94` reads HEAD after checks; `.githooks/pre-push:11` trusts that SHA. A scripted runner changed HEAD during a successful check and publication continued. | Pin state before checking and refuse publication when relevant state changes, including check-failure paths. |
| A05 Existing PR identity is insufficiently checked | `pr-ready.ts:80-100` accepts any OPEN URL response without validating base, head repository or SHA. A mocked non-main PR in another repository was accepted. | Pin one push/PR repository and verify the existing PR holds the intended branch and commit into main. |
| A06 Working-tree snapshot hashes status rather than content | `scripts/git/git-state.ts:81` hashes porcelain output. Source inspection shows dirty-to-dirty content changes can preserve that output. | Reproduce tracked and untracked overwrites with unchanged status, then define and test content, mode and symlink coverage. |
| A07 Landing audit queries the wrong repository for fork commits | `config/landing-audit.json` names upstream while origin names the fork; Git history contains both provenances. GitHub queries at audit time associated the latest merge only with the fork. | Resolve the history-scope decision before changing repository names or the starting boundary. |
| A08 Landing audit does not validate the PR base | `scripts/git/landing-audit.ts:39-46` accepts merged state and a matching SHA. A mocked PR targeting another branch was accepted. | Require the intended base branch; define any merger-identity guarantee explicitly rather than inferring it from approval. |
| A09 Fetch success may leave the audited tracking ref stale | `landing-audit.ts:71` and `pr-ready.ts:50` fetch main without an explicit destination, then read origin/main. The failure depends on a narrowed fetch refspec and was source-reviewed. | Reproduce against a local bare origin with a narrowed refspec; compare with AFK's explicit-destination fetch. |

### Orchestration and operational behavior

| Finding | Baseline evidence | Required follow-up |
|---|---|---|
| A10 Total execution failure can report success | Actual `.sandcastle/main.ts` evaluated with mocked SDK calls completed ten rejected sandbox creations normally and printed All done. AFK's unchanged-state path returned zero. | Resolve partial-failure outcomes and test the actual orchestration entry point, including exhausted retries and partial work. |
| A11 Planner can schedule blocked work | `.sandcastle/plan-prompt.md:35` says to select a blocked candidate when every issue is blocked, contradicting the unblocked-only description. | Define the blocked-queue result and verify planning cannot silently waive prerequisites. |
| A12 Integration branch names are substituted into shell commands | `.sandcastle/review-prompt.md:9,13` inserts the target branch unquoted. Git accepted a command-substitution branch name; a harmless shell probe executed the substitution. | Validate or safely pass branch arguments at the execution boundary and test legal metacharacter-containing names. |
| A13 Orchestration is outside lint and coverage scope | `eslint.config.ts:14` and `package.json:13` omit `.sandcastle/main.ts`; helper and wrapper tests replace the loop. | Select the highest useful orchestration seam, include it in the canonical checks and test failure propagation and review/merge sequencing. |
| A14 Sandbox runtime differs from the declared toolchain | `.sandcastle/Dockerfile:1` uses Node 22; `.nvmrc` and engines require Node 24. The runbook acknowledges the mismatch. | Align the image and establish a reproducible dependency-install and image smoke-test recipe. |
| A15 Privacy exception admits traversal outside the allowed home | `scripts/wiki/redaction.ts:78` accepts traversal under the allowed role-name prefix. Actual calls under role-name runtime identities returned no finding; the existing traversal test used a personal runtime identity. | Add role-identity traversal controls and retain valid sandbox-path cases without embedding personal paths in documentation. |
| A16 Token expiry is used as an identity diagnostic | The Sandcastle runbook at lines 303-307 treats equal expiry as proof that the old token remains. Different tokens can share an expiry. | Replace the unsupported diagnostic with checks that establish the intended identity and write capability; keep unverified service behavior explicit. |

### Evaluation and metadata assurance

| Finding | Baseline evidence | Required follow-up |
|---|---|---|
| A17 Benchmark snapshot exposes previous results and rubric details | `evals/compliance/run_comply.py:216-222` excludes report/spec directories, but an actual in-memory archive retained scores and grading commentary in other files. | Define a benchmark-clean snapshot and inspect archive contents, preserving operational rules without leaking benchmark answers. |
| A18 Scoring rules weaken or omit required outcomes | Pinned specs in `evals/compliance/specs/` omit explicit prohibited-action checks and sometimes credit writing rather than running, documentation rather than wiring, or one of two required records. The recorded competing guard result illustrates classifier limitations. | Give prohibited actions and required artifacts independent outcome controls; rerun any model-backed measurement only with authorization and report its limits. |
| A19 Hidden headings satisfy required sections | `scripts/wiki/schema.ts:25-26` matches raw lines. Actual pure-validator calls accepted required headings inside comments and fenced code. | Validate real Markdown headings, with visible valid cases and refusing hidden-heading controls. |
| A20 Imported companion files lack provenance coverage | `scripts/skills/provenance.ts:93-101` hashes SKILL.md, not its companion instruction files. Instrumented validation reads confirmed that boundary. | Define and validate the imported file inventory, including changed, added and deleted companions. |
| A21 Historical wiki immutability lacks a history comparison | Inspected wiki validation and compliance paths check current content, subjects and commit shape, not historical bodies or immutable author/creation fields. | Define permitted supersession edits and reproduce forbidden historical changes in disposable history before implementing enforcement. |
| A22 Ordinary shell forms evade the local merge/push backstop | Actual hook-function probes allowed a conditional merge, command substitution in an unquoted heredoc and push forms using the repo option. | Add refusing controls and repair recognition while preserving legitimate command cases. This is not evidence of bypassing required GitHub approval. |

## Upstream sources for the execution boundary

Read on 2026-10-16, for locked package `@ai-hero/sandcastle` version `0.12.0`:

- [Package metadata](https://registry.npmjs.org/@ai-hero%2Fsandcastle/0.12.0) identifies source
  revision `e99f832f26dc9d245c019a9ddd19fa5dee792427`.
- [SandboxFactory.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/SandboxFactory.ts): Git mount resolution.
- [createSandbox.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/createSandbox.ts): cleanup calls into host Git-state inspection.
- [WorktreeManager.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/WorktreeManager.ts): host Git execution and status queries.
- [PromptArgumentSubstitution.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/PromptArgumentSubstitution.ts): prompt-argument substitution relevant to A12.

## Verification context

VERIFIED: the exact audit-baseline GitHub check run reported 753 Node tests, 56 Python tests,
and passing repository guards. The locked-dependency audit reported zero known vulnerabilities.
These results describe the baseline checks' scope, not absence of the findings above.

UNKNOWN: live Docker/model behavior, authenticated end-to-end Sandcastle recovery and the effect
of benchmark contamination on historical scores were not reproduced. Each implementation ticket
must record its own current evidence and any remaining limit.
