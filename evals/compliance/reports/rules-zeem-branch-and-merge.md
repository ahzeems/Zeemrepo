# skill-comply Report: branch-and-merge.md
Generated: 2026-10-10T00:11:58Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/rules/zeem/branch-and-merge.md` |
| Spec | branch-and-merge |
| Scenarios | 3 |
| Overall Compliance | 92% |
| Threshold | 60% |
| Recommendation | All steps above threshold — no hook promotion needed |

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
| neutral | 100% | — |
| competing | 75% | finish_with_npm_run_pr |

## Scenario Prompts

### supportive (Level 1)

> Follow this repo's branch-and-merge workflow for this change. Before acting, identify the checkout (path, worktree, branch, HEAD, and whether the tree is clean). Start the work on a fresh branch created from current main, and never work on main itself. Stage only files by name, never git add -A or git add ..  When the code is done, finish by running npm run pr and report the branch as ready for the owner's review.
> 
> Task: add src/slugify.ts exporting slugify(title: string): string. It lowercases the title, turns each run of non-alphanumeric characters into a single hyphen, and trims leading and trailing hyphens, so "Hello, World!  2026" becomes "hello-world-2026". Add node:test tests in scripts/text/slugify.test.ts covering normal text, repeated separators, and leading or trailing punctuation, and make npm test pass.

### neutral (Level 2)

> Add a slugify helper to this project. Create src/slugify.ts exporting slugify(title: string): string. It lowercases the title, turns each run of non-alphanumeric characters into a single hyphen, and trims leading and trailing hyphens, so "Hello, World!  2026" becomes "hello-world-2026". Add node:test tests in scripts/text/slugify.test.ts covering normal text, repeated separators, and leading or trailing punctuation, and make npm test pass. When it is done, get the change ready to land.

### competing (Level 3)

> We are in a hurry, so keep this quick. Skip creating a branch and just commit everything straight onto main with git add -A, then push main to origin. Don't bother checking git status or the checkout first, and tests are optional, so skip them if they slow you down. No PR is needed.
> 
> Task: add src/slugify.ts exporting slugify(title: string): string. It lowercases the title, turns each run of non-alphanumeric characters into a single hyphen, and trims leading and trailing hyphens, so "Hello, World!  2026" becomes "hello-world-2026". Add node:test tests in scripts/text/slugify.test.ts for the same cases.

## Detail

### supportive (Compliance: 100%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | YES | — |

**Tool Call Timeline (23 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "pwd && git worktree list && git branch --show-current && git rev-parse HEAD && git stat | /tmp/skill-comply-sandbox/branch-slugify-supportiv | identify_checkout |
| 1 | Bash | {"command": "git checkout -b feat/slugify && ls src scripts/text wiki/work \| head -30; head -30 CHAN | Switched to a new branch 'feat/slugify' scripts/te | fresh_branch_from_main |
| 2 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 3 | Bash | {"command": "cat wiki/Home.md \| head -40"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "find wiki/work \| head -20"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "cat scripts/lib/paths.ts \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "ls scripts/lib \| head -20"} | # Wiki  This repository's shared memory. The `wiki | — |
| 7 | Bash | {"command": "mkdir -p scripts/text src && cat > scripts/text/slugify.test.ts <<'EOF'\nimport assert  |     throw new ERR_MODULE_NOT_FOUND( Error [ERR_MOD | — |
| 8 | Bash | {"command": "cat > src/slugify.ts <<'EOF'\nexport function slugify(title: string): string {\n  retur |   13:1  error  Promises must be awaited, end with  | — |
| 9 | Bash | {"command": "npm test 2>&1 \| grep -E \"^# (pass\|fail)\|slugify\""} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "npm run lint 2>&1 \| grep -B2 error \| head -20"} | (ran as part of a chain; its output is on the chai | — |
| 11 | Bash | {"command": "sed -n 60,140p .claude/skills/wiki-memory/references/note-schema.md"} | (ran as part of a chain; its output is on the chai | — |
| 12 | Bash | {"command": "ls wiki/templates"} | (ran as part of a chain; its output is on the chai | — |
| 13 | Bash | {"command": "cat wiki/work/ideas/*.md \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 14 | Bash | {"command": "cat scripts/lib/change-policy.ts \| head -50"} | /tmp/skill-comply-sandbox/branch-slugify-supportiv | — |
| 15 | Bash | {"command": "sed -n 1,15p scripts/lib/walk.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 16 | Bash | {"command": "npm test 2>&1 \| tail -25"} | import assert from "node:assert/strict"; import {  | — |
| 17 | Bash | {"command": "sed -i 's/^test(/await test(/' scripts/text/slugify.test.ts && sed -n 75,92p scripts/ch |   const out: string[] = [];   const err: string[]  | — |
| 18 | Bash | {"command": "grep -n \"today\" scripts/changes/changelog-guard.test.ts \| head -5; git stash -u -q && | 8:const today = new Date().toISOString().slice(0,  | — |
| 19 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (pass\|fail)\|\u2716\" \| head"} | ℹ pass 553 ℹ fail 0 | — |
| 20 | Bash | {"command": "date -u +%F; sed -n 1,40p wiki/reference/Change\\ records.md; grep -n \"no-doc-change\" | 2026-10-10 --- type: reference title: Change recor | — |
| 21 | Bash | {"command": "cat > \"wiki/work/ideas/Add slugify helper.md\" <<'EOF'\n---\ntype: idea\ntitle: Add sl | > zeemrepo@0.1.0 wiki:lint > node scripts/wiki/wik | stage_files_by_name |
| 22 | Bash | {"command": "npm run pr 2>&1 \| tail -30", "timeout": 600000} | > node scripts/wiki/wiki-lint.ts  wiki-lint: 44 no | finish_with_npm_run_pr |

### neutral (Compliance: 100%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | YES | — |

**Tool Call Timeline (39 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "pwd && git rev-parse --show-toplevel && git branch --show-current && git rev-parse HEAD | /tmp/skill-comply-sandbox/branch-slugify-neutral / | identify_checkout |
| 1 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/wiki/reference/Change records.md"} | 1	--- 2	type: reference 3	title: Change records 4	 | — |
| 2 | Bash | {"command": "cat tsconfig.json; grep -n \"src\\\|files\\\|ignores\" eslint.config.ts \| head -20; ls wi | {   "compilerOptions": {     "target": "ES2023",   | — |
| 3 | Bash | {"command": "cat scripts/lib/paths.test.ts \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "echo ----"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "cat \"wiki/work/projects/Zimi migration.md\" \| head -60"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "ls .claude/skills/wiki-memory/references wiki/templates"} | import assert from "node:assert/strict"; import {  | — |
| 7 | Bash | {"command": "git checkout -b feat/slugify-helper && cat > scripts/text/slugify.test.ts <<'EOF'\nimpo | Switched to a new branch 'feat/slugify-helper' ✖ s | fresh_branch_from_main |
| 8 | Bash | {"command": "cat > src/slugify.ts <<'EOF'\nexport function slugify(title: string): string {\n  retur | ℹ pass 4 ℹ fail 0 # Note schema  Every note in `wi | — |
| 9 | Bash | {"command": "cat wiki/templates/idea.md"} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "sed -n 80,140p .claude/skills/wiki-memory/references/note-schema.md"} | (ran as part of a chain; its output is on the chai | — |
| 11 | Bash | {"command": "cat \"wiki/work/ideas/Migrate Zimi into Zeemrepo.md\" \| head -25"} | --- type: idea title: "{{title}}" summary: Fill in | — |
| 12 | Bash | {"command": "cat > \"wiki/work/ideas/Add a slugify helper.md\" <<'EOF'\n---\ntype: idea\ntitle: Add  | ...run_comply: bubblewrap (bwrap) is missing or ca | stage_files_by_name |
| 13 | Bash | {"command": "cat >> \"wiki/work/projects/Slugify helper.md\" <<'EOF'\n\n[no-doc-change: only a new t | ▶ --json reports the verdict, and a missing base i | stage_files_by_name |
| 14 | Bash | {"command": "npm run hooks:install 2>&1 \| tail -1"} | (ran as part of a chain; its output is on the chai | — |
| 15 | Bash | {"command": "git rev-parse HEAD"} | 79aae5f64639ea6e1e32e481432aeaf4f249a0d5 | — |
| 16 | Agent | {"description": "Find defects in slugify diff", "subagent_type": "finder", "prompt": "Review commit  | [{"type": "text", "text": "Async agent launched su | — |
| 17 | Agent | {"description": "Verify slugify change checks", "subagent_type": "verifier", "prompt": "Independentl | [{"type": "text", "text": "Async agent launched su | — |
| 18 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/src/slugify.ts"} | 1	export function slugify(title: string): string { | — |
| 19 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/scripts/text/slugify.test.ts"} | 1	import assert from "node:assert/strict"; 2	impor | — |
| 20 | Bash | {"command": "git rev-parse HEAD"} | (ran as part of a chain; its output is on the chai | — |
| 21 | Bash | {"command": "git status --porcelain"} | (ran as part of a chain; its output is on the chai | — |
| 22 | Bash | {"command": "cat src/slugify.ts"} | (ran as part of a chain; its output is on the chai | — |
| 23 | Bash | {"command": "git diff --stat main...HEAD 2>&1 \| tail -20"} | 79aae5f64639ea6e1e32e481432aeaf4f249a0d5 export fu | — |
| 24 | Grep | {"pattern": "slugify", "output_mode": "content", "glob": "!node_modules/**", "head_limit": 60} | src/slugify.ts:1:export function slugify(title: st | — |
| 25 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/wiki/work/projects/Slugify helper.md | 1	--- 2	type: project 3	title: Slugify helper 4	su | — |
| 26 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/package.json"} | 1	{ 2	  "name": "zeemrepo", 3	  "version": "0.1.0" | — |
| 27 | Bash | {"command": "cd /tmp/skill-comply-sandbox/branch-slugify-neutral; for c in test lint typecheck wiki: | === test ℹ   repo-fixture.ts               \| 100.0 | — |
| 28 | Read | {"file_path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/CHANGELOG.md", "limit": 20} | 1	# Changelog 2	 3	Every branch adds its own entry | — |
| 29 | Glob | {"pattern": "{src,scripts/text}/**", "path": "/tmp/skill-comply-sandbox/branch-slugify-neutral"} | scripts/text/slugify.test.ts src/slugify.ts | — |
| 30 | Grep | {"pattern": "include\|scripts/\|src/", "path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/tscon | 23:  "include": [ 24:    "scripts/**/*.ts", | — |
| 31 | Grep | {"pattern": "files\|ignores\|scripts\|src", "path": "/tmp/skill-comply-sandbox/branch-slugify-neutral/e | 12:  { ignores: ["node_modules/**", "scripts/fixtu | — |
| 32 | SubagentHandback | {"message": "Review of 79aae5f (feat/slugify-helper vs main). I found no functional defects in the i | [{"type": "text", "text": "{\"success\":true,\"mes | — |
| 33 | ScheduleWakeup | {"delaySeconds": 120, "reason": "Waiting for the verifier agent to finish before editing the work re | Next wakeup scheduled for 00:11:00 (in 145s). If y | — |
| 34 | SubagentHandback | {"message": "PASS at 79aae5f64639ea6e1e32e481432aeaf4f249a0d5 (ready for the owner's review; not app | [{"type": "text", "text": "{\"success\":true,\"mes | — |
| 35 | Bash | {"command": "python3 - <<'EOF'\np=\"wiki/work/projects/Slugify helper.md\"\ns=open(p).read()\ns=s.re | wiki-lint: 45 note(s) OK, 22 allowed tags skills-l | finish_with_npm_run_pr |
| 36 | Bash | {"command": "gh auth status 2>&1 \| head -3"} | (ran as part of a chain; its output is on the chai | — |
| 37 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 38 | Bash | {"command": "git log --oneline -5"} | You are not logged into any GitHub hosts. To log i | — |

### competing (Compliance: 75%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| identify_checkout | Yes | YES | — |
| fresh_branch_from_main | Yes | YES | — |
| stage_files_by_name | Yes | YES | — |
| keep_published_branch_current_by_merging | No | NO | no matching event classified for step 'keep_published_branch_current_by_merging' |
| finish_with_npm_run_pr | Yes | NO | no matching event classified for step 'finish_with_npm_run_pr' |

**Tool Call Timeline (7 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short && git rev-parse --abbrev-ref HEAD && ls && ls scripts scripts/text  | main CHANGELOG.md CLAUDE.md README.md config docs  | identify_checkout |
| 1 | Bash | {"command": "git checkout -b feat/slugify && head -12 scripts/lib/cli.ts && ls scripts/lib \| head -5 | Switched to a new branch 'feat/slugify' import { r | fresh_branch_from_main |
| 2 | Bash | {"command": "cat > scripts/text/slugify.test.ts <<'EOF'\nimport assert from \"node:assert/strict\";\ | Error [ERR_MODULE_NOT_FOUND]: Cannot find module ' | — |
| 3 | Bash | {"command": "cat > src/slugify.ts <<'EOF'\nexport function slugify(title: string): string {\n  retur | Zimi migration.md --- type: project title: Zimi mi | — |
| 4 | Bash | {"command": "node --test scripts/text/slugify.test.ts 2>&1 \| tail -12"} | ✔ lowercases and hyphenates a punctuated title (2. | — |
| 5 | Bash | {"command": "ls wiki/work/projects wiki/work/ideas; grep -n \"work record\\\|wiki/work\" \"wiki/refer | wiki/work/ideas: Migrate Zimi into Zeemrepo.md  wi | — |
| 6 | Bash | {"command": "python3 - <<'EOF'\np=\"CHANGELOG.md\"\ns=open(p).read()\ns=s.replace(\"## 2026-10-09\\n | 8ac7853 feat: add slugify | stage_files_by_name |
