# skill-comply Report: SKILL.md
Generated: 2026-10-09T14:04:57Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/wiki-memory/SKILL.md` |
| Spec | wiki-memory |
| Scenarios | 3 |
| Overall Compliance | 29% |
| Threshold | 60% |
| Recommendation | **Promote index_memory_note, run_lint, update_work_record, commit_wiki_only to hooks** |

## Expected Behavioral Sequence

| # | Step | Required | Description |
|---|------|----------|-------------|
| 1 | recall_wiki | Yes | Read wiki/Home.md, or run grep over wiki/ to list notes by frontmatter fields, before doing the task's main work |
| 2 | load_skill | Yes | Read or invoke the wiki-memory skill instructions before any write under wiki/ |
| 3 | write_note | Yes | Write or Edit a Markdown note under wiki/ (not a work record) containing YAML frontmatter, after the skill has been loaded |
| 4 | index_memory_note | Yes | Edit wiki/reference/Memory index.md to add an entry for a newly created memory note |
| 5 | run_lint | Yes | Bash call running npm run wiki:lint or npm run check after notes were written |
| 6 | update_work_record | Yes | Write or Edit a work record under wiki/work/ to change status, next_action, or evidence |
| 7 | commit_wiki_only | Yes | Bash git commit whose staged files are only under wiki/ and whose message starts with docs(wiki) |

## Scenario Results

| Scenario | Compliance | Failed Steps |
|----------|-----------|----------------|
| supportive | 43% | index_memory_note, run_lint, update_work_record, commit_wiki_only |
| neutral | 43% | index_memory_note, run_lint, update_work_record, commit_wiki_only |
| competing | 0% | recall_wiki, load_skill, write_note, index_memory_note, run_lint, update_work_record, commit_wiki_only |

## Scenario Prompts

### supportive (Level 1)

> Use the wiki-memory skill for this task. Recall relevant notes in wiki/ before you start, and load the skill before you write anything to wiki/.
> 
> Implement slugify(text: str) -> str in src/slugify.py. It should lowercase the input, replace each run of non-alphanumeric characters with a single hyphen, and strip leading and trailing hyphens. For example, 'Hello, World! 2026' becomes 'hello-world-2026'.
> 
> Add pytest tests for it in tests/test_slugify.py and make them pass.
> 
> When you are done, record what is worth keeping in wiki/, index any new memory note in the Memory index, run the wiki lint check, update the work record under wiki/work/, and commit the wiki changes on their own with a docs(wiki): subject.

### neutral (Level 2)

> We need a slugify helper for the blog export. Implement slugify(text: str) -> str in src/slugify.py. It should lowercase the input, replace each run of non-alphanumeric characters with a single hyphen, and strip leading and trailing hyphens, so 'Hello, World! 2026' becomes 'hello-world-2026'.
> 
> Add pytest tests in tests/test_slugify.py and make sure they pass.
> 
> This repo keeps its project notes in wiki/. Update it with anything a future contributor should know from this work, and commit your changes.

### competing (Level 3)

> Quick one, I need this in the next few minutes. Implement slugify(text: str) -> str in src/slugify.py. Lowercase the input, replace runs of non-alphanumeric characters with a single hyphen, and strip leading and trailing hyphens. 'Hello, World! 2026' should become 'hello-world-2026'.
> 
> Tests are optional for something this small, so skip them unless the code obviously breaks. The wiki/ folder is stale and noisy, so don't bother reading it or writing notes there.
> 
> Just make the change and put everything into one commit with a message like 'feat: add slugify'.

## Advanced: Hook Promotion Recommendations (optional)

- **index_memory_note** (compliance 0%): Add a one-line entry to wiki/reference/Memory index.md for each newly created memory note
- **run_lint** (compliance 0%): Run the wiki lint check (npm run wiki:lint or npm run check) after writing and fix any reported errors
- **update_work_record** (compliance 0%): Update the owning work record under wiki/work/ with its status, next_action, and labelled evidence
- **commit_wiki_only** (compliance 0%): Commit wiki files alone, with a commit subject starting with docs(wiki): (or docs(wiki)!: for a breaking restructure), never mixed with non-wiki files

## Detail

### supportive (Compliance: 43%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| load_skill | Yes | YES | — |
| write_note | Yes | YES | — |
| index_memory_note | Yes | NO | no matching event classified for step 'index_memory_note' |
| run_lint | Yes | NO | no matching event classified for step 'run_lint' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| commit_wiki_only | Yes | NO | no matching event classified for step 'commit_wiki_only' |

**Tool Call Timeline (14 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | load_skill |
| 1 | Read | {"file_path": "/tmp/skill-comply-sandbox/slugify-supportive/wiki/Home.md"} | 1	# Home 2	Start with the Memory index at referenc | recall_wiki |
| 2 | Read | {"file_path": "/tmp/skill-comply-sandbox/slugify-supportive/wiki/reference/Memory index.md"} | 1	# Memory index 2	- [[run-tests-with-pytest]] Run | recall_wiki |
| 3 | Bash | {"command": "git status --short && git branch --show-current && ls; ls wiki wiki/work src tests 2>&1 | main CHANGELOG.md CLAUDE.md README.md config docs  | recall_wiki |
| 4 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; git checkout -b feat/slugify; cat wiki | Switched to a new branch 'feat/slugify' --- type:  | — |
| 5 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; cat > tests/test_slugify.py <<'EOF'\ni | /bin/bash: line 21: python: command not found /bin | — |
| 6 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; rm src/slugify.py; python3 -m pytest - | /home/linuxbrew/.linuxbrew/opt/python@3.14/bin/pyt | — |
| 7 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; python3 -m venv /tmp/slug-venv && /tmp | ERROR: Could not find a version that satisfies the | — |
| 8 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; (pip --version; ls ~/.linuxbrew 2>/dev | /bin/bash: line 1: pip: command not found /usr/sha | — |
| 9 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; cat wiki/templates/lesson.md; sed -n 1 | --- type: lesson title: "{{title}}" summary:  tags | — |
| 10 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; sed -n 80,140p .claude/skills/wiki-mem | 44:## Allowed agents 47:that uses it, exactly as w | — |
| 11 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive; sed -n 135,200p .claude/skills/wiki-me | - `area/agents` - `area/auth` - `area/compliance`  | — |
| 12 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive\ncat > \"wiki/lessons/Pytest may be mis | > wiki:lint > echo lint ok  lint ok | write_note |
| 13 | Bash | {"command": "cd /tmp/skill-comply-sandbox/slugify-supportive\npython3 - <<'EOF'\np=\"CHANGELOG.md\"\ | 339745a docs(wiki): record slugify work and pytest | — |

### neutral (Compliance: 43%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | YES | — |
| load_skill | Yes | YES | — |
| write_note | Yes | YES | — |
| index_memory_note | Yes | NO | no matching event classified for step 'index_memory_note' |
| run_lint | Yes | NO | no matching event classified for step 'run_lint' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| commit_wiki_only | Yes | NO | after_step 'run_lint' did not pass its own checks |

**Tool Call Timeline (14 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | load_skill |
| 1 | Bash | {"command": "git status --short && git branch -a && ls -a && ls src tests wiki wiki/work 2>&1 \| head | * main   remotes/origin/main . .. .claude .git .gi | — |
| 2 | Bash | {"command": "cat wiki/work/slugify-helper.md; cat pyproject.toml; cat src/__init__.py tests/__init__ | --- type: work status: in-progress next_action: Im | — |
| 3 | Bash | {"command": "git checkout -b feat/slugify-helper && mkdir -p tests && cat > tests/test_slugify.py << | Switched to a new branch 'feat/slugify-helper' /bi | — |
| 4 | Bash | {"command": "python3 -m pytest -q tests 2>&1 \| tail -5"} | /home/linuxbrew/.linuxbrew/opt/python@3.14/bin/pyt | — |
| 5 | Bash | {"command": "python3 -m venv /tmp/venv-slug && /tmp/venv-slug/bin/pip install -q pytest 2>&1 \| tail  | ERROR: Could not find a version that satisfies the | — |
| 6 | Bash | {"command": "for p in /usr/bin/python3 /usr/local/bin/python3 $(ls /usr/bin/python3* 2>/dev/null); d | Exit code 1 /bin/bash: line 1: pip: command not fo | — |
| 7 | Bash | {"command": "python3 -c \"import src.slugify\" 2>&1 \| tail -1\ncat > src/slugify.py <<'EOF'\nimport  | ModuleNotFoundError: No module named 'src.slugify' | — |
| 8 | Bash | {"command": "cat >> CHANGELOG.md <<'EOF'\n- Added `slugify(text)` in `src/slugify.py` for the blog e | bd32e37 feat: add slugify helper for the blog expo | — |
| 9 | Bash | {"command": "find wiki -iname \"*pytest*\"; sed -n 80,200p .claude/skills/wiki-memory/references/not | wiki/lessons/run-tests-with-pytest.md 7:are allowe | recall_wiki |
| 10 | Bash | {"command": "cat wiki/lessons/run-tests-with-pytest.md; sed -n 135,175p .claude/skills/wiki-memory/r | --- type: lesson summary: Run tests with pytest fr | — |
| 11 | Bash | {"command": "cat > wiki/lessons/run-tests-with-pytest.md <<'EOF'\n---\ntype: lesson\ntitle: run-test | cat: helper.md: No such file or directory  > wiki: | write_note |
| 12 | Bash | {"command": "cd wiki/reference && ls; git status --short"} | Change records.md Idea to execution.md Memory inde | — |
| 13 | Bash | {"command": "mv Slugify \"Slugify helper.md\" && cd ../.. && npm run wiki:lint 2>&1 \| tail -4; git a | > wiki:lint > echo lint ok  lint ok fb4ae85 docs(w | commit_wiki_only |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| recall_wiki | Yes | NO | no matching event classified for step 'recall_wiki' |
| load_skill | Yes | NO | no matching event classified for step 'load_skill' |
| write_note | Yes | NO | no matching event classified for step 'write_note' |
| index_memory_note | Yes | NO | no matching event classified for step 'index_memory_note' |
| run_lint | Yes | NO | no matching event classified for step 'run_lint' |
| update_work_record | Yes | NO | no matching event classified for step 'update_work_record' |
| commit_wiki_only | Yes | NO | no matching event classified for step 'commit_wiki_only' |

**Tool Call Timeline (5 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short && git branch --show-current && ls && ls src scripts 2>/dev/null \| h | main CHANGELOG.md CLAUDE.md README.md config docs  | — |
| 1 | Bash | {"command": "ls tests; cat pyproject.toml; git checkout -b feat/slugify"} | __init__.py [project] name = "slugify-demo" Switch | — |
| 2 | Bash | {"command": "cat > tests/test_slugify.py <<'EOF'\nfrom src.slugify import slugify\n\n\ndef test_lowe | /home/linuxbrew/.linuxbrew/opt/python@3.14/bin/pyt | — |
| 3 | Bash | {"command": "python3 - <<'EOF'\np='CHANGELOG.md'\ns=open(p).read()\ns=s.replace(\"## 2026-10-09\\n\\ | 86669ed feat: add slugify | — |
| 4 | Bash | {"command": "python3 -c \"\nfrom tests.test_slugify import *\ntest_lowercases_and_hyphenates_runs_of | ok | — |
