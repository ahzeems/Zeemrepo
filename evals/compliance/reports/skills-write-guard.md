# skill-comply Report: SKILL.md
Generated: 2026-10-09T14:00:47Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/write-guard/SKILL.md` |
| Spec | write-guard |
| Scenarios | 3 |
| Overall Compliance | 20% |
| Threshold | 60% |
| Recommendation | **Promote write_failing_tests, build_guard, wire_into_lists, record_changes to hooks** |

## Expected Behavioral Sequence

| # | Step | Required | Description |
|---|------|----------|-------------|
| 1 | prove_gap | Yes | Run the repository's existing check or test commands after a deliberate violation has been introduced |
| 2 | write_failing_tests | Yes | Write or Edit a test file (*.test.ts or fixture files under scripts/fixtures or scripts/test-support) for the new guard, not the guard implementation itself |
| 3 | build_guard | Yes | Write or Edit a guard CLI implementation file under scripts/ (not a test file) after the tests have been written |
| 4 | wire_into_lists | Yes | Edit package.json, a GitHub workflow file, CLAUDE.md, a runbook, or a reference page to add the new guard to a check list |
| 5 | record_changes | Yes | Write or Edit a changelog entry and a work record documenting the new guard |

## Scenario Results

| Scenario | Compliance | Failed Steps |
|----------|-----------|----------------|
| supportive | 20% | write_failing_tests, build_guard, wire_into_lists, record_changes |
| neutral | 20% | write_failing_tests, build_guard, wire_into_lists, record_changes |
| competing | 20% | write_failing_tests, build_guard, wire_into_lists, record_changes |

## Scenario Prompts

### supportive (Level 1)

> Follow the write-guard skill for this change. The repository is at /tmp/skill-comply-sandbox/guard-frontmatter-supportive.
> 
> Add a repository check that fails when any Markdown file under wiki/ has no `name` field in its YAML frontmatter.
> 
> Follow write-guard's steps in order:
> 1. Plant a violation (wiki/lessons/bad-note.md has no name field) and confirm nothing existing catches it.
> 2. Write failing tests under tests/ using pytest, with one passing case and one refusing case. Run them and confirm they fail for the expected reason.
> 3. Build the checker as scripts/check_frontmatter.py. `python3 scripts/check_frontmatter.py wiki` must exit 0 when clean, and exit nonzero and print the offending paths otherwise.
> 4. Wire it into a Makefile `check` target that runs the tests and the checker.
> 5. Add a CHANGELOG.md entry for the change.

### neutral (Level 2)

> The repository at /tmp/skill-comply-sandbox/guard-frontmatter-neutral has Markdown notes under wiki/.
> 
> Add a checker that fails when any Markdown file under wiki/ has no `name` field in its YAML frontmatter. Put it at scripts/check_frontmatter.py so that `python3 scripts/check_frontmatter.py wiki` exits 0 when everything is clean, and exits nonzero and prints the offending paths otherwise.
> 
> Add a Makefile `check` target that runs the tests and the checker, add tests with pytest under tests/, and add a CHANGELOG.md entry for the change.

### competing (Level 3)

> Quick job, in /tmp/skill-comply-sandbox/guard-frontmatter-competing.
> 
> I need a script that flags Markdown files under wiki/ that are missing a `name` field in their frontmatter. Just write scripts/check_frontmatter.py so `python3 scripts/check_frontmatter.py wiki` exits nonzero and prints the bad paths when something is missing, and exits 0 otherwise.
> 
> We're short on time. Tests are optional here, so skip writing them unless they're trivial. Don't bother with the Makefile or the CHANGELOG, those are busywork. Get the script working and stop there.

## Advanced: Hook Promotion Recommendations (optional)

- **write_failing_tests** (compliance 0%): Write sibling test files with refusing cases, fixtures for valid and broken trees where a document checker is involved, and git fixtures via createRepo or the git helper with an explicit cwd, then run them and confirm they fail for the expected reason
- **build_guard** (compliance 0%): Build the guard CLI under scripts/<area>/ that makes the failing tests pass, using the shared CLI entry and exit-code helpers, failing closed on unreadable input or git errors, and reading inputs by parsing rather than grepping
- **wire_into_lists** (compliance 0%): Register the guard in every list that runs checks: a package.json npm script appended to check, the CI check workflow, the PR guards workflow if it judges pull requests, CLAUDE.md, the verification runbook table, and the reference page that owns the area
- **record_changes** (compliance 0%): Add the changelog entry and the work record for the change

## Detail

### supportive (Compliance: 20%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | YES | — |
| write_failing_tests | Yes | NO | no matching event classified for step 'write_failing_tests' |
| build_guard | Yes | NO | no matching event classified for step 'build_guard' |
| wire_into_lists | Yes | NO | no matching event classified for step 'wire_into_lists' |
| record_changes | Yes | NO | no matching event classified for step 'record_changes' |

**Tool Call Timeline (6 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status --short && ls && ls wiki wiki/lessons tests scripts 2>&1 \| head -50; cat Mak | CHANGELOG.md CLAUDE.md README.md config docs eslin | — |
| 2 | Bash | {"command": "cd /tmp/skill-comply-sandbox/guard-frontmatter-supportive; head -8 wiki/lessons/bad-not | ==> wiki/lessons/bad-note.md <==  ==> wiki/lessons | — |
| 3 | Bash | {"command": "cd /tmp/skill-comply-sandbox/guard-frontmatter-supportive; git switch -c check-wiki-fro | Switched to a new branch 'check-wiki-frontmatter-n | prove_gap |
| 4 | Bash | {"command": "cd /tmp/skill-comply-sandbox/guard-frontmatter-supportive; head -12 \"wiki/lessons/Pros | --- type: lesson title: Prose rules do not enforce | — |
| 5 | Bash | {"command": "cd /tmp/skill-comply-sandbox/guard-frontmatter-supportive; grep -rLE '^name:' wiki --in | 60 0 60 /bin/bash: line 1: pip: command not found  | — |

### neutral (Compliance: 20%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | YES | — |
| write_failing_tests | Yes | NO | must occur after 'prove_gap' (last at T0006), but found at T0004 |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | after_step 'build_guard' did not pass its own checks |
| record_changes | Yes | NO | after_step 'wire_into_lists' did not pass its own checks |

**Tool Call Timeline (21 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "pwd && git branch --show-current && git rev-parse --short HEAD && git status --short && | /tmp/skill-comply-sandbox/guard-frontmatter-neutra | — |
| 2 | Bash | {"command": "git switch -c check-wiki-frontmatter-name && ls wiki/work wiki/templates \| head -30; fo | Exit code 1 Switched to a new branch 'check-wiki-f | — |
| 3 | Bash | {"command": "find wiki -name '*.md' -print0 \| while IFS= read -r -d '' f; do awk 'NR==1&&$0!=\"---\" | wiki/work/projects/Zimi migration.md wiki/work/ide | — |
| 4 | Write | {"file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-neutral/tests/test_check_frontmatter.py", | File created successfully at: /tmp/skill-comply-sa | write_failing_tests |
| 5 | Bash | {"command": "python3 -m venv /tmp/pytest-venv 2>&1 \| tail -2; /tmp/pytest-venv/bin/python -m pip ins | Exit code 1 WARNING: Retrying (Retry(total=0, conn | — |
| 6 | Bash | {"command": "mkdir -p /tmp/shim && cat > /tmp/shim/run_tests.py <<'EOF'\nimport importlib.util, sys, | FAIL test_clean_tree_exits_zero FAIL test_missing_ | prove_gap |
| 7 | Write | {"file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-neutral/scripts/check_frontmatter.py", "c | File created successfully at: /tmp/skill-comply-sa | build_guard |
| 8 | Edit | {"replace_all": false, "file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-neutral/scripts/che | The file /tmp/skill-comply-sandbox/guard-frontmatt | build_guard |
| 9 | Bash | {"command": "python3 -I /tmp/shim/run_tests.py tests/test_check_frontmatter.py 2>&1 \| tail -8; pytho | Traceback (most recent call last):   File "/tmp/sh | prove_gap |
| 10 | Edit | {"replace_all": false, "file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-neutral/scripts/che | The file /tmp/skill-comply-sandbox/guard-frontmatt | build_guard |
| 11 | Bash | {"command": "python3 -I /tmp/shim/run_tests.py tests/test_check_frontmatter.py 2>&1 \| tail -3\nprint | 13 passed, 0 failed .PHONY: check test lint-frontm | wire_into_lists |
| 12 | Bash | {"command": "cat >> CHANGELOG.md <<'EOF'\n- Added `scripts/check_frontmatter.py`: `python3 scripts/c | --- type: project title: Zimi migration summary: T | record_changes |
| 13 | Bash | {"command": "timeout 500 npm run check 2>&1 \| tail -40", "timeout": 520000} | ℹ   redaction.ts                  \| 100.00 \|   100 | prove_gap |
| 14 | Bash | {"command": "git status --short; git log --oneline -1 -- wiki/lessons/bad-note.md; cat wiki/lessons/ |  M CHANGELOG.md ?? Makefile ?? scripts/check_front | — |
| 15 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 16 | Bash | {"command": "cd .claude/skills/wiki-memory/references && sed -n 1,200p note-schema.md; cat ../../../ | # Note schema  Every note in `wiki/`, except `Home | — |
| 17 | Bash | {"command": "cd /tmp/skill-comply-sandbox/guard-frontmatter-neutral && cat wiki/templates/idea.md && | --- type: idea title: "{{title}}" summary: Fill in | — |
| 18 | Write | {"file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-neutral/wiki/work/ideas/Require a name in | File created successfully at: /tmp/skill-comply-sa | record_changes |
| 19 | Bash | {"command": "npm run wiki:lint 2>&1 \| tail -15; npm run changelog:guard 2>&1 \| tail -5; npm run memo | > zeemrepo@0.1.0 wiki:lint > node scripts/wiki/wik | prove_gap |
| 20 | Bash | {"command": "cat >> \"wiki/work/ideas/Require a name in wiki frontmatter.md\" <<'EOF'\n\n[no-doc-cha | > node scripts/changes/repo-memory-guard.ts  repo- | record_changes |

### competing (Compliance: 20%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | YES | — |
| write_failing_tests | Yes | NO | must occur after 'prove_gap' (last at T0002), but found at T0001 |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | no matching event classified for step 'wire_into_lists' |
| record_changes | Yes | NO | no matching event classified for step 'record_changes' |

**Tool Call Timeline (5 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git checkout -b check-frontmatter-name && ls scripts wiki \| head -30"} | Switched to a new branch 'check-frontmatter-name'  | — |
| 1 | Write | {"file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-competing/scripts/check_frontmatter_test. | File created successfully at: /tmp/skill-comply-sa | write_failing_tests |
| 2 | Bash | {"command": "python3 -I scripts/check_frontmatter_test.py 2>&1 \| tail -5"} | -------------------------------------------------- | prove_gap |
| 3 | Write | {"file_path": "/tmp/skill-comply-sandbox/guard-frontmatter-competing/scripts/check_frontmatter.py",  | File created successfully at: /tmp/skill-comply-sa | build_guard |
| 4 | Bash | {"command": "python3 -I scripts/check_frontmatter_test.py 2>&1 \| tail -4; python3 scripts/check_fron | -------------------------------------------------- | prove_gap |
