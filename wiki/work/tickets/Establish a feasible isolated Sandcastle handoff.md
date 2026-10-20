---
type: ticket
title: Establish a feasible isolated Sandcastle handoff
summary: Source research supports an outer disposable container with inner noSandbox workers and bundle transfer; live containment and trusted verification still require implementation tests.
tags: [area/planning, area/agents, kind/architecture]
created: 2026-10-16
updated: 2026-10-16
agent: opencode
status: done
owner: agent
priority: P1
next_action: Use this research when creating the approved plan's job specs; establish live containment through the required implementation control before runtime cutover.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
ticket_kind: research
map: "[[Repository audit remediation map]]"
depends_on: ["[[Choose the Sandcastle execution boundary]]"]
evidence:
  - "OWNER DECISION: the owner selected full-workflow isolation on 2026-10-16 in Choose the Sandcastle execution boundary."
  - "VERIFIED: finding A01 records host-side Git during the pinned SDK's cleanup; a separate worktree alone does not establish the selected boundary."
  - "VERIFIED: the installed 0.12.0 package exports sandboxes/no-sandbox; the pinned upstream ADR-0015 and implementation support run and createSandbox in an already-isolated environment."
  - "VERIFIED: a local Node 24 experiment using createRepo and real Git bundles preserved the candidate SHA, rejected an incremental bundle missing its prerequisite with exit 1, and transferred no source configuration, hook, untracked file or checked-out candidate file. The temporary repositories were removed."
  - "INFERRED: an outer disposable container using the existing noSandbox provider internally is a source-supported design that avoids sharing host Git metadata or a host runtime-control socket."
  - "UNKNOWN: Docker is unavailable on the current machine. Live container containment, credentials, independent verifier receipts and end-to-end publication have not been demonstrated."
---

## Question

Which supported design can run the coordinator, agents, Git operations and checks in a disposable
environment, then transfer candidate commits and their check evidence without giving the host
agent-controlled executable configuration or commands?

## Evidence

Start with finding A01 and its pinned upstream sources in [[Repository audit findings 2026-10-16]].
Inspect `.sandcastle/main.ts`, `scripts/sandcastle/afk.ts`, `scripts/git/pr-ready.ts` and the locked
SDK. The current publication path runs checks on the host, so its integration with isolated check
results must be explained rather than assumed. Design recovery results around the approved
policy in [[Define Sandcastle partial-failure outcomes]]: reviewed successes may proceed while
failed work stays unintegrated, and retries preserve completed work without duplicate notifications.
Bind any reused check and review evidence to the candidate commit it actually verified.

## Options

Compare the runtime's supported isolation mechanisms against a disposable environment containing
the coordinator and its worker runtime. For each feasible candidate, identify:

- What executes inside the disposable environment and what trusted tooling remains on the host.
- How Git metadata, executable configuration, hooks and runtime control interfaces are separated.
- What data returns, how its commit identity and check evidence are verified, and how rejected
  or interrupted imports are recovered.
- Required dependencies, infrastructure, credentials, costs and unresolved capability limits.
- The highest useful test seam, including a harmless sentinel that exposes the audited failure.

## Recommendation

Research the smallest supported design that satisfies the chosen boundary before proposing a
runtime port or broad SDK fork. Use source inspection and non-model verification appropriate to
the question. Record primary sources and their dates; do not treat an untested design as a working
integration. Return infrastructure or cost choices requiring owner input as decision tickets.

## Resolution

Research completed on 2026-10-16 by an independent OpenCode research context, with its key source
claims read back and the Git-transfer primitive exercised by the coordinating session. This
settles the availability of a design path, not its implementation or live containment proof.

### Source-supported design

INFERRED: use one disposable outer container for the coordinator and its workers, selecting the
SDK's `noSandbox()` provider only inside that environment. The provider's local processes and
Git cleanup then run inside the outer boundary. A trusted launcher outside the candidate tree
supplies a pinned starting commit and a sanitized environment. Host Git directories, worktrees,
home directories and runtime-control sockets must not be mounted into the execution environment.

