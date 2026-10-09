---
name: resolve-conflicts
description: "Resolve an in-progress merge or a conflicted stash apply from each side's intent, then run the gates and finish."
---

Adapted 2026-09-18 from mattpocock/skills@3cca18b `skills/engineering/resolving-merge-conflicts`
(MIT, Copyright (c) 2026 Matt Pocock).

**Local deviations:**

- This repository merges; it does not rebase published history. If a rebase is in progress,
  stop and tell the owner.
- The project check is `npm run check`. Stage the files you resolved by name, never `git add -A`.

Load this when `git status` shows unmerged paths. A conflict is two intentions meeting in one
place. Resolve the intentions, not the text.

1. **See the state.** `git status`, `git diff --name-only --diff-filter=U`, and
   `git log --merge --oneline` for the commits on each side that touched the conflicted files.
   Confirm you are on a feature branch, never `main`.
2. **Find the primary sources for each side.** Read the commit messages, then the pull request,
   the card or ticket, and the ADR or plan they cite. Know why each change was made before you
   touch a hunk. Do not take the longer side, the newer side, or your own side by default.
3. **Resolve each hunk.** Keep both intents where they can coexist. Where they cannot, keep the
   one that matches the stated goal of this merge, and write the trade-off in the merge commit
   body. Do **not** invent behaviour that neither side had. A generated file is regenerated from its source, never hand-merged. Confirm that the source and generator exist; for example, resolve package.json by intent, then regenerate package-lock.json with `npm install`.
4. **Run the gates.** `npm run check`. Fix what the merge broke; a failure that exists on `main`
   as well is reported, not fixed here.
5. **Finish.** Stage each resolved file by name and finish the authorized operation on its feature branch; only the owner merges to main on GitHub. Always resolve; never
   `git merge --abort` to escape a hard conflict. If the two intents truly cannot be reconciled,
   stop with the merge in progress and ask the owner, quoting both sources.
