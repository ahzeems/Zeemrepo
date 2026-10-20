---
type: issue
title: Editor swap files trip the pre-push state check
summary: A Vim or Emacs swap, backup or autosave file written while the pre-push check runs appears as a new untracked file, so git-state refuses the push as if a test had changed the tree.
tags: [area/git, kind/pitfall]
created: 2026-10-17
updated: 2026-10-17
agent: claude-code
status: done
owner: human
priority: P3
issue_kind: environment
next_action: None. Another editor's temporary file, a Vim swap file named outside .swa to .swp (Vim counts down from .swp, then .swo, .swn, while earlier ones exist), or Vim's short-lived 4913 write probe if it exists at a snapshot, still causes a refusal; record it here if one is seen.
root_cause: git-state compares every path git status lists, and an editor's swap, backup or autosave file is an untracked path that the editor, not the check, creates or rewrites between the two snapshots.
fix_ref: https://github.com/Zimfra/software_testing/pull/31
regression_evidence: Before the fix, the git-state.test.ts cases writing .tracked.txt.swp, .tracked.txt.swo, tracked.txt~, #tracked.txt# and .#tracked.txt during the check under this repository's .gitignore failed with EXIT_REFUSED; after it all five pass, and tracked.swp, .tracked.txt.swq, a#b.txt, a~b.txt, a.#b.txt and notes.txt are still refused.
prevention: git-state.test.ts reads the repository's own .gitignore, so dropping any of the four patterns fails npm test.
idea: "[[Execute the repository audit remediation]]"
project: "[[Repository audit remediation]]"
related: ["[[S04 Content-sensitive working-state snapshots]]", "[[Merge gate contract]]"]
evidence:
  - "VERIFIED: an independent finder on S04 noted that an editor saving during the check causes a refusal; S04's refusal message names editors as well as tests."
  - "OWNER DECISION: on 2026-10-17 the owner chose \"Ignore them in .gitignore (Recommended)\" for editor swap and autosave files, in a separate pull request, so git-state keeps no special case."
  - "VERIFIED: the five editor-file cases in scripts/git/git-state.test.ts failed (7 failing entries counting parents) before .gitignore changed; after it, node --test scripts/git/git-state.test.ts passed 53 of 53 (56 of 56 once three more look-alikes were added after review)."
  - "VERIFIED: removing each pattern in turn from .gitignore made 3 or 4 test entries fail, so every pattern is pinned; git ls-files -ci --exclude-standard lists no tracked file that the new patterns ignore."
  - "UNKNOWN: no live push has been refused for an editor file; the reproduction is the fixture test."
---

## Reproduction

With a file open in Vim or Emacs, save it while `git push` runs the pre-push check. The editor
writes `.<name>.swp`, `<name>~`, `#<name>#` or `.#<name>` beside the file between the two
`git-state` snapshots, and `git-state verify` refuses because the working tree changed.

## Expected and actual

Expected: the push passes when no test changed the tree. Actual: the editor's file is a new
untracked path, and the push is refused.

## Root cause

`git-state` snapshots every path `git status` lists and leaves ignored files out. Editor swap,
backup and autosave files were not ignored.

## Fix

`.gitignore` ignores `.*.sw[a-p]` (Vim swap), `*~` (backup), `#*#` (Emacs autosave) and `.#*`
(Emacs lock), as the owner decided. `git-state` itself is unchanged.

## Verification

The fixture cases failed before the patterns were added and pass after; removing any one pattern
makes a case fail again.

## Prevention

`scripts/git/git-state.test.ts` copies the repository's `.gitignore` into each fixture, so the
patterns and the look-alikes that must still be seen stay pinned in `npm test`.
