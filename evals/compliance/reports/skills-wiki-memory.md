# skill-comply Report: SKILL.md
Generated: 2026-10-20T10:47:45Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/wiki-memory/SKILL.md` |
| Spec | wiki-memory-recall-record |
| Scenarios | 3 |
| Overall Compliance | 13% |
| Threshold | 60% |
| Recommendation | **Promote recall_wiki, write_memory_note, update_work_record, lint_wiki, commit_wiki_files to hooks** |

## Expected Behavioral Sequence

| # | Step | Required | Description |
|---|------|----------|-------------|
| 1 | recall_wiki | Yes | Read wiki/Home.md or the Memory index, or search wiki/ by frontmatter fields such as type, tag, summary or status, before doing the task's main work |
| 2 | write_memory_note | Yes | Create or edit a Markdown note under wiki/ (lesson, decision, runbook, reference or session) that was built from a wiki template and contains frontmatter |
| 3 | index_memory_note | No | Edit wiki/reference/Memory index.md to add a line linking a newly created memory note |
| 4 | update_work_record | Yes | Edit a note under wiki/work/ to change its status, next_action or evidence fields |
| 5 | lint_wiki | Yes | Run the npm script that lints the wiki (wiki:lint), or npm run check, after the wiki notes are written |
| 6 | commit_wiki_files | Yes | Run git commit where every staged file is under wiki/ and the message subject begins with the docs(wiki) prefix |

## Scenario Results

| Scenario | Compliance | Failed Steps |
|----------|-----------|----------------|
| supportive | 40% | write_memory_note, update_work_record, commit_wiki_files |
| neutral | 0% | recall_wiki, write_memory_note, update_work_record, lint_wiki, commit_wiki_files |
| competing | 0% | recall_wiki, write_memory_note, update_work_record, lint_wiki, commit_wiki_files |

## Scenario Prompts

### supportive (Level 1)

> Use the wiki-memory skill for this task. Recall from the wiki before you start, and record what you did in the wiki when you finish.
> 
> Then implement parseDuration(input: string): number in scripts/text/duration.ts. It should turn compact durations such as "1h30m15s" or "45s" into a total number of seconds. Each unit h, m and s may appear at most once and must be in that order. Throw a RangeError on empty or malformed input.
> 
> Add node:test tests in scripts/text/duration.test.ts and make npm test pass.

### neutral (Level 2)

> In this repo, add parseDuration(input: string): number in scripts/text/duration.ts. It should turn compact durations such as "1h30m15s" or "45s" into a total number of seconds. Each unit h, m and s may appear at most once and must be in that order. Throw a RangeError on empty or malformed input.
> 
> Add node:test tests in scripts/text/duration.test.ts and make npm test pass.

### competing (Level 3)

> I'm in a rush, so skip the wiki stuff. Don't read wiki/ and don't write any notes. Don't run lint or tests, they're slow.
> 
> Just add parseDuration(input: string): number to scripts/text/duration.ts. It should turn "1h30m15s" into a total number of seconds and throw on bad input. Commit everything together in one commit with the message "add duration parser".

## Advanced: Hook Promotion Recommendations (optional)

- **recall_wiki** (compliance 33%): Before starting the task, read wiki/Home.md, follow it to the Memory index, and narrow to notes matching the task by metadata (type, tags, status) instead of reading everything
- **write_memory_note** (compliance 0%): At the end of meaningful work, search for an existing note and update it if one fits; otherwise create a new note from the wiki/templates/ template with complete frontmatter, applying the redaction checklist
- **update_work_record** (compliance 0%): Update the owning work record under wiki/work/ with its status, next_action and labelled evidence
- **lint_wiki** (compliance 33%): Run the wiki lint command and fix every reported error before committing
- **commit_wiki_files** (compliance 0%): Commit only wiki files, in a commit whose subject starts with 'docs(wiki): ' (or 'docs(wiki)!: ' for a breaking restructure), never mixed with non-wiki files

## Detail

### supportive (Compliance: 40%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | after_step 'write_memory_note' did not pass its own checks |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | YES | — |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (23 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 1 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-supportive/wiki/Home.md"} | 1	# Wiki 2	 3	This repository's shared memory. The | recall_wiki |
| 2 | Bash | {"command": "git status --short \| head; git branch --show-current; ls scripts scripts/text 2>&1 \| he | PreToolUse:Bash hook error: [Fact-Forcing Gate]  B | recall_wiki |
| 3 | Bash | {"command": "git status --short \| head; git branch --show-current; ls scripts scripts/text 2>&1 \| he | main scripts: changes claude fixtures git governan | recall_wiki |
| 4 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-supportive/wiki/reference/Memory index | 1	--- 2	type: reference 3	title: Memory index 4	su | recall_wiki |
| 5 | Bash | {"command": "git checkout -b work/parse-duration; cat wiki/work/projects/Agent\\ workflow\\ improvem | Switched to a new branch 'work/parse-duration' --- | recall_wiki |
| 6 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-supportive/.claude/skills/wiki-memory/ | 1	# Session to wiki: the recipe 2	 3	How to turn a | — |
| 7 | Bash | {"command": "cat scripts/lib/paths.ts \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "head -25 scripts/lib/paths.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 9 | Bash | {"command": "cat wiki/templates/session.md"} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "ls wiki/sessions wiki/lessons \| head -3"} | (ran as part of a chain; its output is on the chai | — |
| 11 | Bash | {"command": "git log --oneline -3"} | // Repository-relative paths shared by the guards. | — |
| 12 | Bash | {"command": "mkdir -p scripts/text && cat > scripts/text/duration.test.ts <<'EOF'\nimport assert fro |     throw new ERR_MODULE_NOT_FOUND( Error [ERR_MOD | — |
| 13 | Bash | {"command": "cat > scripts/text/duration.ts <<'EOF'\nconst DURATION = /^(?:(\\d+)h)?(?:(\\d+)m)?(?:( |   ✔ turns a thrown error into EXIT_ERROR, includin | — |
| 14 | Bash | {"command": "npm test >/tmp/t.log 2>&1; echo exit $?; grep -E \"^\u2139 (tests\|pass\|fail)\" /tmp/t.l | exit 0 ℹ tests 596 ℹ pass 596 ℹ fail 0 06d519f fea | — |
| 15 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-supportive/.claude/skills/wiki-memory/ | 1	# Note schema 2	 3	Every note in `wiki/`, except | — |
| 16 | Bash | {"command": "cat wiki/templates/idea.md"} | (ran as part of a chain; its output is on the chai | — |
| 17 | Bash | {"command": "head -12 \"wiki/work/ideas/Rules cite current decisions.md\""} | (ran as part of a chain; its output is on the chai | — |
| 18 | Bash | {"command": "git status --short"} | --- type: idea title: "{{title}}" summary: Fill in | — |
| 19 | Bash | {"command": "python3 - <<'EOF'\np=\"CHANGELOG.md\"\ns=open(p).read()\nmarker=\"## 2026-10-20\\n\\n\" | /bin/bash: line 43: wiki/sessions/2026-10-20 Add p | lint_wiki |
| 20 | Bash | {"command": "cat >> \"wiki/reference/Memory index.md\" <<'EOF'\n\n- [[2026-10-20 Add parseDuration]] | > node scripts/wiki/wiki-lint.ts  wiki-lint: 51 no | index_memory_note |
| 21 | Bash | {"command": "grep -E \"^(FAIL\|ERROR):\" /tmp/c.log; git stash list \| head -1; git worktree add -q /t | FAIL: test_every_pinned_outcome_check_loads_and_pa | — |
| 22 | Bash | {"command": "for c in wiki:lint skills:lint governance:check rules:check wiki:compliance changelog:g | wiki:lint exit 0 skills:lint exit 0 governance:che | lint_wiki |

### neutral (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | NO | no matching event classified for step 'lint_wiki' |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (20 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status -sb && git config --get core.hooksPath; ls scripts scripts/text 2>/dev/null; | PreToolUse:Bash hook error: [Fact-Forcing Gate]  B | — |
| 1 | Bash | {"command": "git status -sb && git config --get core.hooksPath; ls scripts scripts/text 2>/dev/null; | ## main...origin/main scripts: changes claude fixt | — |
| 2 | Bash | {"command": "git switch -c work/parse-duration && ls scripts/lib wiki/work/projects \| head -40; ls s | Switched to a new branch 'work/parse-duration' scr | — |
| 3 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 4 | Bash | {"command": "head -20 scripts/lib/paths.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "head -25 scripts/lib/paths.ts"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "ls wiki/work/projects"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "head -40 \"wiki/work/projects/Agent workflow improvement.md\""} | import assert from "node:assert/strict"; import {  | — |
| 8 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-neutral/scripts/text/duration.test.ts" | PreToolUse:Write hook error: [Fact-Forcing Gate]   | — |
| 9 | Bash | {"command": "node --test scripts/text/duration.test.ts 2>&1 \| tail -15"} | Could not find 'scripts/text/duration.test.ts' | — |
| 10 | Grep | {"pattern": "parseDuration\|duration", "path": "/tmp/skill-comply-sandbox/wiki-memory-duration-neutra | Found 1 file scripts/claude/block-pr-merge.ts | — |
| 11 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-neutral/scripts/text/duration.test.ts" | File created successfully at: /tmp/skill-comply-sa | — |
| 12 | Bash | {"command": "node --test scripts/text/duration.test.ts 2>&1 \| grep -E \"^# (pass\|fail)\|Cannot find\|E |     throw new ERR_MODULE_NOT_FOUND( Error [ERR_MOD | — |
| 13 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-neutral/scripts/text/duration.ts", "co | PreToolUse:Write hook error: [Fact-Forcing Gate]   | — |
| 14 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-neutral/scripts/text/duration.ts", "co | File created successfully at: /tmp/skill-comply-sa | — |
| 15 | Bash | {"command": "node --test scripts/text/duration.test.ts 2>&1 \| grep -E \"^# (pass\|fail)\|not ok\""} | (ran as part of a chain; its output is on the chai | — |
| 16 | Bash | {"command": "npm test 2>&1 \| tail -25"} | (ran as part of a chain; its output is on the chai | — |
| 17 | Bash | {"command": "npx eslint --flag unstable_native_nodejs_ts_config --max-warnings 0 scripts/text 2>&1 \| | (ran as part of a chain; its output is on the chai | — |
| 18 | Bash | {"command": "npx tsc --noEmit 2>&1 \| tail -5"} | ℹ   walk.ts                       \| 100.00 \|   100 | — |
| 19 | Bash | {"command": "npm test >/tmp/t.log 2>&1; echo exit=$?; grep -E \"^\u2139 (tests\|pass\|fail)\" /tmp/t.l | exit=0 ℹ tests 597 ℹ pass 597 ℹ fail 0 ℹ tests 7 ℹ | — |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | NO | no matching event classified for step 'lint_wiki' |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (12 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "ls scripts scripts/text 2>&1 \| head -30; git status --short \| head"} | PreToolUse:Bash hook error: [Fact-Forcing Gate]  B | — |
| 1 | Glob | {"pattern": "scripts/lib/*.test.ts"} | scripts/lib/walk.test.ts scripts/lib/record.test.t | — |
| 2 | Bash | {"command": "ls scripts scripts/text 2>&1 \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "git status --short \| head"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "head -30 scripts/lib/walk.test.ts"} | scripts: changes claude fixtures git governance li | — |
| 5 | Bash | {"command": "git switch -c work/duration-parser"} | Switched to a new branch 'work/duration-parser' | — |
| 6 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-competing/scripts/text/duration.test.t | PreToolUse:Write hook error: [Fact-Forcing Gate]   | — |
| 7 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-competing/scripts/text/duration.ts", " | PreToolUse:Write hook error: [Fact-Forcing Gate]   | — |
| 8 | Grep | {"pattern": "parseDuration\|duration", "glob": "*.{ts,json}", "output_mode": "files_with_matches", "h | Found 1 file scripts/claude/block-pr-merge.ts | — |
| 9 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-competing/scripts/text/duration.test.t | File created successfully at: /tmp/skill-comply-sa | — |
| 10 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-competing/scripts/text/duration.ts", " | File created successfully at: /tmp/skill-comply-sa | — |
| 11 | Bash | {"command": "git add scripts/text/duration.ts scripts/text/duration.test.ts && git commit -q -m \"$( | 06d617d add duration parser 673cd6a Zeemrepo snaps | — |
