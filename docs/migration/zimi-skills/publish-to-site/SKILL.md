---
name: publish-to-site
description: "Decide what vault content may go public, and render it for the web platform. wiki-memory writes into the vault; this takes content out of it."
---

Publishing is the one action in this repository that cannot be undone. A note that reaches the
public site is fetched, cached and indexed within minutes, and deleting the page afterwards
removes the page, not the copies. So the question this skill answers is never "can I render
this?" — it is "am I willing for this to be permanent?"

`wiki-memory` owns writing notes into the vault. This skill owns the boundary out of it.

## The source never moves

The published page is a rendering of a vault note. It is not a copy, and it is not an export
that then lives its own life. One fact, one file: a page that has drifted from its note is a bug
in the renderer, not a second version to reconcile.

That is also why editing on the site writes back through a branch and a pull request, landing
through `npm run gate` like any other change. The site is an editor over the vault, not a
database beside it.

## What may be published

| Note type | Default | Why |
|---|---|---|
| reference, runbook | publishable | Written to be read by someone else already. |
| decision (ADR) | publishable | The reasoning is the value, and it is already impersonal. |
| lesson | publishable after a read | Often names a machine, a path or a tool version. |
| research | publishable | The trends digest is built from these. |
| session | **not** by default | Records conversation, environment and half-formed judgement. |
| issue | **not** by default | Carries reproduction detail: paths, hostnames, versions. |

A default is not a permission. Every path published for the first time needs the owner's
authorization; after that, updates to that path reuse it.

## The redaction pass

Run this on the rendered output, not the source. A renderer can introduce a path or a name that
the note never contained.

1. **Secrets** — tokens, keys, passwords, passphrases. Any hit stops publication and is rotated,
   not edited out: it was in a file, and the file has history.
2. **Identity** — email addresses, real names of third parties, account handles.
3. **Machine shape** — hostnames, LAN addresses, absolute paths containing a username.
   `/home/<user>/Github/Zimi` is the common one; publish repository-relative paths.
4. **Unsettled decisions** — a map's open decisions and a plan's rejected options are working
   material. Publishing a proposal reads to an outsider as a commitment.
5. **Other people's words** — a quoted message from someone who did not expect a public page.

`wiki-memory`'s redaction rules are the floor here, not the ceiling: they keep the vault clean
for people who already have the repository, and this audience does not.

## Rendering

- Keep the note's own headings. A reader arriving from the vault should recognise the page.
- Resolve `[[wikilinks]]` to published pages, or render them as plain text. A link to a page you
  did not publish is a dead end that leaks the unpublished title.
- Carry the `updated` date onto the page. Undated content on a trends path is worthless.
- State that the page is generated and name its source note.

## Before it goes live

- The redaction pass ran on the rendered output, and you say so.
- The owner authorized this path, or it was authorized earlier.
- Every published link resolves.
- The owning work record carries the publication as evidence.

If any one of these is unresolved, the page does not go out. There is no version of this that is
fixed afterwards.

Repository integration: [AGENTS.md](../../../AGENTS.md#local-integration-for-the-skills).
