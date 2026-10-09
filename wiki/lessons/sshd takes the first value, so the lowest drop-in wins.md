---
type: lesson
title: sshd takes the first value, so the lowest drop-in wins
summary: A cloud server image allowed SSH password login because a lower-numbered sshd drop-in set it first; sshd keeps the first value it reads, not the last.
tags: [area/auth, tool/ssh, kind/pitfall]
created: 2026-09-21
updated: 2026-10-09
agent: claude-code
status: active
---

## What happened

A freshly provisioned cloud server was serving SSH with `PasswordAuthentication yes`, although the
image's own settings file set it to `no`. Both files existed:

```
/etc/ssh/sshd_config.d/50-cloud-init.conf        PasswordAuthentication yes
/etc/ssh/sshd_config.d/60-cloudimg-settings.conf PasswordAuthentication no
```

Most configuration formats let a later file override an earlier one. **sshd does the opposite: it
takes the first value it obtains for a keyword and ignores every later one.** The drop-ins are read
in alphabetical order, so `50-cloud-init.conf` won and `60-cloudimg-settings.conf` never applied.
The image intended a hardened default and did not get one.

The cost is not theoretical. The machine was reachable from the internet with root password
authentication from the moment it was created, and nothing in the provider's dashboard or the
image's configuration said so. Reading `sshd_config` alone would not have revealed it either,
because the relevant lines are in files it includes.

## Fix

Ask the running daemon what it actually uses, rather than reading the files:

```bash
sshd -T | grep -E "^(passwordauthentication|permitrootlogin|pubkeyauthentication)"
```

To change a setting, add a drop-in that sorts **before** the existing ones, not after:

```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
sshd -t && systemctl reload ssh
```

`sshd -t` validates before anything is reloaded. Never reload an unvalidated SSH configuration on a
remote machine.

## How to apply

Prove key authentication works **before** disabling passwords, and prove the refusal afterwards
from a second connection, keeping the first one open:

```bash
ssh -o BatchMode=yes <host> 'whoami'                                    # must succeed
ssh -o PubkeyAuthentication=no -o BatchMode=yes <host> true 2>&1 | tail -1
```

Judge the second command by the methods the server lists, not by the refusal: `BatchMode` turns
off every prompt, so it is refused either way. `Permission denied (publickey).` means password
login is off; `password` or `keyboard-interactive` in that list means it is still on. Zimi's
version of this check used the refusal alone and so could never fail. `sudo sshd -T | grep -i
passwordauthentication` on the server remains the authoritative answer.

The general rule: a configuration file states an intention, and only the running process states
the fact. Where the two can disagree, ask the process. The same reasoning applies to a firewall, a
container's published ports, and a certificate's expiry.

Ported from Zimi `wiki/lessons/sshd takes the first value, so the lowest drop-in wins.md` at 9fb36b2.
