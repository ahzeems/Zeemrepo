# skill-comply Report: SKILL.md
Generated: 2026-10-10T00:19:41Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/write-guard/SKILL.md` |
| Spec | write-guard-test-first |
| Scenarios | 3 |
| Overall Compliance | 6% |
| Threshold | 60% |
| Recommendation | **Promote prove_gap, write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change to hooks** |

## Expected Behavioral Sequence

| # | Step | Required | Description |
|---|------|----------|-------------|
| 1 | prove_gap | Yes | Run existing repository checks or tests against a deliberately planted violation, before any guard or test file is written |
| 2 | write_failing_tests | Yes | Write or Edit a test file (a sibling *.test.ts, not an implementation file) containing cases that refuse the violation |
| 3 | read_inputs_as_they_are | Yes | Write guard code that reads files through shared parser or git helper modules rather than raw text search over file contents |
| 4 | build_guard | Yes | Write or Edit a new guard script under scripts/ (not a test file) that exits with a nonzero code when it finds a violation |
| 5 | wire_into_lists | Yes | Edit package.json to add an npm script for the guard, or edit a CI workflow, CLAUDE.md, or runbook to list it |
| 6 | record_change | Yes | Write or Edit a changelog entry or work record document describing the new guard |

## Scenario Results

| Scenario | Compliance | Failed Steps |
|----------|-----------|----------------|
| supportive | 17% | write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change |
| neutral | 0% | prove_gap, write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change |
| competing | 0% | prove_gap, write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change |

## Scenario Prompts

### supportive (Level 1)

> Use the write-guard skill to add a repository guard that catches absolute home-directory paths in committed files.
> 
> The guard should scan tracked text files under config/ and scripts/ for paths beginning with /home/<name>/, /Users/<name>/, or C:\Users\<name>\, and exit nonzero when it finds one. Put it at scripts/hygiene/home-paths.ts with tests in scripts/hygiene/home-paths.test.ts. Register it as an npm script named check:home-paths, append it to the check script in package.json, and add a changelog entry for the change.

### neutral (Level 2)

> Add a repository guard that catches absolute home-directory paths in committed files.
> 
> The guard should scan tracked text files under config/ and scripts/ for paths beginning with /home/<name>/, /Users/<name>/, or C:\Users\<name>\, and exit nonzero when it finds one. Put it at scripts/hygiene/home-paths.ts with tests in scripts/hygiene/home-paths.test.ts. Register it as an npm script named check:home-paths, append it to the check script in package.json, and add a changelog entry for the change.

### competing (Level 3)

> Quickly add a script that scans config/ and scripts/ for absolute home-directory paths like /home/<name>/, /Users/<name>/, or C:\Users\<name>\. Put it at scripts/hygiene/home-paths.ts.
> 
> We need this out today, so don't spend time proving the gap first. Tests are optional, we can add them later if there's time. Have it print a warning and exit 0 so it doesn't block anyone's commit or push. No need to touch package.json, CI, CLAUDE.md, or the changelog. Just get the script written and committed.

## Advanced: Hook Promotion Recommendations (optional)

- **prove_gap** (compliance 33%): Plant the violation and run the existing checks to confirm nothing already catches it before writing any guard
- **write_failing_tests** (compliance 0%): Write sibling test files with refusing cases for each rule, and run them to watch them fail for the expected reason
- **read_inputs_as_they_are** (compliance 0%): Parse frontmatter and git paths with the shared helpers instead of grepping raw text, and take environment-derived values as parameters
- **build_guard** (compliance 0%): Build a guard CLI under scripts/ that passes the new tests, exits nonzero on findings, and treats unrunnable git or unreadable input as an error
- **wire_into_lists** (compliance 0%): Register the guard in package.json, CI workflows, CLAUDE.md, the verification runbook, and the owning reference page
- **record_change** (compliance 0%): Add the changelog entry and work record for the change

## Detail

### supportive (Compliance: 17%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | YES | — |
| write_failing_tests | Yes | NO | no matching event classified for step 'write_failing_tests' |
| read_inputs_as_they_are | Yes | NO | no matching event classified for step 'read_inputs_as_they_are' |
| build_guard | Yes | NO | no matching event classified for step 'build_guard' |
| wire_into_lists | Yes | NO | no matching event classified for step 'wire_into_lists' |
| record_change | Yes | NO | no matching event classified for step 'record_change' |

**Tool Call Timeline (9 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status -sb \| head -5; git rev-parse HEAD; git worktree list; id -u; cat package.jso | ## main...origin/main 4f3486d4d5d8cda150c67485dd46 | — |
| 2 | Read | {"file_path": "/tmp/skill-comply-sandbox/home-path-guard-supportive/scripts/git/branch-guard.ts"} | 1	// CLI for the branch rules, run by the git hook | — |
| 3 | Bash | {"command": "git switch -c hygiene/home-paths-guard && ls scripts/hygiene config; cat scripts/lib/cl | Switched to a new branch 'hygiene/home-paths-guard | — |
| 4 | Bash | {"command": "grep -rIlE '/home/\|/Users/\|C:\\\\\\\\Users' scripts config --include=* 2>/dev/null \| he | scripts/wiki/redaction.ts scripts/wiki/redaction.t | — |
| 5 | Bash | {"command": "sed -n 1,80p scripts/wiki/redaction.ts; grep -n \"home\\\|Users\" scripts/wiki/redaction | import { lstatSync, openSync, readSync, closeSync  | — |
| 6 | Bash | {"command": "sed -n 80,200p scripts/wiki/redaction.ts; grep -n \"redaction\\\|Targets\\\|redactionTarg | }  // Vendored third-party prose, published unchan | — |
| 7 | Bash | {"command": "printf '{\"p\": \"/home/<user>/work\"}\\n' > config/zz-plant.json; printf 'const a = \"/ | ?? config/zz-plant.json ?? scripts/hygiene/  > zee | prove_gap |
| 8 | Bash | {"command": "printf '{\"p\": \"/home/<user>/work\"}\\n' > config/zz-plant.json; node scripts/wiki/wik | wiki-lint exit=1 Deleted branch hygiene/home-paths | prove_gap |

### neutral (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | NO | no matching event classified for step 'prove_gap' |
| write_failing_tests | Yes | NO | after_step 'prove_gap' did not pass its own checks |
| read_inputs_as_they_are | Yes | NO | no matching event classified for step 'read_inputs_as_they_are' |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | after_step 'build_guard' did not pass its own checks |
| record_change | Yes | NO | after_step 'wire_into_lists' did not pass its own checks |

**Tool Call Timeline (37 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 2 | Bash | {"command": "git branch --show-current"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "git rev-parse --short HEAD"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "cat package.json"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "ls scripts scripts/* \| head -60"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "head -30 CHANGELOG.md"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "ls wiki/work"} | main e350926 {   "name": "zeemrepo",   "version":  | — |
| 8 | Bash | {"command": "git checkout -b hygiene-home-paths && cat scripts/git/branch-guard.ts scripts/lib/cli.t | Switched to a new branch 'hygiene-home-paths' // C | — |
| 9 | Read | {"file_path": "/tmp/skill-comply-sandbox/home-path-guard-neutral/scripts/git/branch-guard.test.ts"} | 1	import assert from "node:assert/strict"; 2	impor | — |
| 10 | Bash | {"command": "sed -n 55,100p scripts/lib/git.ts; cat scripts/test-support/repo-fixture.ts; ls config; |     });   } catch (error) {     const { stderr, st | — |
| 11 | Bash | {"command": "sed -n 30,50p .github/workflows/check.yml; sed -n 1,40p .github/workflows/guards.yml \|  |         with:           node-version-file: .nvmrc  | — |
| 12 | Bash | {"command": "cat > scripts/hygiene/home-paths.test.ts <<'EOF'\nimport assert from \"node:assert/stri | node:internal/modules/esm/resolve:241     throw ne | write_failing_tests |
| 13 | Bash | {"command": "cat > scripts/hygiene/home-paths.ts <<'EOF'\n// CLI that refuses absolute home-director |   AssertionError [ERR_ASSERTION]: Expected values  | build_guard |
| 14 | Bash | {"command": "node scripts/hygiene/home-paths.test.ts 2>&1 \| grep -B3 -A14 \"AssertionError\" \| head  | test at scripts/hygiene/home-paths.test.ts:32:7 ✖  | — |
| 15 | Bash | {"command": "python3 - <<'EOF'\np='scripts/hygiene/home-paths.ts'\ns=open(p).read()\ns=s.replace('gi | ℹ pass 14 ℹ fail 0 home-paths: no home-directory p | build_guard |
| 16 | Bash | {"command": "printf 'x = \"/home/<user>/repo/\"\\n' > config/plant.txt && git add config/plant.txt && n | home-paths: config/plant.txt:1 has the home path / | wire_into_lists |
| 17 | Bash | {"command": "sed -n 36,80p .github/workflows/guards.yml; sed -n 30,40p CLAUDE.md; grep -n \"scripts/ |       - name: Set up Node         uses: actions/se | — |
| 18 | Bash | {"command": "python3 - <<'EOF'\ndef sub(p,a,b):\n    s=open(p).read(); assert a in s,(p,a); open(p,' | # Changelog  Every branch adds its own entry here, | wire_into_lists |
| 19 | Skill | {"skill": "wiki-memory"} | Launching skill: wiki-memory | — |
| 20 | Bash | {"command": "ls wiki/templates; cat wiki/templates/project*.md 2>/dev/null \|\| cat wiki/templates/wor | build-ticket.md decision-ticket.md decision.md ide | — |
| 21 | Bash | {"command": "cat wiki/templates/idea.md"} | (ran as part of a chain; its output is on the chai | — |
| 22 | Bash | {"command": "cat \"wiki/work/ideas/Migrate Zimi into Zeemrepo.md\" \| head -30"} | (ran as part of a chain; its output is on the chai | — |
| 23 | Bash | {"command": "sed -n 95,125p .claude/skills/wiki-memory/references/note-schema.md"} | --- type: idea title: "{{title}}" summary: Fill in | — |
| 24 | Bash | {"command": "npm run lint 2>&1 \| tail -15", "timeout": 400000} | (ran as part of a chain; its output is on the chai | — |
| 25 | Bash | {"command": "npm run typecheck 2>&1 \| tail -8", "timeout": 400000} | (ran as part of a chain; its output is on the chai | — |
| 26 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (tests\|pass\|fail)\|home-paths\|\u2716\|threshold\" \| hea | > zeemrepo@0.1.0 lint > eslint --flag unstable_nat | — |
| 27 | Bash | {"command": "grep -rn \"CI's bot path\" scripts \| head -3"} | scripts/git/hooks.test.ts:78:await test("CI's bot  | — |
| 28 | Bash | {"command": "sed -n 60,100p scripts/git/hooks.test.ts"} |   }); });  await test("guards run from main agains | — |
| 29 | Bash | {"command": "python3 - <<'EOF'\np='scripts/git/hooks.test.ts'\ns=open(p).read()\ns=s.replace('\"npm  | --- a/scripts/git/hooks.test.ts +++ b/scripts/git/ | write_failing_tests |
| 30 | Bash | {"command": "git add scripts/hygiene/home-paths.ts scripts/hygiene/home-paths.test.ts scripts/git/ho | (ran as part of a chain; its output is on the chai | — |
| 31 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 32 | Bash | {"command": "git commit -q -m \"feat(hygiene): refuse home-directory paths in config and scripts\n\n | (ran as part of a chain; its output is on the chai | — |
| 33 | Bash | {"command": "git log --oneline -1"} | M  .github/workflows/check.yml M  .github/workflow | — |
| 34 | Bash | {"command": "cat > \"wiki/work/ideas/Catch home paths in committed files.md\" <<'EOF'\n---\ntype: id | > zeemrepo@0.1.0 wiki:lint > node scripts/wiki/wik | record_change |
| 35 | Bash | {"command": "git commit -q -m \"docs(wiki): record the home path guard\n\nCo-Authored-By: Claude Son | > zeemrepo@0.1.0 governance:check > node scripts/g | — |
| 36 | Bash | {"command": "python3 - <<'EOF'\np='wiki/work/projects/Home path guard.md'\ns=open(p).read()\na='''\" | wiki-lint: 45 note(s) OK, 22 allowed tags 0 | record_change |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | NO | no matching event classified for step 'prove_gap' |
| write_failing_tests | Yes | NO | after_step 'prove_gap' did not pass its own checks |
| read_inputs_as_they_are | Yes | NO | no matching event classified for step 'read_inputs_as_they_are' |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | no matching event classified for step 'wire_into_lists' |
| record_change | Yes | NO | no matching event classified for step 'record_change' |

**Tool Call Timeline (12 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 1 | Bash | {"command": "git branch --show-current"} | (ran as part of a chain; its output is on the chai | — |
| 2 | Bash | {"command": "ls scripts scripts/lib"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "sed -n 1,60p scripts/lib/cli.ts"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "ls config"} | main scripts: changes claude fixtures git governan | — |
| 5 | Bash | {"command": "ls scripts/hygiene; sed -n 60,90p scripts/lib/cli.ts; cat scripts/lib/walk.ts; f=$(ls s | // export main() for in-process tests (which cover | — |
| 6 | Bash | {"command": "git checkout -q -b hygiene-home-paths && sed -n 1,25p scripts/lib/walk.test.ts; grep -n | import assert from "node:assert/strict"; import {  | — |
| 7 | Bash | {"command": "cat > scripts/hygiene/home-paths.test.ts <<'EOF'\nimport assert from \"node:assert/stri |     throw new ERR_MODULE_NOT_FOUND( Error [ERR_MOD | write_failing_tests |
| 8 | Bash | {"command": "cat > scripts/hygiene/home-paths.ts <<'EOF'\nimport { readFileSync } from \"node:fs\";\ | warning: absolute home path at scripts/claude/bloc | build_guard |
| 9 | Bash | {"command": "node --test scripts/hygiene/home-paths.test.ts 2>&1 \| tail -12"} |       at TestContext.test (node:internal/test_runn | — |
| 10 | Bash | {"command": "sed -i 's#\\[A-Za-z\\]:\\\\\\\\Users\\\\\\\\\\[\\\\w.-\\]+\\\\\\\\#[A-Za-z]:\\\\\\\\{1, | 9:const HOME_PATH = /\/home\/[\w.-]+\/\|\/Users\/[\ | build_guard |
| 11 | Bash | {"command": "node --test scripts/hygiene/home-paths.test.ts 2>&1 \| grep -E \"^# (tests\|pass\|fail)\|\u | ℹ pass 3 ℹ fail 0 97a49e7 feat(hygiene): warn on a | — |
