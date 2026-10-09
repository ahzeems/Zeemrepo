---
name: eval-driven-development
description: Define atomic evals before agentic features; verify state, isolation, traces and adversarial controls. Structural checks do not prove agent behavior.
---

# Eval-driven development

Use for an agentic feature, a changed instruction or skill, a repeated workflow failure, or
an eval review. This method owns case design and evidence quality. tdd owns red/green work;
verify-work owns the acceptance verdict; wiki-memory owns durable outcomes.

## Define before building

1. Read the request, current source and owning work record. State one observable job per case.
   Use the existing flow inventory and real test interface; do not invent a second feature map.
2. Specify initial synthetic state, authorized actions, final state and invariants. Turn each
   requirement into a binary assertion. Split a vague judgment until a reviewer can cite
   evidence for yes or no.
3. Name the independent verifier and create a valid control plus a deliberately broken state.
   Run the real verifier against both. A broken control passing blocks claims based on it.
4. Use the [case contract](../../../wiki/reference/Eval%20case%20contract.md). Run
   `npm run eval:lint` for specification structure and `npm run check` for existing regressions.
   Neither command runs a model or proves that the described sandbox exists.

## Observe in isolation

1. Use a demonstrated disposable container, VM or controlled launch for agent actions. Keep production credentials,
   host home directories, Docker sockets, private data and hidden expectations outside it.
   A temporary checkout is a fixture, not an operating-system boundary.
2. Set time, trial and cost limits before running. Use existing authorized model access;
   account/client configuration is not permission for new purchases or credential changes.
3. Capture visible prompts/responses, tool arguments/results, exits, relevant file/network
   effects, source/fixture/verifier revisions and measured usage from the controller.
   Capture no hidden reasoning or real secrets. Keep logs outside the actor's writable area.
4. Check state independently. An actor's success message is evidence to inspect, not a verifier.
   Exercise poisoned notes, forbidden access, leaked oracle data, log/test tampering, partial
   failure and misleading completion claims. Vary held-out inputs; retain every failed run.

## Grade and close

1. Grade each required assertion from actual observations. An observed violation fails;
   missing evidence is unverified. All assertions must be observed and pass to pass the case.
   The observation summarizer aggregates trusted findings; it cannot authenticate traces.
2. Record baseline and changed runs before claiming better outcomes or token savings.
   Preserve required-fact accuracy and provenance. One smoke run proves only that run.
3. Keep structural, selection and outcome results separate. Explicitly state unrun cases,
   missing collectors and scope limitations. The Git gate does not launch or grade agents.
4. Use separate review and verify-work. Store durable evidence in the owning work record;
   observed bugs go to issues and reusable prevention to lessons. Rerun affected cases when
   instructions, skills, client or behavior changes.
5. Close gaps through the existing owner: a script for a deterministic check, the owning skill
   for repeated judgment, a runbook for an operation. Use write-skill before adding a method.

## Sources

- [Workflow evals](../../../wiki/reference/Workflow%20evals.md) and
  [case tests](../../../scripts/eval-contracts.test.ts), inspected 2026-09-21.
- [Repository bindings](../../../AGENTS.md#workflow-evals) define verification and memory ownership.
