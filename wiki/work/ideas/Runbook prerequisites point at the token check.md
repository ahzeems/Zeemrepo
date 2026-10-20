---
type: idea
title: Runbook prerequisites point at the token check
summary: The Sandcastle runbook's Prerequisites now tell the reader to run the Token setup check before the first loop on a new token, and why the throwaway comment is the part that proves write access.
tags: [area/agents, area/github, tool/claude-code]
created: 2026-10-16
updated: 2026-10-18
agent: claude-code
status: done
owner: human
priority: P3
next_action: None. It landed in PR 14 (616a4ea). Since PR 46 the runbook's read check is step 5 and the throwaway comment is step 6, and the Prerequisites bullet names both.
related: ["[[Run Sandcastle on GitHub issues]]", "[[Sandcastle token setup lessons]]"]
evidence:
  - "VERIFIED: the Prerequisites section of wiki/runbooks/Run Sandcastle on GitHub issues.md now carries one bullet after the GH_TOKEN bullet pointing at Token setup step 5, read on 2026-10-16."
  - "VERIFIED: npm run wiki:lint passed on 2026-10-16 after the edit and after the rewording that followed review."
  - "INFERRED: a token that reads but cannot write answers 403 only on the write, so the failure lands after the agents run, from the 403 troubleshooting entry and the Token setup notes in the same runbook."
  - "VERIFIED: a finder agent in a separate context read the first head and found that the step 5 command only reads, so only the throwaway comment tests write access; the bullet and this record were reworded to say so."
  - "VERIFIED: on 2026-10-18 gh pr list --state merged --search e957c16 and --search 0b07bda both return PR 14, merged as 616a4ea, and both commits are on main (checked by Claude Code, Opus 5.5)."
  - "VERIFIED: on main at caa99e3 the Prerequisites bullet in wiki/runbooks/Run Sandcastle on GitHub issues.md (line 83) reads: run the read check from Token setup (step 5) and, with the owner's approval of the comment, its write check (step 6). The step 5 named above is the 2026-10-16 numbering, which S26 (PR 46) split into steps 5 and 6."
---

## Problem

The GH_TOKEN bullet in the runbook's Prerequisites named the "Token setup" check but did not say
why running it before the first loop matters. A fine-grained token with Issues read but not write
reads issues fine, so the planner and implementer succeed; it refuses only when an agent comments,
after the agents have already done their work. The step 5 command only reads, so the throwaway
comment in that step is what proves write access.

## Desired outcome

A reader setting up a new token runs the check first, throwaway comment included, and catches a
read-only token before a run, with the reason stated in one plain bullet that links to "Token
setup" instead of copying its steps.

## Next step

None. The bullet landed in PR 14; S26 later renumbered the steps it names.

## Observations

- [no-doc-change: this change is the runbook edit itself; no script or guard changes]
- Prevention: none. This is prose in a runbook, not an enforceable behaviour; wiki:lint checks the
  note's structure and evidence labels, not that the bullet says what it should.
