---
name: research-trends
description: "Gather and verify external AI-ecosystem trends into a dated vault research note. For the public trends digest; not for reading this repository."
---

The trends digest is only worth reading if a claim in it can be checked. Everything here serves
that: a reader should be able to follow any finding back to a dated primary source and disagree
with it. A note that cannot be argued with is marketing.

This skill gathers and records. It does not publish — `publish-to-site` owns the decision about
what leaves the vault, and it will refuse a note that skipped the steps below.

## What is worth a finding

A finding changes what someone would build or choose. Three tests, all required:

- **It is new or newly settled.** A capability that shipped, a price that moved, a project that
  was archived, a benchmark that was independently reproduced.
- **It has a primary source.** The release, the repository, the specification, the paper, the
  pricing page. A roundup article is a lead to the source, never the source.
- **It survives the question "compared to what?"** "Faster inference" is not a finding. "Faster
  than its own previous release on the benchmark its authors publish" is.

An announcement of an intention is not a capability. A preprint is not a result. A vendor's own
benchmark of its own product is evidence about the vendor's claim, not about the product.

## The loop

1. **Fix the question first.** Write it down before searching. "What changed in agent tooling
   this fortnight?" is a question; "AI news" is a search box.
2. **Search wide, then narrow to primary sources.** Take what the search gives as a set of leads.
   Open the actual source for every claim you intend to record.
3. **Record the access date with every source.** A citation without a date cannot be judged
   stale, and these pages change under the same URL.
4. **Corroborate anything surprising.** One source is a report. Two independent sources, neither
   citing the other, is a finding. If you cannot get the second, record it as a report and label
   it.
5. **Label every claim** VERIFIED, INFERRED, RECOMMENDED or UNKNOWN, as elsewhere in this
   repository. The label is the reader's guide to how hard to lean on the line.
6. **Search the vault before writing.** Update the existing note when the question is the same;
   a second note on one question splits the answer and both rot.

## The note

One research note per question, in `wiki/work/research/`, written through `wiki-memory` and its
schema: Question, Sources, Findings, Implications. Load that skill before the write, not after.

- **Question** — the one you fixed in step 1, unchanged.
- **Sources** — each with its URL, what it is, and the date you read it.
- **Findings** — one claim per line, labelled, each traceable to a listed source.
- **Implications** — what this would change *here*, or explicitly nothing. This is the section
  that earns the note; a digest with no implications is a feed.

Contradictions stay visible. When two good sources disagree, record both and say which you
believe and why. Resolving a disagreement by dropping one side is how a digest becomes wrong
confidently.

## What never goes in

- A prediction presented as a finding. Forecasts are labelled RECOMMENDED at best.
- A number without its measurement conditions.
- Anything copied at length from a source. Summarise, cite, and link.
- A source read only through a search-result snippet. Open it or drop it.

## Finishing

Record what you actually did: the queries, the sources opened, and the ones that failed to load
or sat behind a login. An unreachable source is evidence about the state of the research, and
hiding it makes the next pass repeat the work.

Hand the note to `publish-to-site` when it is meant for the public digest.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
