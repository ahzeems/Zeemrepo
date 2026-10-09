---
type: lesson
title: Passphrase-protected SSH keys block agent pushes
summary: An agent cannot type an SSH key passphrase, so git push over SSH fails; use an HTTPS remote with the gh credential helper, as Zeemrepo's origin does.
tags: [area/git, area/agents, tool/ssh, tool/gh, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Fine-grained tokens cannot upload SSH keys]]", "[[Root shell hides user-installed tools]]"]
---

## What happened

In Zimi, the user protected their SSH key with a passphrase, which is good practice, and the
repository remote used SSH. A non-interactive test from the agent failed, because nothing can answer the
passphrase prompt:

```
$ ssh -o BatchMode=yes -T git@github.com
git@github.com: Permission denied (publickey).
```

This is also exactly what a missing key looks like, so on its own it proves nothing about whether
the key is on GitHub.

## Fix

Push over HTTPS with the GitHub CLI's credential helper. Zeemrepo's `origin` is an HTTPS URL,
and `gh auth setup-git` makes `gh auth git-credential` git's helper for github.com, so
`npm run pr` pushes without any key prompt. Check with `git remote -v` and
`git config --get-urlmatch credential.helper https://github.com`.

For a checkout whose remote must stay on SSH, Zimi used a one-off HTTPS push that changes neither
the remote nor global config. It is a raw push, so in Zeemrepo use it only for your own branch,
never main, and prefer switching the remote to HTTPS so `npm run pr` works:

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

- Before the first push in a session, check the remote's protocol. With an SSH remote, check
  whether SSH works non-interactively; if it does not, use HTTPS as above.
- Tell the user their own pushes will still ask for the passphrase, and that the agent has not
  tested that path.
- Verify a key upload with `gh ssh-key list`, not with an SSH connection test.
- If the user wants SSH to work for agents, the answer is an SSH agent holding the unlocked key
  for the session. That is the user's choice to make.

Ported from Zimi `wiki/lessons/Passphrase-protected SSH keys block agent pushes.md` at 9fb36b2.
