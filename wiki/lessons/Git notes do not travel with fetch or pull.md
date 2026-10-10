---
type: lesson
title: Git notes do not travel with fetch or pull
summary: Clone, fetch and pull skip the notes refs, so evidence kept in git notes looks missing in other clones; Zeemrepo keeps review and CI evidence on GitHub instead.
tags: [area/git, area/agents, kind/pitfall]
created: 2026-10-06
updated: 2026-10-10
agent: claude-code
status: active
related: ["[[Merge gate contract]]", "[[ADR-0008 Owner merges pull requests on GitHub]]"]
---

## What happened

In an earlier repository, every landing on `main` carried its review record and check result as git notes. A
clone whose `main` matched `origin/main` failed its audit:

```text
audit: 5 of 32 commit(s) landed without valid evidence.
```

The five merges had landed from another checkout, and origin held their evidence. Git's default
fetch refspec is `+refs/heads/*:refs/remotes/origin/*`, so `git pull` brought in the merges but
not the notes refs. The audit read only local notes, and the documented confirmation step
(fetch, then audit) never updated them either. It only passed in the checkout that wrote the
evidence, which is why nobody noticed.

That repository's local merge command had the same blind spot. From a clone whose notes were behind
origin's, it pushed `main` and then had its notes push rejected as a non-fast-forward. A
regression test reproduced this before the fix.

## Fix

In that repository, the merge command learned to merge origin's notes into the local refs before reading
the review record, and the audit's `missing` verdict was changed to name the notes fetch that
rules out stale local evidence.

Zeemrepo dropped git-notes evidence altogether. A change lands only by pull request, merged by
the owner on GitHub ([[ADR-0008 Owner merges pull requests on GitHub]]). The review is a PR
review comment, and the check result is the CI status checks `check` and `guards`; GitHub holds
both, so every clone sees the same record. `npm run audit` (`scripts/git/landing-audit.ts`)
asks GitHub whether each first-parent commit on `origin/main` is a merged pull request, and
reads no notes.

## How to apply

Any state kept in git notes, or on another ref outside `refs/heads` and `refs/tags`, has to be
fetched by name: a plain clone, fetch or pull never brings it. Before trusting a result that
reads such a ref, compare the local ref with `git ls-remote origin <ref>`. A "missing" verdict
from a clone that did not write the data usually means the clone is behind, not that the data
was never written.

When choosing where to keep evidence that other clones or CI must read, prefer a place every
reader already fetches or queries (the commit history, or the hosting service's record) over a
side ref.
