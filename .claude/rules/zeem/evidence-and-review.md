# Evidence and review

How claims are labelled and how work is checked. Decision: `wiki/decisions/ADR-0022 Independent review means a
separate reviewer context.md`. Steps: `wiki/runbooks/Verify a repository change.md`.

## Claims

- Label claims about the repository, its checks or its history: `VERIFIED:` (you ran or read it, and say
  what), `INFERRED:` (reasoned from evidence you name), `UNKNOWN:` (not established), or `OWNER DECISION:`
  (the owner said it; quote and date it). `wiki:lint` enforces the labels on work-record `evidence`.
- An implementer's summary, a subagent's success message or a passing exit code is evidence to inspect, not
  verification. A number you did not reproduce is unverified.
- A handoff reports each step as done (with its evidence), refused (what refused and why), failed (the
  tool broke), blocked (the blocker and who or what can clear it) or not run. Only a done step is reported
  as done. Work that stops early names the branch, `HEAD` and any uncommitted changes it leaves.
- Structural checks (lint, schema, types) do not prove behavior. Report structural, selection and outcome
  results separately, and name the checks you did not run.
- Every claim the wiki takes from an outside source (vendor docs, articles) cites the primary source and the
  date it was read; a lesson records what was observed and when. A search
  snippet or a roundup article is a lead, not a source.
- When docs and behavior disagree, decide whether the docs drifted or the product regressed. Never edit docs
  to hide a regression.

## Checks that prove something

- A checker or verifier is trusted only after it fails on a deliberately broken control: a tree under
  `scripts/fixtures/broken/` or a refusing case in its tests. A new guard is shown failing before it passes.
- Before fixing an apparently unenforced standard, plant the violation and confirm the check really misses it.
- Do not fix a defect you have not reproduced. The reproduction becomes the failing regression test.
- A prevention is a check that runs in an existing command (`npm run check`, a hook or CI) and fails on the
  original defect. "Be more careful" is not prevention; if there is none, write `none: <reason>`. Never point
  a prevention at a nearby file to make a record look complete.
- Never prescribe a check that nothing runs.

## Review

- The session or agent that wrote a change never certifies it. Review runs in a separate context: the ECC
  reviewer agents, `/ecc:review-pr`, or this repository's `finder` and `verifier` agents used together
  (`.claude/agents/`; the finder reads, the verifier reruns the checks).
- Review a pinned commit, not a branch name. A new head needs a new review.
- A verifier judges the artifact and its own runs, never the implementer's account. It does not edit,
  commit or approve what it judges, and it discloses any self-review.
- Fix review findings on the branch before handing it over; leave one open only with a stated reason.

## How ECC's testing applies here

ECC wins where this file and ECC disagree (`CLAUDE.md`).

- **Coverage.** ECC's 80% minimum holds for lines, functions and branches, enforced by the thresholds in
  `package.json`.
- **E2E tests.** This repository has no UI, so ECC's end-to-end tests are CLI runs against real temporary
  git repositories (`scripts/test-support/repo-fixture.ts`) plus the broken-fixture controls.
- **TDD.** ECC's test-first workflow is mandatory, with no exceptions (OWNER DECISION, 2026-10-09).
