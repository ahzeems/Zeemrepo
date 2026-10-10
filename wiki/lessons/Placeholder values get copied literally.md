---
type: lesson
title: Placeholder values get copied literally
summary: A user ran an example command as written and set their git name to the literal text 'Your Name'; give placeholders that cannot be mistaken for values.
tags: [area/git, area/docs, kind/pitfall]
created: 2026-09-20
updated: 2026-10-10
agent: claude-code
status: active
---

## What happened

The agent showed this example for setting the git identity:

```bash
git config --global user.name "Your Name"
```

The user ran it unchanged, then correctly set only the email. The git name became the literal
string `Your Name`. The agent noticed only because it re-checked the config before the first
commit. Without that check, the placeholder would have been written into the repository's history.

## Fix

The agent set the name to the user's public GitHub handle as a stand-in, told them, and gave the
command to change it.

## How to apply

- Write placeholders so they fail loudly or look obviously wrong: `<your-name>` in angle brackets,
  not a plausible value in quotes.
- Better, fill in the real value when it is known, or fetch it, for example from `gh api user`.
- Read back identity and config values before they become permanent. A commit author cannot be
  changed without rewriting history, and in Zeemrepo a pushed branch is already visible in a pull
  request.
- The same applies to wiki notes: use `<user>`, `<host>` and `<repo>` style placeholders.
