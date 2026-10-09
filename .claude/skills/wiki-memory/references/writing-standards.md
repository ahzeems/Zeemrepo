# Writing standards

## Style

- Lead with the point. The first body sentence should be useful on its own.
- One idea per note. Link to other notes with `[[Note title]]` instead of repeating them.
- Write for a reader with no memory of the session: a new agent, or the user six months from now. No "as discussed", no "the earlier fix".
- State facts and outcomes. Say what was verified and how. Say plainly what was not verified.
- Commands and error text go in fenced code blocks, copied exactly. Prose describes, code blocks show.
- Use absolute dates, `2026-09-19`, never "yesterday".
- Use placeholders for anything user-specific: `<user>`, `<host>`, `<email>`, `<repo>`. Public names that are already on GitHub, such as the repo owner and repo name, are fine.
- File names are the note title, in plain words with spaces. Avoid these characters: `/ \ : * ? " < > | # ^ [ ]`.

## Redaction checklist

Run this before every commit that touches `wiki/`. The repository is public, and git history is permanent.

Never write:

1. Tokens, API keys, passwords, passphrases, one-time codes.
2. Private keys. Public SSH keys are also left out, since they add nothing.
3. Email addresses.
4. Machine hostnames.
5. Paths containing a username. Write `~/repo` or `/home/<user>/repo`, never the real home path. The same goes for Windows paths under `C:\Users\` or `/mnt/c/Users/`.
6. Contents of `.env` files or credential stores.

If a command from the session contained one of these, replace the value with a placeholder and keep the rest of the command.

`npm run wiki:lint` scans every file the repository would publish (everything git tracks or would add, not only
`wiki/`) for common patterns: email addresses outside public and example domains, cloud and GitHub tokens, keys,
JWTs, and home paths on Linux, macOS and Windows. It is a net, not a guarantee. You are responsible for reading
what you wrote.

## Links as memory

Keep Home and overview pages focused on repository operation, skills, workflow, and memory.
Use quoted internal links for work ownership and real dependencies. Add a memory-to-work
link only when it helps retrieval; do not repeat metadata links throughout prose or add
broad related lists. General guidance belongs to the repo, not to every project.
Follow the source and check its date before relying on it. Graph proximity does not
prove accuracy or grant authority. Preserve historical bodies and update current guidance.

## Diagrams

Use a diagram only when a reader needs to see relationships, ordered exchanges or branches;
otherwise a short paragraph or table is better.

- Answer one question per diagram: a flowchart for stages and branches, a sequence diagram for
  ordered exchanges, a relationship diagram for components and stores. Split a crowded one.
- Write a fenced `mermaid` block in the note that owns the explanation, with short quoted labels
  and real repository terms. Update an existing diagram rather than adding a second copy.
- Trace every node and arrow to a cited source. Never draw a proposed, failed or unobserved path
  as a working edge, and do not imply a check runs automatically unless code proves it.
- Add a caption saying what the arrows mean and what the diagram leaves out.
- `npm run wiki:lint` does not validate Mermaid. Report rendering as unverified unless you viewed
  it. Do not install diagram software or add dependencies for this.

## Research notes

A research note (`wiki/work/research/`, sections Question, Sources, Findings, Implications)
records what was learned from outside sources so a reader can check and disagree with it. Gather
with ECC's `deep-research` or `research-ops`; this section is about what gets recorded.

- Fix the question before searching, and search the vault first: update the existing note when
  the question is the same.
- A finding is new or newly settled, has a primary source (release, repository, specification,
  paper, pricing page), and survives "compared to what?". A roundup article or a search snippet
  is a lead, never the source. An announced intention is not a capability; a vendor's benchmark
  of its own product is evidence about the claim, not the product.
- Record each source with its URL, what it is, and the date you read it.
- One source is a report; two independent sources, neither citing the other, make a finding.
- Label each finding `VERIFIED:`, `INFERRED:` or `UNKNOWN:`. A forecast is at most `INFERRED:`.
- Keep contradictions visible: record both sides and say which you believe and why.
- Never record a number without its measurement conditions, or copy a source at length.
- List the sources that failed to load or sat behind a login; the next pass needs to know.
- Implications say what would change here, or explicitly nothing.
