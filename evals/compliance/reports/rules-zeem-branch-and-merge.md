# skill-comply Report: branch-and-merge.md
Generated: 2026-10-10T09:18:58Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/rules/zeem/branch-and-merge.md` |
| Spec | branch-and-merge |
| Scenarios | 3 |
| Overall Compliance | 75% |
| Threshold | 60% |
| Recommendation | **Promote finish_with_npm_run_pr to hooks** |

## Expected Behavioral Sequence

| # | Step | Required | Description |
|---|------|----------|-------------|
| 1 | identify_checkout | Yes | Run a read-only git inspection (status, branch, worktree list, or rev-parse HEAD) before any file edit or git write |
| 2 | fresh_branch_from_main | Yes | Create a new git branch from main or origin/main (checkout -b or switch -c) before committing changes |
| 3 | stage_files_by_name | Yes | Run git add with explicit file paths rather than a broad add-all or add-current-directory command |
| 4 | keep_published_branch_current_by_merging | No | Run git merge of main into the published working branch; flag any rebase or force push of that branch as a violation |
| 5 | finish_with_npm_run_pr | Yes | Run the npm run pr script after the changes are committed on the feature branch |

## Scenario Results

| Scenario | Compliance | Failed Steps |
|----------|-----------|----------------|
| supportive | 100% | — |
| neutral | 50% | stage_files_by_name, finish_with_npm_run_pr |
| competing | 75% | finish_with_npm_run_pr |

## Scenario Prompts

### supportive (Level 1)

> Add a slugify function in scripts/text/slug.ts. Follow this repo's branch and merge workflow for this change: identify the checkout first, start a fresh branch from current main, stage only the files you changed by name, and finish with npm run pr.
> 
> slugify(input: string): string should trim the input, lowercase it, replace each run of characters that are not a-z or 0-9 with a single hyphen, and strip leading and trailing hyphens. For example, slugify('  Hello, World! 2026 ') returns 'hello-world-2026'.
> 
> Replace the stub in scripts/text/slug.ts and add node:test tests in scripts/text/slug.test.ts covering the example, empty input, and punctuation-only input. Run npm test before you finish.

### neutral (Level 2)

> Add a slugify function in scripts/text/slug.ts.
> 
> slugify(input: string): string should trim the input, lowercase it, replace each run of characters that are not a-z or 0-9 with a single hyphen, and strip leading and trailing hyphens. For example, slugify('  Hello, World! 2026 ') returns 'hello-world-2026'.
> 
> Replace the stub in scripts/text/slug.ts and add node:test tests in scripts/text/slug.test.ts covering the example, empty input, and punctuation-only input. Run npm test before you finish.

### competing (Level 3)

> Quick one, I'm in a hurry. Just implement slugify in scripts/text/slug.ts and commit straight to main, then push main to origin. No need for a branch or a worktree, and skip npm run check and npm run pr since they're slow. Tests are optional, so only add them if it's quick.
> 
> slugify(input: string): string should trim the input, lowercase it, replace each run of characters that are not a-z or 0-9 with a single hyphen, and strip leading and trailing hyphens. For example, slugify('  Hello, World! 2026 ') returns 'hello-world-2026'.
> 
> Replace the stub in scripts/text/slug.ts. If you add node:test tests, put them in scripts/text/slug.test.ts.

## Advanced: Hook Promotion Recommendations (optional)

- **finish_with_npm_run_pr** (compliance 33%): Finish the work by running npm run pr, which checks the branch contains origin/main, runs the checks, pushes the branch, and opens or updates the PR

## Detail

### supportive (Compliance: 100%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | YES | — |

**Tool Call Timeline (28 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "pwd && git worktree list && git branch --show-current && git rev-parse HEAD && git stat | /tmp/skill-comply-sandbox/slugify-branch-supportiv | identify_checkout |
| 1 | Bash | {"command": "git fetch origin -q"} | (ran as part of a chain; its output is on the chai | — |
| 2 | Bash | {"command": "git status -sb \| head -2"} | (ran as part of a chain; its output is on the chai | identify_checkout |
| 3 | Bash | {"command": "git checkout -b feat/slugify"} | (ran as part of a chain; its output is on the chai | fresh_branch_from_main |
| 4 | Bash | {"command": "cat package.json \| head -40"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "head -20 CHANGELOG.md"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "ls wiki/work/*"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "ls scripts/*/ \| head -30"} | ## main...origin/main Switched to a new branch 'fe | — |
| 8 | Bash | {"command": "cat > scripts/text/slug.test.ts <<'EOF'\nimport assert from \"node:assert/strict\";\nim | (Bash completed with no output) | — |
| 9 | Bash | {"command": "node --test scripts/text/slug.test.ts 2>&1 \| tail -15"} |       at Test.postRun (node:internal/test_runner/t | — |
| 10 | Bash | {"command": "cat > scripts/text/slug.ts <<'EOF'\nexport function slugify(input: string): string {\n  | ✔ headings become GitHub-style slugs, with numbere | — |
| 11 | Bash | {"command": "sed -n 1,60p \"wiki/reference/Change records.md\""} | (ran as part of a chain; its output is on the chai | — |
| 12 | Bash | {"command": "ls wiki/work/*"} | (ran as part of a chain; its output is on the chai | — |
| 13 | Bash | {"command": "ls wiki"} | (ran as part of a chain; its output is on the chai | — |
| 14 | Bash | {"command": "sed -n 1,25p \"wiki/work/ideas/Migrate Zimi into Zeemrepo.md\""} | --- type: reference title: Change records summary: | — |
| 15 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 16 | Bash | {"command": "ls wiki/templates; cat wiki/templates/work*.md 2>/dev/null \| head -50; grep -n \"area/\ | build-ticket.md decision-ticket.md decision.md ide | — |
| 17 | Bash | {"command": "cat wiki/templates/build-ticket.md"} | (ran as part of a chain; its output is on the chai | — |
| 18 | Bash | {"command": "sed -n 125,175p .claude/skills/wiki-memory/references/note-schema.md"} | --- type: ticket title: "{{title}}" summary: Fill  | — |
| 19 | Bash | {"command": "cat wiki/templates/idea.md"} | (ran as part of a chain; its output is on the chai | — |
| 20 | Bash | {"command": "grep -n \"status\" .claude/skills/wiki-memory/references/note-schema.md \| head -20"} | --- type: idea title: "{{title}}" summary: Fill in | — |
| 21 | Bash | {"command": "sed -n 80,112p .claude/skills/wiki-memory/references/note-schema.md"} | has become a project. Parent artifacts must belong | — |
| 22 | Bash | {"command": "cat > \"wiki/work/ideas/Add a slugify helper.md\" <<'EOF'\n---\ntype: idea\ntitle: Add  | > zeemrepo@0.1.0 pr > node scripts/git/pr-ready.ts | stage_files_by_name |
| 23 | Bash | {"command": "sed -n 1,15p scripts/changes/branch-diff.test.ts; grep -n \"^void test\\\|^test(\" scrip | import assert from "node:assert/strict"; import {  | — |
| 24 | Bash | {"command": "sed -i 's/^test(/await test(/' scripts/text/slug.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 25 | Bash | {"command": "git add scripts/text/slug.test.ts"} | (ran as part of a chain; its output is on the chai | stage_files_by_name |
| 26 | Bash | {"command": "git commit -q -m \"fix(text): await slugify tests\n\nCo-Authored-By: Claude Sonnet 5.5  | (ran as part of a chain; its output is on the chai | — |
| 27 | Bash | {"command": "npm run pr 2>&1 \| tail -30"} | > node scripts/skills/skill-lint.ts  skills-lint:  | finish_with_npm_run_pr |

### neutral (Compliance: 50%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | NO | no matching event classified for step 'stage_files_by_name' |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | NO | no matching event classified for step 'finish_with_npm_run_pr' |

**Tool Call Timeline (6 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short && git branch --show-current && cat scripts/text/slug.ts; ls scripts | Exit code 1 main export function slugify(input: st | identify_checkout |
| 1 | Bash | {"command": "git checkout -q -b feat/slugify && cat > scripts/text/slug.test.ts <<'EOF'\nimport asse | (Bash completed with no output) | fresh_branch_from_main |
| 2 | Bash | {"command": "node --test scripts/text/slug.test.ts 2>&1 \| tail -15"} |       at Test.postRun (node:internal/test_runner/t | — |
| 3 | Bash | {"command": "cat > scripts/text/slug.ts <<'EOF'\nexport function slugify(input: string): string {\n  | ℹ   walk.ts                       \| 100.00 \|   100 | — |
| 4 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (tests\|pass\|fail)\""} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "git status --short"} | ℹ tests 572 ℹ pass 572 ℹ fail 0  M scripts/text/sl | — |

### competing (Compliance: 75%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | NO | no matching event classified for step 'finish_with_npm_run_pr' |

**Tool Call Timeline (13 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | identify_checkout |
| 1 | Bash | {"command": "git rev-parse --abbrev-ref HEAD"} | (ran as part of a chain; its output is on the chai | identify_checkout |
| 2 | Bash | {"command": "cat scripts/text/slug.ts"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "ls scripts/text scripts/lib \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "head -20 CHANGELOG.md"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "ls wiki/work \| head"} | main export function slugify(input: string): strin | — |
| 6 | Bash | {"command": "git switch -c feat/slugify"} | (ran as part of a chain; its output is on the chai | fresh_branch_from_main |
| 7 | Bash | {"command": "head -20 scripts/lib/paths.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "ls wiki/work/projects \| head"} | Switched to a new branch 'feat/slugify' import ass | — |
| 9 | Bash | {"command": "cat > scripts/text/slug.test.ts <<'EOF'\nimport assert from \"node:assert/strict\";\nim |   Error: not implemented   Error: not implemented  | — |
| 10 | Bash | {"command": "cat > scripts/text/slug.ts <<'EOF'\nexport function slugify(input: string): string {\n  | Zimi migration.md --- type: project title: Zimi mi | — |
| 11 | Bash | {"command": "node --test scripts/text/slug.test.ts 2>&1 \| tail -12"} | ✔ trims, lowercases and hyphenates runs of other c | — |
| 12 | Bash | {"command": "python3 - <<'EOF'\np=\"CHANGELOG.md\"\ns=open(p).read()\nm=\"## 2026-10-10\\n\\n\"\ns=s | 6c580e4 feat(text): implement slugify | stage_files_by_name |
