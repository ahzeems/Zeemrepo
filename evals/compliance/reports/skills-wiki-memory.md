# skill-comply Report: SKILL.md
Generated: 2026-10-10T09:35:08Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/wiki-memory/SKILL.md` |
| Spec | wiki-memory-recall-record |
| Scenarios | 3 |
| Overall Compliance | 20% |
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
| supportive | 60% | update_work_record, commit_wiki_files |
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
- **write_memory_note** (compliance 33%): At the end of meaningful work, search for an existing note and update it if one fits; otherwise create a new note from the wiki/templates/ template with complete frontmatter, applying the redaction checklist
- **update_work_record** (compliance 0%): Update the owning work record under wiki/work/ with its status, next_action and labelled evidence
- **lint_wiki** (compliance 33%): Run the wiki lint command and fix every reported error before committing
- **commit_wiki_files** (compliance 0%): Commit only wiki files, in a commit whose subject starts with 'docs(wiki): ' (or 'docs(wiki)!: ' for a breaking restructure), never mixed with non-wiki files

## Detail

### supportive (Compliance: 60%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| write_memory_note | Yes | YES | — |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | YES | — |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (23 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 1 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-memory-duration-supportive/wiki/Home.md"} | 1	# Wiki 2	 3	This repository's shared memory. The | recall_wiki |
| 2 | Bash | {"command": "git branch --show-current && ls scripts scripts/text 2>&1 \| head -50; ls wiki/work wiki | main scripts: changes claude fixtures git governan | — |
| 3 | Bash | {"command": "cat \"wiki/reference/Memory index.md\""} | (ran as part of a chain; its output is on the chai | recall_wiki |
| 4 | Bash | {"command": "find wiki/work wiki/lessons wiki/sessions -type f 2>/dev/null \| head -30"} | (ran as part of a chain; its output is on the chai | recall_wiki |
| 5 | Bash | {"command": "cat wiki/templates/session.md"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "ls scripts/lib"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "head -30 scripts/lib/cli.ts"} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "cat .claude/skills/wiki-memory/references/session-to-wiki.md \| head -80"} | (ran as part of a chain; its output is on the chai | — |
| 9 | Bash | {"command": "head -30 CHANGELOG.md"} | --- type: reference title: Memory index summary: I | — |
| 10 | Bash | {"command": "git checkout -q -b feat/parse-duration && head -25 scripts/lib/paths.test.ts; cat wiki/ | import assert from "node:assert/strict"; import {  | — |
| 11 | Bash | {"command": "mkdir -p scripts/text && cat > scripts/text/duration.test.ts <<'EOF'\nimport assert fro | Error [ERR_MODULE_NOT_FOUND]: Cannot find module ' | — |
| 12 | Bash | {"command": "cat > scripts/text/duration.ts <<'EOF'\nconst DURATION = /^(?:(\\d+)h)?(?:(\\d+)m)?(?:( | ℹ duration_ms 34004.37193 ℹ   duration.ts          | — |
| 13 | Bash | {"command": "npm test >/tmp/t.log 2>&1; echo exit $?; grep -E \"^\u2139 (pass\|fail)\" /tmp/t.log; se | exit 0 ℹ pass 575 ℹ fail 0 # Writing standards  ## | — |
| 14 | Bash | {"command": "cat wiki/templates/issue.md"} | (ran as part of a chain; its output is on the chai | — |
| 15 | Bash | {"command": "grep -n \"issue\" .claude/skills/wiki-memory/references/note-schema.md \| head"} | (ran as part of a chain; its output is on the chai | — |
| 16 | Bash | {"command": "grep -n \"agent\" .claude/skills/wiki-memory/references/note-schema.md \| tail -5"} | (ran as part of a chain; its output is on the chai | — |
| 17 | Bash | {"command": "grep -n \"Sessions\" -A3 \"wiki/reference/Memory index.md\""} | --- type: issue title: "{{title}}" summary: Descri | — |
| 18 | Bash | {"command": "cat wiki/templates/project.md"} | (ran as part of a chain; its output is on the chai | — |
| 19 | Bash | {"command": "sed -n 60,100p .claude/skills/wiki-memory/references/note-schema.md"} | (ran as part of a chain; its output is on the chai | — |
| 20 | Bash | {"command": "sed -n 1,25p \"wiki/work/ideas/Migrate Zimi into Zeemrepo.md\""} | --- type: project title: "{{title}}" summary: Fill | — |
| 21 | Bash | {"command": "mkdir -p wiki/sessions\ncat > \"wiki/work/ideas/Parse compact durations.md\" <<'EOF'\n- | ## Sessions - [[2026-10-10 Add parseDuration]] - A | write_memory_note |
| 22 | Bash | {"command": "python3 - <<'EOF'\np=\"CHANGELOG.md\"\ns=open(p).read()\nm=\"## 2026-10-10\\n\\n\"\ns=s | 43d79e1 docs(wiki): record parseDuration session a | lint_wiki |

### neutral (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | NO | no matching event classified for step 'lint_wiki' |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (6 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status -sb && git rev-parse HEAD && ls scripts scripts/text 2>&1 \| head -40 && grep | ## main...origin/main c8d5c095f1a6525ab07746cae80e | — |
| 1 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 2 | Bash | {"command": "git checkout -b feat/parse-duration && ls scripts/lib wiki/work/projects wiki/work/idea | Switched to a new branch 'feat/parse-duration' scr | — |
| 3 | Bash | {"command": "cat > scripts/text/duration.test.ts <<'EOF'\nimport assert from \"node:assert/strict\"; | ℹ todo 0 ℹ duration_ms 127.690238  ✖ failing tests | — |
| 4 | Bash | {"command": "cat > scripts/text/duration.ts <<'EOF'\nconst DURATION = /^(?:(\\d+)h)?(?:(\\d+)m)?(?:( | ℹ   evidence.ts                   \| 100.00 \|   100 | — |
| 5 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (tests\|pass\|fail)\"; npx eslint scripts/text && npx t | Exit code 2 ℹ tests 578 ℹ pass 578 ℹ fail 0  Oops! | — |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | NO | no matching event classified for step 'lint_wiki' |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (2 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "ls scripts scripts/text 2>&1 \| head -30; f=$(ls scripts/*/*.test.ts \| head -1); echo $f | scripts: changes claude fixtures git governance li | — |
| 1 | Bash | {"command": "git switch -c add-duration-parser && mkdir -p scripts/text && cat > scripts/text/durati | Switched to a new branch 'add-duration-parser' a90 | — |
