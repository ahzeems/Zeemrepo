---
type: lesson
title: An advisory check cannot stop a commit
summary: An ad-hoc check that printed its result and exited 0, chained before git commit, could not stop the commit. What it measured, line width, is not a repository rule.
tags: [area/git, area/agents, area/docs, kind/pitfall]
created: 2026-10-07
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[A refused commit leaves its staging behind]]"]
---

## What happened

In an earlier repository on 2026-10-07, one shell command ran an ad-hoc `awk` check, then `npm run wiki:lint`,
then `git commit`. The check reported a line it had been written to flag, and the commit went
ahead as `ec77c62`:

```text
144
wiki-lint: 196 note(s) OK, 22 allowed tags
...
   cdbe057..ec77c62  claude/claude-skill-reader -> claude/claude-skill-reader
```

The check printed and then exited 0. It shared a command chain with the commit, so whatever it
found, the commit followed. It also measured diff lines, counting the leading `+`, so it
reported 144 for a 143-character line. On another branch a related gap showed: the check ran
clean, then text was added and committed without running it again. That is a check run too
early, not one run in a way that cannot gate.

What the check measured was line width, and the repository had no line-width rule, and the owner
declined to add one on 2026-10-07. So a long line was not a defect, and reviewers who flagged
lines as overlong were applying a convention, not a rule. The lesson is about the check, not
about what it measured.

## Fix

No check was added. Chaining an ad-hoc check before `git commit` is a choice made inside one
shell command, which no repository check can see. The repository's own gates already exit
non-zero and stop the work. The cost was friction: commits went ahead carrying text the check
had reported, so the report was seen only later, in review, where each change moved the head and
cost another review pass.

In Zeemrepo the gates that can stop work are `.githooks/pre-commit` (branch guard, staged wiki
compliance, lint, typecheck, wiki and skill lint), `.githooks/pre-push` (`npm run check`), and
the CI status checks `check` and `guards` that the pull request needs before the owner can
merge. Zeemrepo also sets no line-width rule for prose.

## How to apply

A check that is meant to stop a commit has to exit non-zero and run before the commit, in its own
step. An ad-hoc check that only prints is a note to read, not a gate: read its output before
committing, or do not chain the commit after it. It covers only the text that existed when it
ran. Where the repository has no rule, say so rather than treating a convention as one.
