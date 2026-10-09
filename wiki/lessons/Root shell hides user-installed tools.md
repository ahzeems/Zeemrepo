---
type: lesson
title: Root shell hides user-installed tools
summary: In a root shell, gh is 'command not found', ~ points to /root and git over SSH is denied, because the tools and SSH keys belong to the normal user.
tags: [area/shell, tool/gh, tool/ssh, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Agents cannot enter a sudo password]]", "[[Passphrase-protected SSH keys block agent pushes]]"]
---

## What happened

The user ran commands in a root shell several times and got errors like these, even though the
tools were installed and working:

```
root@<host>:/home/<user># gh auth login
Command 'gh' not found, but can be installed with:
snap install gh
apt  install gh
```

```
root@<host>:/home/<user># ~/setup-dev-env.sh
bash: /root/setup-dev-env.sh: No such file or directory
```

The tools (the package manager and the agent CLIs) were installed per user. Root has a different
PATH and a different home, so `~` means `/root`. The working directory being the user's home made
it look like the right place. The root shell came from how the terminal was launched, not from
the system's default user.

The same cause breaks git over SSH. After `sudo su`, `git pull` in the user's repository failed:

```
root@<host>:/home/<user>/<repo># git pull
git@github.com: Permission denied (publickey).
```

SSH looks for keys in `/root/.ssh`, not in the user's `~/.ssh`. Root also had its own key pair
that was never added to GitHub, so its fingerprint did not match the one on the GitHub settings
page, which looked like a broken key setup.

## Fix

Leave the root shell with `exit`, or switch user:

```bash
su - <user>
```

Do not accept the `apt install` or `snap install` suggestion. It adds a second, often older copy
for root and hides the real problem.

## How to apply

- When a tool that is known to be installed is "not found", read the prompt first. `root@` and a
  `#` mean the wrong user.
- Agents: when giving a user a command, say which user it must run as. When the user pastes
  output, check the prompt before diagnosing anything else.
- `Permission denied (publickey)` at a `root@` prompt is the same trap. Do not add root's key to
  GitHub. Exit and run git as the normal user.
- Running git as root inside the user's repository can leave root-owned files in `.git/`. Check
  with `find . -user root` afterwards.
- Some user-level package managers refuse to run as root by design; root is never the right place
  for a per-user toolchain.

Ported from Zimi `wiki/lessons/Root shell hides user-installed tools.md` at 9fb36b2.
