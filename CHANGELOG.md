# Changelog

Every branch adds its own entry here, under a `## YYYY-MM-DD` heading dated between the day it
started and the day it lands (UTC). Entries describe the change; they never cite
facts that only exist after the owner merges. `npm run changelog:guard` enforces this.

## 2026-10-09

- Added the change-record guards: `changelog:guard` (this file), `memory:guard` (an owning work record with labelled evidence, and an operating document for workflow changes) and `governance:check` (no declared surface, code included, asserts a rule the migration replaced). All three run in `npm run check` and share one exemption list in `scripts/lib/change-policy.ts`.
- Started this changelog at the repository root, so a code branch records its entry without a separate wiki commit.
- Hardened the guards after ECC review: entries are judged by position, work-record evidence and status must change on the same record's frontmatter, untracked files count as changes, and governance alignment scans every text file except named, reasoned exclusions, matching claims across line wraps and look-alike characters.
- Fixed bugs found by an independent bug hunt: a clean merge of main no longer fails `wiki:compliance` (merges are judged by `--remerge-diff`, git 2.36+); version pins such as `pkg@1.2.3` are no longer flagged as emails, and the email scan is linear on long lines; staged secrets in files deleted from disk are scanned; root `license-*` scripts count as workflow-critical; renamed work records keep their evidence history; the change guards work from a subdirectory and see an unstaged new changelog.

- Added the landing path: git hooks (`branch-guard` refuses commits on main, pushes to main, rewrites and unlanded deletions), `npm run pr` (checks, pushes the branch and opens its pull request; never merges), `npm run audit` (every commit on main since the PR-only rule is a merged pull request), `npm run worktree:guard`, a `check` CI workflow that runs the guards from main's copy, and Claude Code deny rules for merging and pushing main.
- Hardened the landing path after ECC security review: CI splits into `guards` (main's guards on `pull_request_target`, read-only, never running the change's code) and `check` (the change's own `npm run check`); a Claude Code PreToolUse hook refuses commands that would merge a pull request; the ECC marketplace is pinned to the v2.2.3 tag; Dependabot proposes weekly action updates; `npm run pr` streams the check, checks `gh` before pushing and does not repeat the check in pre-push.
- Closed pre-merge audit gaps: the merge-blocking hook no longer blocks commits or PR bodies that only mention merging and catches wrapped forms; Dependabot PRs skip only the change-record guards; `npm run pr` warns when git hooks are not installed; README rewritten for the migrated repository.
- Added the operating rules: a lean `CLAUDE.md`, seven rule files in `.claude/rules/zeem/` distilled from Zimi's rules with each ECC override stated (record in `docs/migration/rules-distill.md`), and read-only `finder` and `verifier` agents.
- Ported Zimi's durable wiki knowledge: eight decisions (ADR-0021 rewritten without the stale bare-root premise, ADR-0008 now owner-merged pull requests) plus ADR-0024 "Claude Code is the only harness", 23 lessons, and the Idea to execution, Merge gate contract, Skill standards, Maintain the repository wiki and Verify a repository change pages. `governance:check` now also refuses the bare-root premise and agent self-merging.
