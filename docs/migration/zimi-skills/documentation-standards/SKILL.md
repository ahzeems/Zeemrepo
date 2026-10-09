---
name: documentation-standards
description: "Repository documentation conventions: README, docs, inline comments, and accuracy. Load before writing or restructuring repo docs."
---

## Audience

Write as if the reader is a competent developer who has **never touched this repo, this
tooling, or in some cases git itself before** — not a peer who already shares your context.
Concretely:

- Define a term the first time it's used (e.g. don't say "rebase the branch" without having
  established what a branch is, if the doc is the kind someone would land on first).
- Don't assume the reader already knows *why* a convention exists — state the reasoning, not
  just the rule: rule, then worked examples, then a beginner primer for anyone missing the
  prerequisite vocabulary entirely.
- Prefer a short concrete example or worked case over an abstract description — this repo's docs
  lean on real incidents (a real PR number, a real failure hit and how it was fixed) rather than
  hypothetical ones, because a beginner trusts "here's what actually happened" more than "here's
  what could happen."
- This is the bar for onboarding-shaped docs especially (anything in the "how do I do X in this
  repo" category — setup instructions, dependency instructions, package READMEs). A deep architecture doc can assume the reader has read the onboarding docs
  first, but should still define anything specific to that doc's own subject matter rather than
  assuming tribal knowledge.

## Doc types

- **README** (repo root and each package) — orientation only: what this is, layout, quick
  start, links out. Kept short; depth goes in `docs/`, not the README.
- **`docs/`** — plans, reference, standards. Root `docs/` is cross-cutting (not specific to one
  package); package-specific depth stays beside its package. These directories are created
  later when the corresponding work exists.
- **Inline comments** — only for non-obvious *why* (see the TypeScript standards in `AGENTS.md`). Never a substitute
  for a proper doc when the topic is bigger than one line.

## Staying accurate

- A doc describing something version-sensitive (hardware, installed tooling, external service
  behavior) states its capture date and how to re-verify it.
- Stale docs (referencing files/tools that no longer exist) are dead weight — don't let one accumulate silently.
- Documents that specifically claim things exist on this machine (software, services,
  providers) need periodic re-verification against the actual machine. Internal consistency
  with the rest of the repo isn't enough. This matters most for provider/tool identity
  specifically — a passing mention of an alternative considered during design must never
  get documented as if it were the live integration; name the provider that was actually
  verified working, not one that was only discussed.

## Drafts vs confirmed

- Any standards doc written by a coding agent without your explicit input starts with a
  `> **Status:** draft default...` line. Remove that line only once you've actually reviewed and
  confirmed the content — don't let it silently age into "settled fact."

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
