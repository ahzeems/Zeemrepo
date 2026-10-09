---
type: reference
title: Memory index
summary: Index of every memory note in the wiki, with a one-line summary each, grouped by type.
tags: [area/wiki, kind/overview]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: active
---

One line per memory note. Add new notes here; work notes need no entry.

## Decisions

- [[ADR-0001 Wiki is an Obsidian vault in the repository]] - Project memory is an Obsidian vault in wiki/ inside the repo, as plain Markdown with typed folders, YAML frontmatter and an enforced tag list.
- [[ADR-0005 Work records live in the shared vault]] - Use linked vault records and native Bases to track idea-to-execution work alongside durable agent memory.
- [[ADR-0007 Changelog entries carry no post-merge facts]] - Entries record the change in their own PR and never cite a merge commit, removing the closeout PR.
- [[ADR-0008 Owner merges pull requests on GitHub]] - Nothing is pushed to main; every change lands by pull request, agents push a branch and open the PR, and only the owner merges on GitHub.
- [[ADR-0009 Workflow-critical Markdown is an interface]] - Documents that declare how work is landed, reviewed, and verified are part of the interface; drift between them and the code is a Blocker and is checked mechanically.
- [[ADR-0011 The vault is the interface, Obsidian is optional]] - The repository wiki is the source of truth for documentation and memory; no editor is part of the architecture, and the Windows UNC route failed validation.
- [[ADR-0021 Authority comes from an identified checkout]] - Instructions, skills and the vault come from a checkout the agent has identified (path, worktree, branch, HEAD, clean state); parallel sessions use separate worktrees.
- [[ADR-0022 Independent review means a separate reviewer context]] - A review is independent when a separate reviewer context inspects pinned sources and runs its own checks; the reviewer's model and who launched it do not decide independence.
- [[ADR-0024 Claude Code is the only harness]] - Zeemrepo targets Claude Code alone, with the pinned ECC plugin, rules in CLAUDE.md and .claude/rules/, and native user-only skills.

## Lessons

- [[A passing memory guard does not prove current content]] - memory:guard proves a branch updated a work record and an operating document; it does not prove the wiki is accurate, current, or read from the right checkout.
- [[A refused commit leaves its staging behind]] - A commit refused by pre-commit kept code files staged; the retry added wiki files and committed the whole index, mixing the two. pre-commit now checks the staged paths.
- [[A rule built from the environment needs testing in that environment]] - A redaction rule derived the account name serving a page; in a container that name was node, so every page was withheld while every test passed.
- [[Agents cannot enter a sudo password]] - An agent cannot type a sudo password, so setup that needs root must be split into a small root step for the human and a user step for the agent.
- [[An account-scoped API permission needs an account resource]] - Cloudflare API writes kept failing because the token had only a zone resource, so its account-level permissions applied to nothing however often they were added.
- [[An advisory check cannot stop a commit]] - An ad-hoc check that printed its result and exited 0, chained before git commit, could not stop the commit. What it measured, line width, is not a repository rule.
- [[Bare worktree records are not checkouts]] - Parse git worktree porcelain as whole records and keep the bare attribute before running working-tree commands on each entry.
- [[Documentation checkers need counterexamples]] - A checker tested only on current prose can pass negated claims or reject valid prohibitions; replay both broken and valid documents through the real checker.
- [[Fine-grained tokens cannot upload SSH keys]] - gh auth login with a pasted fine-grained token fails with HTTP 403 on /user/keys; log in through the browser with the admin:public_key scope instead.
- [[Git hooks route child Git commands to the hooked repository]] - Tests that spawn git inherit a hook's GIT_DIR and GIT_INDEX_FILE, so under a hook their fixture commands act on the real repository.
- [[Git notes do not travel with fetch or pull]] - Clone, fetch and pull skip the notes refs, so evidence kept in git notes looks missing in other clones; Zeemrepo keeps review and CI evidence on GitHub instead.
- [[Passphrase-protected SSH keys block agent pushes]] - An agent cannot type an SSH key passphrase, so git push over SSH fails; push over HTTPS with the gh credential helper and leave the remote on SSH.
- [[Placeholder values get copied literally]] - A user ran an example command as written and set their git name to the literal text 'Your Name'; give placeholders that cannot be mistaken for values.
- [[Prose rules do not enforce themselves]] - A repository rule written only in a skill was broken by the agent that had not yet loaded the skill; only a check running in the canonical path stopped it.
- [[Redaction checks must cover code, not only notes]] - The vault linter scanned notes, skills and three root documents, so a username or hostname committed in a script passed; the scan must cover everything the repository publishes.
- [[Root shell hides user-installed tools]] - In a root shell, gh is 'command not found', ~ points to /root and git over SSH is denied, because the tools and SSH keys belong to the normal user.
- [[Skill integration must preserve the method]] - Adapting imported skills to local style changed their methods; keep source wording and review each interface substitution separately from the method.
- [[Skill restoration needs source comparison]] - A valid skill entry point can still lose the original method and its companion files; compare the full supplied source before accepting a restoration.
- [[sshd takes the first value, so the lowest drop-in wins]] - A cloud server image allowed SSH password login because a lower-numbered sshd drop-in set it first; sshd keeps the first value it reads, not the last.
- [[Test commands must discover actual tests]] - Passing a compiled directory to the Node test runner launched its index rather than the test files on Node 22.23.2; exit status alone hid the missing coverage.
- [[Walkthroughs should not duplicate skill rules]] - A skill walkthrough grew by copying its matrix and repeating examples; link to the files that own the rules and keep one example per route.
- [[Wiki frontmatter must accept Windows line endings]] - The wiki linter must normalize CRLF before parsing frontmatter so valid notes pass on Windows and WSL checkouts.
- [[Wiki validation needs parsed metadata]] - A line-based frontmatter parser accepted malformed metadata because it checked strings without parsing YAML.

## Runbooks

- [[Land a change]] - Take work from a feature branch to an owner-merged pull request; nothing is ever pushed to main.
- [[Maintain the repository wiki]] - Keep wiki explanations, work records, the Memory index and CHANGELOG.md current in the same branch as the change, and commit wiki files alone.
- [[Verify a repository change]] - Run npm run check and the hooks, review read-only with separate reviewer subagents, and record evidence before opening a pull request.

## Reference

- [[Change records]] - What every branch must record before it lands, which guard checks it, and how to satisfy each.
- [[Idea to execution]] - The path from an idea through a map, an owner-approved plan, build tickets and pull requests, with the skill and record at each step.
- [[Merge gate contract]] - The merge gate is GitHub: the protect-main ruleset, the required check and guards workflows, the local backstops, and the read-only landing audit.
- [[Skill standards]] - What npm run skills:lint enforces on .claude/skills (limits, user-only list, provenance hashes, citations, em dashes) and what stays convention.

## Sessions
