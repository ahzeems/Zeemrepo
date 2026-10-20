---
type: plan
title: Repository audit remediation implementation plan
summary: Remediate all 22 audit findings through dependency-ordered job specs, complete workflow isolation, receipt-bound publication and independently verified regression controls.
tags: [area/planning, area/agents, area/compliance]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: approved
approval_ref: "#15"
owner: human
priority: P1
next_action: Owner reviews the 26 proposed job specs; after verifying their merge approval, begin S01 Fixture Git containment in a fresh execution session.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
map: "[[Repository audit remediation map]]"
job_specs: required
related: ["[[Audit remediation verification approach]]", "[[Resume repository audit remediation]]"]
evidence:
  - "OWNER DECISION: on 2026-10-16 the owner selected complete workflow isolation, approved the partial-failure policy and selected fork-only auditing in the three linked decision tickets."
  - "OWNER DECISION: after the verification approach was presented, the owner directed the agent to do what it takes to complete the PR for merge and proceed as required; the exact instruction is in the originating idea."
  - "VERIFIED: the research ticket identifies a supported inner SDK provider and records a real Git-bundle experiment preserving candidate identity without transferring source Git configuration, hooks or untracked files."
  - "VERIFIED: structural inspection found 26 unique slices with an acyclic parent graph covering all A01-A22 findings; Fixture Git containment is the first eligible slice."
  - "VERIFIED: this plan was published for owner review in https://github.com/Zimfra/software_testing/pull/15 with the machine account as author."
  - "VERIFIED: GitHub reports PR 15 merged by code owner ahzeems on 2026-10-16 at 16:08:27 UTC, with reviewed head 18e32772ddc74e9debffad66e708b4623e728cf6 and merge commit edb9e35da1284e7593bd62f6408cc719771d9b7d on origin/main. This is the plan's approval reference."
  - "INFERRED: the source-supported outer-container design can implement the selected boundary; the first runtime slice must prove containment through a real non-model container test."
  - "VERIFIED: the owner-merged 26-slice breakdown is expanded into canonical proposed job-spec tickets with the same named dependencies; their status and implementation evidence live in those notes."
  - "UNKNOWN: job-spec owner approval and implementation-specific red/green evidence remain pending. Plan approval does not establish live containment or future runtime behavior."
---

## Problem

The baseline audit found 22 gaps across execution boundaries, Git-state handling, orchestration,
privacy, metadata integrity and evaluation reliability. Existing helper coverage did not expose
several failures at the actual coordinator and host boundaries. The baseline, source citations
and evidence limits are in [[Repository audit findings 2026-10-16]].

The owner wants committed planning reviewed through a pull request, then execution by another
LLM in a different terminal session. This plan supplies the behavior, dependency order, test
seams and handoff contract needed to create bounded implementation tickets.

## Destination

An isolated Sandcastle workflow that publishes only the intended independently verified commit,
reports partial failure honestly and resumes recoverable work without duplicate notifications.
The landing audit covers this fork after its verified boundary. Repository and evaluation guards
reject the audited counterexamples while retaining valid controls.

Each implemented slice ends with command-backed acceptance evidence, an independent review at
a pinned SHA and an owner-merged PR. Another session can recover the exact work state from the
project, plan and tickets without the original conversation.

## Constraints