The builder's output is a candidate, not a verification verdict. Export explicit candidate refs
as Git bundles with a versioned data manifest. Receive bounded artifacts into quarantine and
validate their refs, prerequisites, object integrity and expected base/candidate identities in
a fresh repository with trusted configuration. Do not import a returned Git metadata directory
or execute commands supplied by a result manifest.

Tracked files such as `.githooks/` remain candidate content in a bundle. Omitting source Git
metadata does not make those files trusted or authorize executing them on the host.

Reconstruct the candidate in a fresh verification environment with a separate reviewer context
and no implementer session or writable volume. Trusted supervision must record the candidate
and base SHAs, verifier/check-runner revision, image identity, outcomes and log digests. Its
receipt must be outside the builder's authority. Changes to check machinery require explicit
review; a builder-authored JSON claim is insufficient. Any integration producing a different
commit needs verification of that integration result.

The host publication path must use pinned, trusted tooling to publish the receipt-bound commit
while preserving repository, branch, machine-account and owner-review checks. Current
`pr-ready.ts` runs the candidate's check on the host, and pre-push also executes checkout code;
those paths require an explicit isolated-verification integration, not an unchecked skip flag.

Use per-issue, per-commit phase state for recovery. Preserve unfinished-work artifacts before
teardown, and restore those only inside a new disposable environment. Bundles alone do not
preserve uncommitted work. A changed candidate invalidates its old check/review evidence. Before
retrying an ambiguously delivered notification, reconcile its stable marker with the remote
record rather than blindly reposting. The existing reflog heuristic is not imported provenance.

### Evidence and limits

VERIFIED: the installed package exports the no-sandbox provider. The upstream implementation
starts local subprocesses, inheriting its process environment; this makes the outer boundary
and environment sanitization essential. Upstream Orchestrator.ts passes
`dangerouslySkipPermissions: true`, despite conflicting no-sandbox documentation. Agent-level
permissions must not be treated as the isolation boundary.

VERIFIED: in two temporary repositories created with `scripts/test-support/repo-fixture.ts`,
the coordinating session exported full and incremental candidate bundles. `git bundle verify`
refused the missing-prerequisite control with exit 1. Fetching the full bundle's explicit ref
preserved its SHA; a source-only config key, hook and untracked file were absent from the
receiver, and no candidate checkout occurred. This proves the tested transfer primitive, not
a production importer or containment of hostile inputs.

VERIFIED: the SDK's existing isolated-provider transfer uses patches and `git am`, which can
rewrite SHAs. It is useful prior art but does not provide the proposed exact-SHA receipt contract.

UNKNOWN: `command -v docker` returned 1. The real SDK cleanup/host-sentinel container control,
credential behavior, resource limits, recovery artifacts and the complete verification-to-PR
path remain untested. The first isolation slice must establish a real non-model container test;
failure to establish the chosen boundary must stop that implementation path rather than select
host execution silently. No infrastructure installation or paid evaluation was performed.

### Sources

Primary sources read on 2026-10-16:

- Installed `node_modules/@ai-hero/sandcastle/package.json` and `package-lock.json`: version and exports.
- [SDK ADR-0015](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/docs/adr/0015-no-sandbox-in-run-and-create-sandbox.md): no-sandbox support in run and createSandbox.
- [no-sandbox.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/sandboxes/no-sandbox.ts): local subprocess and environment behavior.
- [Orchestrator.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/Orchestrator.ts): the actual agent permission flag.
- [syncOut.ts](https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/syncOut.ts): patch-based transfer and rewritten host SHAs.
- [Git bundle manual](https://git-scm.com/docs/git-bundle): object/ref transfer, prerequisite verification and omitted local repository state.
- Repository `scripts/git/pr-ready.ts`, `.githooks/pre-push` and `scripts/sandcastle/afk.ts`: publication, check execution and current retry behavior.
