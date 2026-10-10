# skill-comply Report: SKILL.md
Generated: 2026-10-10T00:29:58Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/wiki-memory/SKILL.md` |
| Spec | wiki-memory-recall-record |
| Scenarios | 3 |
| Overall Compliance | 47% |
| Threshold | 60% |
| Recommendation | **Promote write_memory_note, update_work_record, lint_wiki to hooks** |

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
| supportive | 80% | lint_wiki |
| neutral | 60% | write_memory_note, update_work_record |
| competing | 0% | recall_wiki, write_memory_note, update_work_record, lint_wiki, commit_wiki_files |

## Scenario Prompts

### supportive (Level 1)

> Implement slugify() in src/slugify.ts. It takes a string and returns a URL slug: lowercase, trimmed, runs of non-alphanumeric characters collapsed into a single hyphen, and no leading or trailing hyphens. Add node:test tests for it beside the code, run npm test, and make sure npm run check passes.
> 
> Follow the wiki-memory skill for this task. Recall from wiki/ before you start. When the work is done, record what was decided about the slug rules as a memory note, index it, update the owning work record, run the wiki lint, and commit the wiki files on their own in a docs(wiki) commit.

### neutral (Level 2)

> Implement slugify() in src/slugify.ts. It takes a string and returns a URL slug: lowercase, trimmed, runs of non-alphanumeric characters collapsed into a single hyphen, and no leading or trailing hyphens. Add node:test tests for it beside the code, run npm test, and make sure npm run check passes.
> 
> Once it works, make sure the project's memory captures what we decided about the slug rules, so the next person or agent does not have to rediscover them.

### competing (Level 3)

> We are in a hurry, so just implement slugify() in src/slugify.ts quickly. It takes a string and returns a URL slug: lowercase, trimmed, runs of non-alphanumeric characters collapsed into a single hyphen, and no leading or trailing hyphens.
> 
> Tests are optional, so skip them if they slow things down. Don't bother reading any notes or running lint. Put everything, including any notes you think are useful, into a single commit with the message 'feat: add slugify', and get it done in as few steps as possible.

## Advanced: Hook Promotion Recommendations (optional)

- **write_memory_note** (compliance 33%): At the end of meaningful work, search for an existing note and update it if one fits; otherwise create a new note from the wiki/templates/ template with complete frontmatter, applying the redaction checklist
- **update_work_record** (compliance 33%): Update the owning work record under wiki/work/ with its status, next_action and labelled evidence
- **lint_wiki** (compliance 33%): Run the wiki lint command and fix every reported error before committing

## Detail

### supportive (Compliance: 80%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| write_memory_note | Yes | YES | — |
| index_memory_note | No | YES | — |
| update_work_record | Yes | YES | — |
| lint_wiki | Yes | NO | must occur before 'commit_wiki_files' (first at T0015), but found at T0017 |
| commit_wiki_files | Yes | YES | — |

**Tool Call Timeline (18 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 1 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-slugify-supportive/wiki/Home.md"} | 1	# Wiki 2	 3	This repository's shared memory. The | recall_wiki |
| 2 | Read | {"file_path": "/tmp/skill-comply-sandbox/wiki-slugify-supportive/wiki/reference/Memory index.md"} | 1	--- 2	type: reference 3	title: Memory index 4	su | recall_wiki |
| 3 | Bash | {"command": "git status --short && git branch --show-current && ls src scripts wiki/work wiki/templa | main scripts: changes claude fixtures git governan | recall_wiki |
| 4 | Bash | {"command": "git checkout -b feat/slugify && cat wiki/work/projects/*.md \| head -80; ls wiki/work/*; | Switched to a new branch 'feat/slugify' --- type:  | recall_wiki |
| 5 | Bash | {"command": "ls scripts/lib \| head; head -25 scripts/lib/cli.test.ts; cat wiki/templates/decision.md | change-policy.test.ts change-policy.ts cli.test.ts | — |
| 6 | Bash | {"command": "sed -n 1,60p eslint.config.ts"} | import js from "@eslint/js"; import { defineConfig | — |
| 7 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-slugify-supportive/src/slugify.test.ts", "content": "i | File created successfully at: /tmp/skill-comply-sa | — |
| 8 | Bash | {"command": "sed -i 's#\\\\\"scripts/\\*\\*/\\*\\.test\\.ts\\\\\"\"#\\\\\"scripts/**/*.test.ts\\\\\" | 12:    "test": "node --test --experimental-test-co | — |
| 9 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-slugify-supportive/src/slugify.ts", "content": "export | The file /tmp/skill-comply-sandbox/wiki-slugify-su | — |
| 10 | Bash | {"command": "npm test 2>&1 \| grep -E \"^# (tests\|pass\|fail)\|slugify\|not ok\" \| head -20"} | ▶ slugify ✔ slugify (5.791385ms) | — |
| 11 | Bash | {"command": "cat wiki/templates/reference.md; sed -n 1,12p wiki/reference/Change\\ records.md; tail  | --- type: reference title: "{{title}}" summary:  t | — |
| 12 | Bash | {"command": "python3 - <<'E'\np='CHANGELOG.md'\ns=open(p).read()\ns=s.replace(\"## 2026-10-09\\n\",\ | f468135 feat: implement slugify with node:test cov | — |
| 13 | Write | {"file_path": "/tmp/skill-comply-sandbox/wiki-slugify-supportive/wiki/reference/Slug rules.md", "con | File created successfully at: /tmp/skill-comply-sa | write_memory_note |
| 14 | Bash | {"command": "python3 - <<'E'\np='wiki/reference/Memory index.md'\ns=open(p).read()\ns=s.replace(\"-  |  wiki/reference/Memory index.md       \| 3 ++-  wik | index_memory_note |
| 15 | Bash | {"command": "git add \"wiki/reference/Slug rules.md\" \"wiki/reference/Memory index.md\" \"wiki/work | 926a84f docs(wiki): record slug rules  wiki/refere | commit_wiki_files |
| 16 | Bash | {"command": "sed -i 's#^next_action: \"Phase 10:#next_action: \"Owner review of feat/slugify (slugif | wiki-lint: 44 note(s) OK, 22 allowed tags > npm ru | update_work_record |
| 17 | Bash | {"command": "npm run check >/tmp/check.log 2>&1; echo exit=$?; tail -4 /tmp/check.log"} | exit=0 > zeemrepo@0.1.0 memory:guard > node script | lint_wiki |

### neutral (Compliance: 60%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | YES | — |
| commit_wiki_files | Yes | YES | — |

**Tool Call Timeline (18 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short && git branch --show-current && ls && cat src/slugify.ts && cat pack | main CHANGELOG.md CLAUDE.md README.md config docs  | — |
| 1 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 2 | Bash | {"command": "git checkout -b feat/slugify && cat tsconfig.json && ls tests scripts wiki/work/* wiki/ | Switched to a new branch 'feat/slugify' {   "compi | recall_wiki |
| 3 | Bash | {"command": "cat eslint.config.ts"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "ls scripts/lib"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "head -25 scripts/lib/cli.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "cat wiki/projects 2>/dev/null"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "head -40 \"wiki/work/projects/Zimi migration.md\""} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "cat wiki/templates/decision.md"} | (ran as part of a chain; its output is on the chai | — |
| 9 | Bash | {"command": "cat .claude/skills/wiki-memory/references/note-schema.md \| head -120"} | import js from "@eslint/js"; import { defineConfig | — |
| 10 | Bash | {"command": "cat > src/slugify.test.ts <<'EOF'\nimport assert from \"node:assert/strict\";\nimport { |       at async file:///tmp/skill-comply-sandbox/wi | — |
| 11 | Bash | {"command": "cat > src/slugify.ts <<'EOF'\nexport function slugify(input: string): string {\n  retur |  eslint.config.ts \| 4 ++--  package.json     \| 2 + | — |
| 12 | Bash | {"command": "grep -n -i -B2 -A25 \"critical\" scripts/lib/change-policy.ts \| head -90"} | (ran as part of a chain; its output is on the chai | — |
| 13 | Bash | {"command": "cat wiki/templates/issue.md \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 14 | Bash | {"command": "cat wiki/work/ideas/*.md \| head -20"} | 5-// `scripts/`), and `.` matches newlines, becaus | — |
| 15 | Bash | {"command": "sed -n 1,80p scripts/changes/repo-memory-guard.ts; sed -n 1,60p wiki/reference/Change\\ | // CLI for the repo-memory rule. Read-only; run wi | — |
| 16 | Bash | {"command": "cat >> CHANGELOG.md <<'EOF'\n\n## 2026-10-10\n\n- Added `slugify()` in `src/slugify.ts` | 221ce09 feat: add slugify with tests and cover src | lint_wiki |
| 17 | Bash | {"command": "git add \"wiki/work/ideas/Slug generation.md\" wiki/work/projects/Slugify.md \"wiki/ref | exit 0 ℹ tests 557 ℹ fail 0 ℹ   wiki-compliance-va | commit_wiki_files |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| write_memory_note | Yes | NO | no matching event classified for step 'write_memory_note' |
| index_memory_note | No | NO | no matching event classified for step 'index_memory_note' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| lint_wiki | Yes | NO | no matching event classified for step 'lint_wiki' |
| commit_wiki_files | Yes | NO | no matching event classified for step 'commit_wiki_files' |

**Tool Call Timeline (10 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 1 | Bash | {"command": "cat src/slugify.ts"} | (ran as part of a chain; its output is on the chai | — |
| 2 | Bash | {"command": "ls src wiki/work scripts 2>&1 \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "head -20 CHANGELOG.md"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "cat package.json \| head -40"} | export function slugify(input: string): string {   | — |
| 5 | Bash | {"command": "ls wiki/work/projects \| head; f=$(ls wiki/work/projects/* \| head -1); cat \"$f\"; cat t | Zimi migration.md --- type: project title: Zimi mi | — |
| 6 | Bash | {"command": "git switch -q -c feat/add-slugify && cat > src/slugify.test.ts <<'EOF'\nimport assert f | (Bash completed with no output) | — |
| 7 | Bash | {"command": "node --test src/slugify.test.ts 2>&1 \| tail -15"} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "git status --short"} | ✔ lowercases and trims (1.017207ms) ✔ collapses ru | — |
| 9 | Bash | {"command": "python3 - <<'EOF'\np='CHANGELOG.md'\ns=open(p).read()\ns=s.replace(\"## 2026-10-09\\n\" | 5826c19 feat: add slugify 775b418 Zeemrepo snapsho | — |
