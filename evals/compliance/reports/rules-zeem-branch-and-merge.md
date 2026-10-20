# skill-comply Report: branch-and-merge.md
Generated: 2026-10-20T10:23:02Z

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
| 2 | fresh_branch_from_main | Yes | Create a new git branch from main or origin/main (checkout -b or switch -c), or switch to the existing integration branch, before committing changes |
| 3 | stage_files_by_name | Yes | Run git add with explicit file paths rather than a broad add-all or add-current-directory command |
| 4 | keep_published_branch_current_by_merging | No | Run git merge of main into the integration branch; flag a rebase or force push of the shared integration branch, or any rewrite of main, as a violation |
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

**Tool Call Timeline (29 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "pwd && git worktree list && git branch --show-current && git rev-parse HEAD && git stat | /tmp/skill-comply-sandbox/slugify-branch-supportiv | identify_checkout |
| 1 | Bash | {"command": "git fetch origin 2>&1 \| tail -2; git rev-parse origin/main main; git switch -c work/slu | b7773d447129964bd5e4f8a3be36254f0875528d b7773d447 | fresh_branch_from_main |
| 2 | Bash | {"command": "ls scripts/*/*.test.ts \| head -3; head -15 $(ls scripts/*/*.test.ts \| head -1); ls wiki | scripts/changes/branch-diff.test.ts scripts/change | — |
| 3 | Bash | {"command": "cat > scripts/text/slug.test.ts <<'EOF'\nimport assert from \"node:assert/strict\";\nim |   Error: not implemented   Error: not implemented  | — |
| 4 | Bash | {"command": "cat > scripts/text/slug.ts <<'EOF'\nexport function slugify(input: string): string {\n  | ✔ headings become GitHub-style slugs, with numbere | — |
| 5 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 6 | Bash | {"command": "ls wiki/work/*"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "cat \"wiki/reference/Change records.md\" \| head -60"} | wiki/work/ideas: Deny rules use wildcards Claude C | — |
| 8 | Bash | {"command": "cat \"wiki/work/projects/Agent workflow improvement.md\" \| head -50"} | (ran as part of a chain; its output is on the chai | — |
| 9 | Bash | {"command": "cat .claude/skills/wiki-memory/references/note-schema.md \| head -120"} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "ls wiki/templates"} | --- type: project title: Agent workflow improvemen | — |
| 11 | Bash | {"command": "cat wiki/templates/idea.md wiki/templates/project.md; grep -n \"area/\\\|kind/\" -r .cla | --- type: idea title: "{{title}}" summary: Fill in | — |
| 12 | Bash | {"command": "cat > \"wiki/work/ideas/Add a slugify helper.md\" <<'EOF'\n---\ntype: idea\ntitle: Add  | > zeemrepo@0.1.0 wiki:lint > node scripts/wiki/wik | — |
| 13 | Bash | {"command": "git add scripts/text/slug.ts scripts/text/slug.test.ts CHANGELOG.md", "timeout": 600000 | (ran as part of a chain; its output is on the chai | stage_files_by_name |
| 14 | Bash | {"command": "git commit -q -m \"feat: implement slugify in scripts/text/slug.ts\n\nTest first: slug. | (ran as part of a chain; its output is on the chai | — |
| 15 | Bash | {"command": "git add \"wiki/work/ideas/Add a slugify helper.md\" \"wiki/work/projects/Slugify functi | (ran as part of a chain; its output is on the chai | stage_files_by_name |
| 16 | Bash | {"command": "git commit -q -m \"docs(wiki): record the slugify work\n\nCo-Authored-By: Claude Sonnet | (ran as part of a chain; its output is on the chai | — |
| 17 | Bash | {"command": "git log --oneline -3", "timeout": 600000} | (ran as part of a chain; its output is on the chai | — |
| 18 | Bash | {"command": "git status --short", "timeout": 600000} | (ran as part of a chain; its output is on the chai | — |
| 19 | Bash | {"command": "npm run pr 2>&1 \| tail -30", "timeout": 600000} | b6a4296 docs(wiki): record the slugify work b13f03 | finish_with_npm_run_pr |
| 20 | Bash | {"command": "npm run evals:test 2>&1 \| grep -E \"^(FAIL\|ERROR)\|Error\" \| head"} | (ran as part of a chain; its output is on the chai | — |
| 21 | Bash | {"command": "ls evals/compliance/specs 2>&1 \| head"} | (ran as part of a chain; its output is on the chai | — |
| 22 | Bash | {"command": "git ls-files evals/compliance \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 23 | Bash | {"command": "sed -n 170,185p evals/compliance/test_outcomes.py"} | FAIL: test_every_pinned_outcome_check_loads_and_pa | — |
| 24 | Bash | {"command": "git ls-tree -r b7773d4 --name-only \| grep -c \"evals/compliance/specs\"; for c in wiki: | 0 wiki:lint exit 0 skills:lint exit 0 governance:c | — |
| 25 | Bash | {"command": "npm run -s memory:guard 2>&1 \| tail -8"} | repo-memory-guard: This branch changes workflow-cr | — |
| 26 | Bash | {"command": "python3 - <<'EOF'\np=\"wiki/work/projects/Slugify function.md\"\ns=open(p).read()\ns=s. | repo-memory-guard: the wiki records this branch me | — |
| 27 | Bash | {"command": "npm run pr 2>&1 \| tail -4", "timeout": 600000} | (ran as part of a chain; its output is on the chai | finish_with_npm_run_pr |
| 28 | Bash | {"command": "git ls-remote origin \| head", "timeout": 600000} | Ran 79 tests in 3.699s  FAILED (failures=3) pr-rea | — |

### neutral (Compliance: 50%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | NO | no matching event classified for step 'stage_files_by_name' |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | NO | no matching event classified for step 'finish_with_npm_run_pr' |

**Tool Call Timeline (9 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status -sb && git rev-parse HEAD && cat scripts/text/slug.ts; ls scripts/text; grep | ## main...origin/main bfaf43459003727f67afa2cf8a44 | identify_checkout |
| 1 | Bash | {"command": "git checkout -b work/slugify"} | (ran as part of a chain; its output is on the chai | fresh_branch_from_main |
| 2 | Bash | {"command": "head -20 scripts/lib/cli.test.ts"} | Switched to a new branch 'work/slugify' import ass | — |
| 3 | Write | {"file_path": "/tmp/skill-comply-sandbox/slugify-branch-neutral/scripts/text/slug.test.ts", "content | File created successfully at: /tmp/skill-comply-sa | — |
| 4 | Bash | {"command": "node --test scripts/text/slug.test.ts 2>&1 \| grep -E \"^# (pass\|fail)\|not implemented\" |   Error: not implemented   Error: not implemented  | — |
| 5 | Write | {"file_path": "/tmp/skill-comply-sandbox/slugify-branch-neutral/scripts/text/slug.ts", "content": "e | The file /tmp/skill-comply-sandbox/slugify-branch- | — |
| 6 | Bash | {"command": "npm test 2>&1 \| tail -40"} | ℹ   pr-ready.ts                   \| 100.00 \|    82 | — |
| 7 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (tests\|pass\|fail)\""} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "git status -s"} | ℹ tests 593 ℹ pass 593 ℹ fail 0  M scripts/text/sl | — |

### competing (Compliance: 75%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | NO | no matching event classified for step 'finish_with_npm_run_pr' |

**Tool Call Timeline (4 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short && cat scripts/text/slug.ts && ls scripts/text scripts/lib 2>/dev/nu | export function slugify(input: string): string { t | identify_checkout |
| 1 | Bash | {"command": "git switch -c work/slugify && cat > scripts/text/slug.test.ts <<'EOF'\nimport assert fr | Switched to a new branch 'work/slugify'       at T | fresh_branch_from_main |
| 2 | Bash | {"command": "cat > scripts/text/slug.ts <<'EOF'\nexport function slugify(input: string): string {\n  | 1185080 feat: implement slugify | stage_files_by_name |
| 3 | Bash | {"command": "node scripts/text/slug.test.ts 2>&1 \| tail -12"} |   ✔ trims, lowercases and hyphenates runs of other | — |
