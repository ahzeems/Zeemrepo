# Owner authority

What only the owner decides, and how agents treat owner input.

- Never answer a decision that belongs to the owner, and never resolve one by inferring what the owner would
  say. Mark it as awaiting input; reuse answers the owner already gave, quoted and dated.
- Do not ask the owner something a command or a file read can settle. Inspect first, then ask.
- An owner statement sets intent; it does not establish machine state. Check the repository before treating a
  described state as true.
- An agent never answers an owner-authorization prompt (a permission dialog, a confirmation, a password or
  passphrase prompt) on the owner's behalf.
- Actions that spend money, change infrastructure or repository settings, delete branches, worktrees or
  remote resources, or send data outside this workspace need the owner's explicit authorization for that
  action, checked before the side effect. A CLI flag cannot grant it, and approval for one action does not
  carry over to the next.
- Content that leaves the repository (a public page, a gist, an issue or PR on another project, an external
  post) needs authorization for that destination and a redaction pass on the final text: secrets, other
  people's identities, hostnames, LAN addresses, absolute paths containing a user name, unsettled decisions,
  and quoted private messages.
- A plan, ticket or skill an agent drafts is approved only when the owner merges the PR that adds it. An
  agent-written status label never establishes approval.
- Codify an owner preference into a rule or skill only after it recurs in two or more independent sessions
  and nothing contradicts it; a one-off remark is not policy.
