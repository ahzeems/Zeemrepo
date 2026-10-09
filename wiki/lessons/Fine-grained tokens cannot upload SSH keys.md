---
type: lesson
title: Fine-grained tokens cannot upload SSH keys
summary: gh auth login with a pasted fine-grained token fails with HTTP 403 on /user/keys; log in through the browser with the admin:public_key scope instead.
tags: [area/github, area/auth, tool/gh, tool/ssh, kind/pitfall]
created: 2026-09-20
updated: 2026-10-09
agent: claude-code
status: active
related: ["[[Passphrase-protected SSH keys block agent pushes]]"]
---

## What happened

The user ran `gh auth login`, chose SSH, generated a new key, and chose "Paste an authentication
token". The token was a fine-grained personal access token, recognisable by its `github_pat_`
prefix. Login succeeded, but the key upload failed:

```
HTTP 403: Resource not accessible by personal access token (https://api.github.com/user/keys?per_page=100)
```

The result was a half-working state: logged in, key generated locally, key not on GitHub, so SSH
access was denied. The same token would also have failed to create repositories.

## Fix

Log in again through the browser, which grants the right scopes, and reuse the key that already
exists:

```bash
gh auth login -h github.com -p ssh -w -s admin:public_key
```

Pick the existing public key when asked. The terminal then prints a one-time code and waits. The
login is not complete until the code is entered in the browser and the terminal says so.

## How to apply

- Recommend browser login by default. Use tokens only for automation, and then a classic token
  with `repo`, `read:org` and `admin:public_key`.
- To check whether a login really finished, run `gh auth status`. A browser login shows a token
  starting `gho_` and lists its scopes. A `github_pat_` token means the old login is still active.
- Confirm the key landed with `gh ssh-key list`.
- A pasted token is stored in plain text. After switching to browser login, the user should
  delete the old token on GitHub.

Ported from Zimi `wiki/lessons/Fine-grained tokens cannot upload SSH keys.md` at 9fb36b2.
