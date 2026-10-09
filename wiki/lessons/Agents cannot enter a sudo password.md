---
type: lesson
title: Agents cannot enter a sudo password
summary: An agent cannot type a sudo password, so setup that needs root must be split into a small root step for the human and a user step for the agent.
tags: [area/agents, area/shell, kind/setup, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Root shell hides user-installed tools]]"]
---

## What happened

While bootstrapping a development machine, a package manager's installer needed root once, to
create its install prefix, and the build tools needed system packages that also need root. The
agent's check showed it could not proceed:

```
$ sudo -n true
sudo: a password is required
```

The agent runs non-interactively. Nothing can answer the password prompt, and it should not try.

## Fix

Split the work by privilege instead of looking for a way around the password.

1. The human runs the minimal root commands: install the system packages, create the install
   prefix, and hand the prefix to the normal user with `chown`.
2. The agent does everything else as the normal user. With a writable prefix, most user-level
   installers need no sudo at all.

A setup script can encode this: skip the root step when the required tools are already present
and the prefix is already writable.

## How to apply

- Run `sudo -n true` at the start of any setup task. If it fails, plan the split before
  installing anything.
- Do everything that needs no root first, so progress is not blocked.
- Keep the root step to the fewest commands possible and give them to the human as copy-paste
  blocks, saying which user runs each one.
- Do not bypass the password through another route, such as starting a shell as root from a
  host system. The password prompt is the user's guard.

Ported from Zimi `wiki/lessons/Agents cannot enter a sudo password.md` at 9fb36b2.
