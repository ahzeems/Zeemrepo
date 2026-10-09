---
type: lesson
title: Passphrase-protected SSH keys block agent pushes
summary: An agent cannot type an SSH key passphrase, so git push over SSH fails; push over HTTPS with the gh credential helper and leave the remote on SSH.
tags: [area/git, area/agents, tool/ssh, tool/gh, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Fine-grained tokens cannot upload SSH keys]]", "[[Root shell hides user-installed tools]]"]
---

## What happened

The user protected their SSH key with a passphrase, which is good practice, and the repository
remote uses SSH. A non-interactive test from the agent failed, because nothing can answer the
passphrase prompt:

```
$ ssh -o BatchMode=yes -T git@github.com
git@github.com: Permission denied (publickey).
```

This is also exactly what a missing key looks like, so on its own it proves nothing about whether
the key is on GitHub.

## Fix

Use the GitHub CLI login for a one-off HTTPS push, without changing the remote or any global git
config. In Zeemrepo an agent pushes its own branch, never main:

```bash
git -c credential.helper='!gh auth git-credential' push https://github.com/<owner>/<repo>.git <branch>
```

The same form works for `fetch`, `clone` and `pull`. After pushing to a URL instead of the named
remote, the local tracking ref is stale. Refresh it with a fetch through the same helper, or,
when that is also blocked:

```bash
git update-ref refs/remotes/origin/<branch> <branch>
```

## How to apply

- Before the first push in a session, check whether SSH works non-interactively. If it does not,
  use the HTTPS form above.
- Tell the user their own pushes will still ask for the passphrase, and that the agent has not
  tested that path.
- Verify a key upload with `gh ssh-key list`, not with an SSH connection test.
- If the user wants SSH to work for agents, the answer is an SSH agent holding the unlocked key
  for the session. That is the user's choice to make.

Ported from Zimi `wiki/lessons/Passphrase-protected SSH keys block agent pushes.md` at 9fb36b2.