- Plan approval is the verified owner merge of [PR 15](https://github.com/Zimfra/software_testing/pull/15).
  Recheck that reference before ticket creation. The owner approves required job specs before implementation.
- Bootstrap compatibility: the initial proposed note linked its map through `related` because
  main's old validator counted a downstream plan as an unfinished map ticket. PR 15 landed the
  fix, and this approval handoff restores the typed `map` relationship with the same ownership.
- Use one canonical build ticket per slice below, sized for one fresh context. If a slice grows
  beyond that, split its deliverable and preserve the dependency graph with owner agreement.
- Use the current harness's tools and the shared repository skills. Attribute authors and
  reviewers truthfully; a substitute reviewer is not an ECC run.
- Build test-first. Reproduce destructive cases only in disposable fixtures. Implement fixture
  containment first from an identified root checkout with inherited Git routing scrubbed; do not
  run the unsafe baseline checks under a real linked-worktree hook. Subsequent implementation
  worktrees wait for that containment fix.
- Follow `manage-branch`, keep wiki commits separate and publish through the machine account.
  Only the owner approves or merges. [[Planning pull request publication is blocked]] tracks
  the current environment issue independently from design completion.
- Keep routine authoring checks usable without local Docker. The real container control runs
  in a Docker-capable environment and an existing required CI check; missing proof is not a pass.
- Supply only explicitly scoped runtime credentials. Live model evaluations and authenticated
  write trials require their own owner authorization; regression controls use fake agents/services.
- Reuse the repository's standard-library helpers, installed Markdown parser and Node test runner.
  Any new dependency requires a concrete justification and manifest/lockfile changes together.
- All A01-A22 findings remain in scope. A deferred finding needs an explicit owner disposition.

## Decisions

- OWNER DECISION: [[Choose the Sandcastle execution boundary]] selects a disposable environment
  for the coordinator, agents, Git operations and checks, with controlled host import.
- OWNER DECISION: [[Define Sandcastle partial-failure outcomes]] permits checked/reviewed successes
  to proceed, holds failures and unreviewed work, requires an incomplete/nonzero result and
  resumes missing phases while preserving completed work and avoiding duplicate notifications.
- OWNER DECISION: [[Choose the landing audit history scope]] limits assurance to
  `Zimfra/software_testing` after exclusive boundary
  `f9c1b9d3853226fe8a1a3181703f884106393ad0`. The first included main merge is
  `bf3e4073f32ae593d02c55eae1f003ba711bd41e`.
- VERIFIED: [[Establish a feasible isolated Sandcastle handoff]] establishes the SDK's supported
  inner `noSandbox()` provider and Git-bundle transfer primitive. Its composition into a complete
  outer-container workflow remains a proposed design with required live proof.
- OWNER DECISION: [[Audit remediation verification approach]] is the verification approach to
  carry into the proposed plan following the owner's direction to proceed. It does not prove
  the future implementation or replace the plan's merge approval.

### Target execution and evidence contract

The following describes work to build, not an installed capability.

1. **Trusted preparation.** Run the host launcher from pinned tooling outside the candidate
   checkout. Capture the repository, starting branch, fresh main SHA, base SHA, task inputs,
   image identity and tool revision in host-owned run state. Construct explicit input bundles
   with sanitized environments and fixed argument lists.
2. **Disposable execution.** Start the outer environment with no host Git metadata, working
   checkout, home directory or runtime-control socket exposed. Run the SDK coordinator and
   its local `noSandbox()` workers only inside that boundary. Bound resources and artifact
   sizes using validated settings outside the candidate's control. A missing runtime refuses
   the operation; it never selects host execution as a fallback.
3. **Untrusted candidate export.** Export explicit candidate refs as bundles plus a versioned
   data manifest. Treat all guest phase labels as claims. Preserve unfinished work separately
   before teardown; restore it only into a disposable environment. Reflog entries are not
   portable provenance, and bundles do not preserve uncommitted work.
4. **Quarantine and independent verification.** Validate artifact types, limits, refs, required
   objects, base and candidate identities in fresh repositories with trusted configuration.
   Execute checks and review in fresh isolated contexts without the implementer's session or
   writable volumes. Trusted supervision owns the result receipt, not builder-authored JSON.
   Record candidate/base SHAs, task inputs, runner/reviewer revision, image identity, commands,
   outcomes and log digests. Changes to check machinery are explicit review inputs.
5. **Eligible integration.** Only independently checked/reviewed issue results are eligible.
   Failed or unreviewed issue refs remain held; dependants of failed work remain blocked. Run
   integration inside the disposable boundary and verify the resulting integration SHA before
   publication. A changed candidate, base or acceptance input invalidates dependent evidence.
6. **Trusted import and publication.** Import only validated objects and expected refs; never
   import guest Git configuration or execute commands from a manifest. Tracked hook and script
   files remain candidate content, not trusted host tooling. Publish the receipt-bound SHA from
   a trusted control checkout without checking out or executing candidate code on the host.
   Preserve repository, branch, actor and pre-push controls through the isolated verification
   contract; do not introduce a generic unchecked skip or bypass hooks with `--no-verify`.
7. **Recovery and notification.** Keep durable per-issue/per-commit phase state outside writable
   guest volumes. An incomplete run names its failures and exits nonzero even when independent
   successes proceed. Reuse only evidence for unchanged inputs. Reconcile an ambiguous remote
   publication or notification result before retrying, using stable identifiers to avoid duplicates.

## Test seams

Use [[Audit remediation verification approach]] for the agreed layers and evidence limits:

- Real disposable Git repositories and CLI runs, using `scripts/test-support/repo-fixture.ts`.
- The actual coordinator with fake model/service boundaries, rather than replacing the whole loop.
- A real disposable-container test using the pinned SDK and harmless sentinel commands, without
  paid model calls. Its runner and CI wiring are created in the runtime-proof slice below.
- Actual validators driven with valid and broken artifacts, including commit-history fixtures.
- Offline evaluation snapshots and observable outcomes through the existing Python test harness.

Existing tests under `scripts/git/`, `scripts/sandcastle/`, `scripts/wiki/`, `scripts/skills/`
and `evals/compliance/` are prior art, not proof of the new outcomes. Every build ticket names
its exact commands and valid/broken controls. An authenticated service result or real model
behavior remains unverified until that boundary is actually exercised with authorization.

## Implementation slices

These slices are the breakdown approved through PR 15. Their canonical job-spec notes are linked
below; all are proposed until the owner merges the job-spec PR. The approved slice requirements
remain here as the source contract; live status, implementation details and evidence belong to
the tickets. Parents are actual ticket prerequisites, never this plan or its map.

### S01 Fixture Git containment

Job spec: [[S01 Fixture Git containment]].

- **Parents:** none. **Findings:** A02.
- **Deliverable:** every Python fixture subprocess targets its disposable repository despite
  inherited Git-routing variables; the test-environment control includes this Python path.
- **Acceptance:** a real decoy-repository control leaves its refs, configuration and files
  unchanged while fixture initialization succeeds; ordinary setup still passes `evals:test`.
- **Surface:** `evals/compliance/test_run_comply.py`, relevant harness helpers and fixture checks.

### S02 Explicit-checkout command routing

Job spec: [[S02 Explicit-checkout command routing]].

- **Parents:** S01 Fixture Git containment. **Findings:** A03.
- **Deliverable:** an explicit runner cwd is authoritative for Git, Node and npm operations.
- **Acceptance:** actual runner calls under inherited decoy Git variables inspect only the named
  checkout; the decoy stays unchanged; caller-intended hook behavior without a cwd is preserved.
- **Surface:** `scripts/git/pr-ready.ts`, `scripts/lib/git.ts` and runner tests.

### S03 Fresh pinned main revisions

Job spec: [[S03 Fresh pinned main revisions]].

- **Parents:** S02 Explicit-checkout command routing. **Findings:** A09.
- **Deliverable:** readiness and audit paths use the explicitly refreshed, pinned main revision.
- **Acceptance:** narrowed fetch refspecs cannot leave a successful check using stale main;
  unavailable origin and missing/unverifiable fetched refs fail with the correct refusal/error.
- **Surface:** Git and Sandcastle fetch callers and real bare-origin fixture tests.

### S04 Content-sensitive working-state snapshots

Job spec: [[S04 Content-sensitive working-state snapshots]].

- **Parents:** S01 Fixture Git containment. **Findings:** A06.
- **Deliverable:** snapshots detect tracked and nonignored untracked content changes even when
  status text stays the same; file-mode and symlink behavior is explicit.
- **Acceptance:** dirty-to-dirty and untracked-to-untracked overwrites refuse; an unchanged tree
  passes; tests establish the documented boundaries without serializing secrets.
- **Surface:** `scripts/git/git-state.ts` and its fixtures.

### S05 Checked-commit publication invariant

Job spec: [[S05 Checked-commit publication invariant]].

- **Parents:** S02 Explicit-checkout command routing; S04 Content-sensitive working-state snapshots.
  **Findings:** A04.
- **Deliverable:** publication uses the unchanged branch, SHA and relevant state captured before checks.
- **Acceptance:** checks that move HEAD, switch branches or change relevant state prevent publication
  on both success and failure; unchanged checks pass; the tool never certifies a replacement SHA.
- **Surface:** PR readiness and its interaction with pre-push/state verification.

### S06 Exact PR destination and head identity

Job spec: [[S06 Exact PR destination and head identity]].

- **Parents:** S03 Fresh pinned main revisions; S05 Checked-commit publication invariant. **Findings:** A05.
- **Deliverable:** an opened or reused PR identifies the intended repository, main base, source
  repository/branch and checked head SHA.
- **Acceptance:** wrong repository, non-main base, stale head or mismatched fork refuses; the
  correct existing PR is reused; Git and gh cannot silently select different destinations.
- **Surface:** `scripts/git/pr-ready.ts` and GitHub response controls.

### S07 Fork-only landing assurance

Job spec: [[S07 Fork-only landing assurance]].

- **Parents:** S03 Fresh pinned main revisions. **Findings:** A07, A08.
- **Deliverable:** audit only this fork after the selected exclusive boundary and validate actual
  main-branch PR landings, including the claimed owner-merger guarantee against trusted policy.
- **Acceptance:** the first fork merge is included and inherited history excluded; a wrong/missing
  boundary, direct update, non-main PR, mismatched SHA or unauthorized merger cannot pass. Historical
  owner-policy changes are evaluated from the relevant trusted history, not today's owner alone.
- **Surface:** `config/landing-audit.json`, landing-audit logic, fixtures and the merge-gate contract.

### S08 Testable coordinator entry point

Job spec: [[S08 Testable coordinator entry point]].

- **Parents:** S01 Fixture Git containment. **Findings:** A13.
- **Deliverable:** expose the actual orchestration to fake model/service boundaries and include
  its production paths in lint and coverage accounting.
- **Acceptance:** tests invoke the real sequencing code and detect a deliberately broken transition;
  lint/coverage include it. Keep behavior changes for subsequent slices rather than hiding them in
  the prefactor.
- **Surface:** `.sandcastle/main.ts`, orchestration modules, test discovery and verification docs.

### S09 Explicit phase outcomes and review eligibility

Job spec: [[S09 Explicit phase outcomes and review eligibility]].

- **Parents:** S08 Testable coordinator entry point. **Findings:** A10.
- **Deliverable:** distinguish produced work, passed checks/review, eligible integration, failure
  and incomplete work under the approved policy; a fresh reviewer does not certify its own edits.
- **Acceptance:** total failure and exhausted work cannot return success; a failed review holds
  that issue; independent passing work remains eligible; changed SHAs invalidate old evidence.
- **Surface:** coordinator results, review contract and actual-loop regression tests.

### S10 Blocked-queue planning contract

Job spec: [[S10 Blocked-queue planning contract]].

- **Parents:** S09 Explicit phase outcomes and review eligibility. **Findings:** A11.
- **Deliverable:** planning cannot deliberately waive unresolved dependencies when all work is blocked.
- **Acceptance:** all-blocked and empty queues are explicit non-executing outcomes, not execution
  failures or completed issue work; known blocked candidates never enter the execution phase.
- **Surface:** planner prompt/schema, coordinator handling and deterministic fake-plan controls.

### S11 Non-executable branch inputs

Job spec: [[S11 Non-executable branch inputs]].

- **Parents:** S08 Testable coordinator entry point. **Findings:** A12.
- **Deliverable:** Git-valid branch names remain data when review inputs are prepared.
- **Acceptance:** harmless command-substitution and quoting controls cannot execute; ordinary
  branches still yield the intended diff and log; test the actual prompt preparation boundary.
- **Surface:** review prompt, coordinator arguments and branch/ref handling.

### S12 Reproducible runtime and real containment control

Job spec: [[S12 Reproducible runtime and real containment control]].

- **Parents:** S01 Fixture Git containment. **Findings:** A14 and the boundary proof for A01.
- **Deliverable:** a Node-24-aligned, reproducible image and a real non-model container test runner
  wired into an existing required CI check. This is the early feasibility gate for isolation.
- **Acceptance:** real SDK create/cleanup with a fake agent or sentinel executes only inside the
  disposable environment; host sentinels remain untouched, prohibited mounts are absent and missing
  runtime support refuses. Lockfile installation and runtime versions are recorded.
- **Surface:** container image/launcher test harness, CI, package scripts and feature-map recipes.

### S13 Candidate artifact contract and quarantine

Job spec: [[S13 Candidate artifact contract and quarantine]].

- **Parents:** S02 Explicit-checkout command routing; S03 Fresh pinned main revisions. **Findings:** A01.
- **Deliverable:** validate versioned candidate manifests and explicit-ref bundles as untrusted data,
  without activating candidate code or importing guest Git configuration.
- **Acceptance:** a valid candidate preserves SHA; wrong refs/base/version, missing prerequisites,
  malformed or oversized artifacts and unsafe file types refuse. Uncommitted recovery data is
  distinct from publishable commits and is never restored into the host checkout.
- **Surface:** Sandcastle artifact/import commands and real temporary-repository controls.

### S14 Isolated coordinator preparation and export

Job spec: [[S14 Isolated coordinator preparation and export]].

- **Parents:** S08 Testable coordinator entry point; S09 Explicit phase outcomes and review eligibility;
  S10 Blocked-queue planning contract; S11 Non-executable branch inputs;
  S12 Reproducible runtime and real containment control; S13 Candidate artifact contract and quarantine.
  **Findings:** A01.
- **Deliverable:** pinned trusted tooling prepares a disposable run, executes the coordinator and
  workers inside it and returns candidate/recovery artifacts through the defined contract.
- **Acceptance:** no host Git metadata, home or runtime-control socket is shared; noSandbox runs
  only inside the outer environment; candidate outputs cannot authorize publication; failed and
  interrupted runs preserve recoverable work without claiming completion.
- **Surface:** host/guest entry points, runtime configuration and actual container controls.

### S15 Independent isolated verification receipts

Job spec: [[S15 Independent isolated verification receipts]].

- **Parents:** S12 Reproducible runtime and real containment control;
  S13 Candidate artifact contract and quarantine. **Findings:** A01 and the evidence gap in A13.
- **Deliverable:** fresh isolated check/reviewer contexts produce host-supervised receipts bound
  to the candidate, base, task inputs, runner/reviewer and image identities.
- **Acceptance:** builder-written success, stale SHA/base, changed check state, missing review and
  tampered/replayed evidence cannot authorize a candidate. New integration SHAs need new verification.
- **Surface:** trusted verifier driver, receipt validation and fake/real boundary controls.

### S16 Trusted publication of verified candidate refs

Job spec: [[S16 Trusted publication of verified candidate refs]].

- **Parents:** S05 Checked-commit publication invariant; S06 Exact PR destination and head identity;
  S13 Candidate artifact contract and quarantine; S15 Independent isolated verification receipts.
  **Findings:** A01, with A04/A05 invariants carried into the new path.
- **Deliverable:** publish the receipt-bound ref through pinned control tooling without executing
  candidate scripts or hooks on the host, preserving actor and branch protections.
- **Acceptance:** unverified refs, wrong PR identity, owner credentials, main pushes and evidence
  bypasses refuse; a valid candidate creates/reuses the correct PR. Tests prove the source of every
  host-side executable and distinguish candidate verification from control-checkout checks.
- **Surface:** trusted publication path, shared PR checks, hook integration and runbooks.

### S17 Durable recovery and notification reconciliation

Job spec: [[S17 Durable recovery and notification reconciliation]].

- **Parents:** S09 Explicit phase outcomes and review eligibility;
  S13 Candidate artifact contract and quarantine; S15 Independent isolated verification receipts;
  S16 Trusted publication of verified candidate refs. **Findings:** A10 recovery behavior.
- **Deliverable:** resume missing phases from durable per-issue/per-commit state and reconcile
  ambiguous remote results without duplicate publication or notifications.
- **Acceptance:** interrupted import, partial success, successful remote delivery with a lost
  acknowledgement and changed task/commit inputs preserve work and choose the correct retry;
  incomplete work remains visible with a nonzero outcome.
- **Surface:** run state, recovery artifacts, notification handling and deterministic failure injection.

### S18 Public-command cutover and end-to-end isolation proof

Job spec: [[S18 Public-command cutover and end-to-end isolation proof]].

- **Parents:** S14 Isolated coordinator preparation and export;
  S15 Independent isolated verification receipts; S16 Trusted publication of verified candidate refs;
  S17 Durable recovery and notification reconciliation. **Findings:** A01, A10, A13, A14 integration.
- **Deliverable:** route the public Sandcastle commands through the complete isolated path and
  retire replaced host-execution/reflog/bypass paths in the same change. Earlier stages expose
  independently testable preparation/verification boundaries without partially rewiring the public flow.
- **Acceptance:** a real-container fake-agent run reaches the intended verified handoff; mixed
  success/failure and recovery satisfy the approved policy; no candidate code executes on the host.
  Manual and AFK command outcomes, remaining prerequisites and limits are documented and tested.
- **Surface:** package entry points, `.sandcastle/`, AFK integration, CI and operating documentation.

### S19 Privacy exception confinement

Job spec: [[S19 Privacy exception confinement]].

- **Parents:** S01 Fixture Git containment. **Findings:** A15.
- **Deliverable:** permit genuine role-name sandbox paths while detecting paths that escape them.
- **Acceptance:** valid role paths pass under role and personal runtime identities; escaping
  traversal and look-alike home names refuse for every tested identity; controls avoid real personal data.
- **Surface:** redaction logic and its existing identity-injected tests.

### S20 Real Markdown section validation

Job spec: [[S20 Real Markdown section validation]].

- **Parents:** S01 Fixture Git containment. **Findings:** A19.
- **Deliverable:** required note/job-spec sections are actual visible Markdown headings.
- **Acceptance:** valid headings pass; headings hidden in comments or fenced examples cannot
  satisfy requirements. Reuse the installed parser and preserve valid document behavior.
- **Surface:** schema/work-record validation and valid/broken fixture CLIs.

### S21 Complete imported-skill provenance

Job spec: [[S21 Complete imported-skill provenance]].

- **Parents:** S01 Fixture Git containment. **Findings:** A20.
- **Deliverable:** the approved provenance inventory covers imported companion instructions as
  well as entry points, while keeping existing landed provenance append-only.
- **Acceptance:** an authorized inventory passes; changed, added or removed companions without
  an approved revision refuse. Distinguish an approved migration baseline from unverifiable original-source claims.
- **Surface:** provenance schema/validation, manifests, fixtures and skill standards.

### S22 Historical wiki integrity

Job spec: [[S22 Historical wiki integrity]].

- **Parents:** S01 Fixture Git containment. **Findings:** A21.
- **Deliverable:** history-aware checks enforce protected decision/session bodies and immutable
  author/creation fields, with explicit permitted supersession metadata updates.
- **Acceptance:** valid same-day edits and permitted supersession pass; later body rewrites,
  changed original identity/dates and required update-date omissions refuse in disposable history.
- **Surface:** wiki history validation, CLI integration, schema guidance and commit fixtures.

### S23 Benchmark-clean evaluation snapshots

Job spec: [[S23 Benchmark-clean evaluation snapshots]].

- **Parents:** S01 Fixture Git containment. **Findings:** A17.
- **Deliverable:** scenario snapshots preserve required operational tooling and valid wiki context
  while excluding prior results and private rubric commentary wherever copied.
- **Acceptance:** inspect actual archive contents with seeded leak controls, not only excluded
  directory names; the clean snapshot still runs the intended repository checks. Explicitly document
  any unavoidable visible implementation detail rather than asserting an unsupported no-leak guarantee.
- **Surface:** `evals/compliance/run_comply.py`, archive tests and evaluation documentation.

### S24 Outcome-based compliance requirements

Job spec: [[S24 Outcome-based compliance requirements]].

- **Parents:** S23 Benchmark-clean evaluation snapshots. **Findings:** A18.
- **Deliverable:** prohibited actions and required artifacts/outcomes receive independent checks
  instead of relying solely on positive tool-call labels or cascading step scores.
- **Acceptance:** main pushes/merges/approvals, warning-only guards, missing executed red tests,
  missing wiring and either missing change record fail independently; compliant controls pass.
  Version revised specs and do not compare new totals as if they used the old rubric.
- **Surface:** pinned evaluation specs, outcome-validation code, offline tests and reports' interpretation.

### S25 Shell-backstop refusal controls

Job spec: [[S25 Shell-backstop refusal controls]].

- **Parents:** S01 Fixture Git containment. **Findings:** A22.
- **Deliverable:** recognize the audited conditional, unquoted-heredoc substitution and explicit
  push-repository forms without treating the heuristic hook as a sandbox.
- **Acceptance:** each reported form refuses through the actual hook function/CLI; legitimate
  commands and inert quoted data pass. Preserve bounded parsing and documented limitations.
- **Surface:** `scripts/claude/block-pr-merge.ts`, its tests and the merge-gate contract.

### S26 Evidence-based token setup guidance

Job spec: [[S26 Evidence-based token setup guidance]].

- **Parents:** S01 Fixture Git containment, for safe hook-run verification. **Findings:** A16.
- **Deliverable:** token instructions distinguish identity, expiry and write permission without
  claiming that equal expiry proves token identity.
- **Acceptance:** primary-source citations support version-sensitive claims; the read-only and
  write-capability checks state their actual limits. Any live write trial is separately authorized
  and recorded; documentation and wiki checks pass.
- **Surface:** Sandcastle token runbook and its owning evidence record.

### Execution order and ticket handoff

Start with S01 Fixture Git containment. After it lands, prioritize S02 Explicit-checkout command
routing, S04 Content-sensitive
working-state snapshots and S12 Reproducible runtime and real containment control. Use the parents
above to expose subsequent work; run one ticket per fresh session. Logical independence does not
permit two writers in the same checkout or simultaneous edits to the same file without coordination.

The linked tickets contain the required Inputs, Allowed files, Forbidden files, Human checkpoints,
Secrets needed, Tests and evals, Rollback and recovery, Evidence, and Wiki and doc updates.
Verify the actual owner merge approving the current job-spec revision before implementation,
then verify each parent's completion PR. Lifecycle/evidence updates belong to the ticket;
changes to its approved goal, acceptance, scope or dependencies require renewed owner agreement.
Follow [[Resume repository audit remediation]] and do not create a parallel task list.

## Acceptance criteria

- [ ] Every A01-A22 finding has a completed verified slice above or an explicit owner-approved deferral.
- [ ] Destructive fixture controls leave the real checkout and decoy repositories unchanged.
- [ ] The real SDK/coordinator containment test passes in required CI without paid model calls;
  candidate Git configuration, hooks and commands never execute on the host through the workflow.
- [ ] Only the intended independently verified candidate/integration SHA can be published to the
  intended fork/main PR, with machine-account publication and owner-only approval/merging retained.
- [ ] Mixed success, failure, blocked work and interrupted delivery satisfy the approved outcome
  and recovery policy, including nonzero incomplete results and duplicate-notification prevention.
- [ ] Fork auditing validates in-scope main PR landings after the verified exclusive boundary and
  explicitly excludes inherited upstream history.
- [ ] Privacy, Markdown, provenance, history, shell and evaluation controls fail on their audited
  counterexamples and pass the corresponding valid cases through their canonical runners.
- [ ] Changed executable paths are linted, typechecked and covered; new checks are wired into
  `npm run check` or an existing required CI check with observable evidence.
- [ ] Each job spec records exact commands/results and an independent per-criterion verdict at
  the final SHA; operating docs and work records land with their behavior changes.
- [ ] The fresh-session handoff identifies the current phase, approved plan, eligible ticket,
  blockers and concrete next action without relying on chat history.

## Out of scope

- Inherited upstream landing history at and before the selected fork boundary.
- Porting Sandcastle or live compliance execution to another model API; repository authoring
  remains provider-neutral under ADR-0026.
- Automatic owner approval or merging, credential changes without authorization, or generic
  unchecked bypasses for verification, hooks or branch protection.
- Unapproved paid model evaluations, unrelated cleanup and a parallel tracking system.
- Claims of live containment, authentication or improved compliance scores based only on this
  plan, source inspection, a mock or the existing test suite.
