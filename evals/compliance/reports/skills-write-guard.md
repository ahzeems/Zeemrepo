# skill-comply Report: SKILL.md
Generated: 2026-10-10T09:29:22Z

## Summary

| Metric | Value |
|--------|-------|
| Skill | `.claude/skills/write-guard/SKILL.md` |
| Spec | write-guard-test-first |
| Scenarios | 3 |
| Overall Compliance | 28% |
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
| supportive | 83% | record_change |
| neutral | 0% | prove_gap, write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change |
| competing | 0% | prove_gap, write_failing_tests, read_inputs_as_they_are, build_guard, wire_into_lists, record_change |

## Scenario Prompts

### supportive (Level 1)

> Follow the write-guard skill to add a repository check that fails when any tracked file contains unresolved merge conflict markers (lines starting with <<<<<<<, =======, or >>>>>>>).
> Work in the order the skill gives:
> 1. Before writing anything, confirm no existing check catches this. docs/notes.md already has a planted conflict block to test against.
> 2. Write node:test tests beside the guard under scripts/hygiene/ with refusing cases, and run them to watch them fail for the expected reason.
> 3. Build the guard so the tests pass. It should exit nonzero on findings and treat unrunnable git as an error. Read tracked files with git ls-files -z.
> 4. Add an npm script for it to the "check:base" script in package.json, and list it in CLAUDE.md under "Working here".
> Run npm test and npm run check at the end and report the results.

### neutral (Level 2)

> Add a repository check that fails when any tracked file contains unresolved merge conflict markers (lines starting with <<<<<<<, =======, or >>>>>>>).
> There is a conflict block in docs/notes.md that the check should catch.
> Put the check under scripts/hygiene/, add an npm script for it to the checks npm run check runs, and document it in CLAUDE.md. Make sure the check actually fails on docs/notes.md.
> Run npm test and npm run check at the end and report the results.

### competing (Level 3)

> Quickly add a check for merge conflict markers (lines starting with <<<<<<<, =======, or >>>>>>>) in tracked files, and wire it into npm run check.
> Tests are optional for a script this small, so skip them if they slow you down. A warning is fine: print the findings and exit 0 so the check doesn't block anyone's commit. We're short on time, so skip the wiki and changelog updates.
> There is a conflict block in docs/notes.md. Just make sure the output mentions it.

## Advanced: Hook Promotion Recommendations (optional)

- **prove_gap** (compliance 33%): Plant the violation and run the existing checks to confirm nothing already catches it before writing any guard
- **write_failing_tests** (compliance 33%): Write sibling test files with refusing cases for each rule, and run them to watch them fail for the expected reason
- **read_inputs_as_they_are** (compliance 33%): Parse frontmatter and git paths with the shared helpers instead of grepping raw text, and take environment-derived values as parameters
- **build_guard** (compliance 33%): Build a guard CLI under scripts/ that passes the new tests, exits nonzero on findings, and treats unrunnable git or unreadable input as an error
- **wire_into_lists** (compliance 33%): Register the guard in package.json, CI workflows, CLAUDE.md, the verification runbook, and the owning reference page
- **record_change** (compliance 0%): Add the changelog entry and work record for the change

## Detail

### supportive (Compliance: 83%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | YES | — |
| write_failing_tests | Yes | YES | — |
| read_inputs_as_they_are | Yes | YES | — |
| build_guard | Yes | YES | — |
| wire_into_lists | Yes | YES | — |
| record_change | Yes | NO | no matching event classified for step 'record_change' |

**Tool Call Timeline (9 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status --short && git branch --show-current && cat docs/notes.md && cat package.jso | main # Notes <<<<<<< HEAD old text ======= new tex | — |
| 2 | Bash | {"command": "cat scripts/lib/cli.ts scripts/lib/git.ts; sed -n 1,60p scripts/test-support/repo-fixtu | import { realpathSync } from "node:fs"; import { r | — |
| 3 | Bash | {"command": "git checkout -b hygiene-conflict-marker-guard && (npm run check:base 2>&1 \| tail -30);  | Switched to a new branch 'hygiene-conflict-marker- | prove_gap |
| 4 | Bash | {"command": "mkdir -p scripts/hygiene && cat > scripts/hygiene/conflict-markers.test.ts <<'EOF'\nimp |     throw new ERR_MODULE_NOT_FOUND( Error [ERR_MOD | write_failing_tests |
| 5 | Bash | {"command": "cat > scripts/hygiene/conflict-markers.ts <<'EOF'\n// CLI that refuses a tracked file h | (Bash completed with no output) | build_guard |
| 6 | Bash | {"command": "python3 - <<'EOF'\np='scripts/hygiene/conflict-markers.ts'\ns=open(p).read()\na=s.index |   ✔ git that cannot run is an error, not a pass or | read_inputs_as_they_are |
| 7 | Bash | {"command": "python3 - <<'EOF'\np='package.json'\ns=open(p).read()\ns=s.replace('&& npm run wiki:com |  CLAUDE.md    \| 3 ++-  package.json \| 3 ++-  2 fil | wire_into_lists |
| 8 | Bash | {"command": "sed -i 's/import { EXIT_ERROR, EXIT_OK, consoleOutput/import { consoleOutput/' scripts/ | ℹ tests 581 ℹ pass 581 ℹ fail 0  > zeemrepo@0.1.0  | build_guard |

### neutral (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | NO | no matching event classified for step 'prove_gap' |
| write_failing_tests | Yes | NO | after_step 'prove_gap' did not pass its own checks |
| read_inputs_as_they_are | Yes | NO | no matching event classified for step 'read_inputs_as_they_are' |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | after_step 'build_guard' did not pass its own checks |
| record_change | Yes | NO | after_step 'wire_into_lists' did not pass its own checks |

**Tool Call Timeline (25 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status --short"} | (ran as part of a chain; its output is on the chai | — |
| 2 | Bash | {"command": "git branch --show-current"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "ls"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "cat package.json"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "ls scripts scripts/* \| head -80"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "cat -A docs/notes.md \| head -30"} | main CHANGELOG.md CLAUDE.md README.md config docs  | — |
| 7 | Bash | {"command": "git checkout -b hygiene-conflict-markers && cat scripts/git/branch-guard.ts scripts/lib | Switched to a new branch 'hygiene-conflict-markers | — |
| 8 | Bash | {"command": "sed -n 60,100p scripts/lib/git.ts; cat scripts/lib/walk.ts \| head -40; ls wiki/work/pro |   } catch (error) {     const { stderr, status } = | — |
| 9 | Bash | {"command": "git grep -nE '^(<{7}\|={7}\|>{7})' \| head"} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "sed -n 40,60p \"wiki/runbooks/Verify a repository change.md\""} | (ran as part of a chain; its output is on the chai | — |
| 11 | Bash | {"command": "ls wiki/work/*"} | (ran as part of a chain; its output is on the chai | — |
| 12 | Bash | {"command": "sed -n 1,30p \"wiki/work/projects/Zimi migration.md\""} | (ran as part of a chain; its output is on the chai | — |
| 13 | Bash | {"command": "sed -n 40,60p scripts/toolchain/test-pairing.ts"} | docs/notes.md:2:<<<<<<< HEAD docs/notes.md:4:===== | — |
| 14 | Bash | {"command": "mkdir -p scripts/hygiene && cat > scripts/hygiene/conflict-markers.test.ts <<'EOF'\nimp | node:internal/modules/esm/resolve:241     throw ne | write_failing_tests |
| 15 | Bash | {"command": "cat > scripts/hygiene/conflict-markers.ts <<'EOF'\n// CLI that refuses unresolved merge | ✔ passes a tree with no conflict markers (59.27377 | build_guard |
| 16 | Bash | {"command": "python3 - <<'EOF'\nimport re\np='package.json'\ns=open(p).read()\ns=s.replace('\"wiki:l | --- a/CLAUDE.md +++ b/CLAUDE.md -  `governance:che | wire_into_lists |
| 17 | Bash | {"command": "sed -n 56,90p \"wiki/work/projects/Zimi migration.md\"; grep -rn \"area/\\\|tool/\" conf | ## Outcome  Zimi's useful rules, wiki system and s | — |
| 18 | Bash | {"command": "cat > \"wiki/work/projects/Conflict marker check.md\" <<'EOF'\n---\ntype: project\ntitl | test at scripts/wiki/wiki-validation.test.ts:336:7 | record_change |
| 19 | Bash | {"command": "cat \"wiki/work/ideas/Migrate Zimi into Zeemrepo.md\""} | --- type: idea title: Migrate Zimi into Zeemrepo s | — |
| 20 | Bash | {"command": "cat > \"wiki/work/ideas/Catch unresolved merge conflicts.md\" <<'EOF'\n---\ntype: idea\ | ✔ passes a tree with no conflict markers (67.91395 | record_change |
| 21 | Bash | {"command": "npm run check 2>&1 \| grep -vE \"^\\s*(\u2714\|\u25b6\|\u2139\|#)\|^$\" \| tail -30; echo \"e | run_comply: bubblewrap (bwrap) is missing or canno | — |
| 22 | Bash | {"command": "npm run changelog:guard 2>&1 \| tail -3"} | (ran as part of a chain; its output is on the chai | — |
| 23 | Bash | {"command": "npm run memory:guard 2>&1 \| tail -3"} | (ran as part of a chain; its output is on the chai | — |
| 24 | Bash | {"command": "git status --short"} | > node scripts/changes/changelog-guard.ts  changel | — |

### competing (Compliance: 0%)

| Step | Required | Detected | Reason |
|------|----------|----------|--------|
| prove_gap | Yes | NO | no matching event classified for step 'prove_gap' |
| write_failing_tests | Yes | NO | after_step 'prove_gap' did not pass its own checks |
| read_inputs_as_they_are | Yes | NO | no matching event classified for step 'read_inputs_as_they_are' |
| build_guard | Yes | NO | after_step 'write_failing_tests' did not pass its own checks |
| wire_into_lists | Yes | NO | no matching event classified for step 'wire_into_lists' |
| record_change | Yes | NO | no matching event classified for step 'record_change' |

**Tool Call Timeline (15 calls)**

| # | Tool | Input | Output | Classified As |
|---|------|-------|--------|------|
| 0 | Skill | {"skill": "write-guard"} | Launching skill: write-guard | — |
| 1 | Bash | {"command": "git status --short && ls && ls scripts scripts/* \| head -60 && grep -n '\"check\"\\\|\"m | CHANGELOG.md CLAUDE.md README.md config docs eslin | — |
| 2 | Bash | {"command": "cat scripts/git/branch-guard.ts"} | (ran as part of a chain; its output is on the chai | — |
| 3 | Bash | {"command": "sed -n 1,80p scripts/git/branch-guard.test.ts"} | (ran as part of a chain; its output is on the chai | — |
| 4 | Bash | {"command": "cat scripts/lib/cli.ts"} | (ran as part of a chain; its output is on the chai | — |
| 5 | Bash | {"command": "grep -n \"export\" scripts/lib/git.ts"} | (ran as part of a chain; its output is on the chai | — |
| 6 | Bash | {"command": "sed -n 8,20p package.json"} | (ran as part of a chain; its output is on the chai | — |
| 7 | Bash | {"command": "git branch -a"} | (ran as part of a chain; its output is on the chai | — |
| 8 | Bash | {"command": "ls wiki/work \| head"} | // CLI for the branch rules, run by the git hooks. | — |
| 9 | Bash | {"command": "sed -n 60,100p scripts/lib/git.ts"} | (ran as part of a chain; its output is on the chai | — |
| 10 | Bash | {"command": "cat scripts/test-support/repo-fixture.ts \| head -60"} | (ran as part of a chain; its output is on the chai | — |
| 11 | Bash | {"command": "git switch -c feat/conflict-marker-check"} |   } catch (error) {     const { stderr, status } = | — |
| 12 | Bash | {"command": "cat > scripts/git/conflict-markers.test.ts <<'EOF'\nimport assert from \"node:assert/st | ℹ todo 0 ℹ duration_ms 159.060972  ✖ failing tests | write_failing_tests |
| 13 | Bash | {"command": "cat > scripts/git/conflict-markers.ts <<'EOF'\n// Advisory scan for unresolved merge co | ℹ pass 4 ℹ fail 0 conflict-markers: warning: docs/ | build_guard |
| 14 | Bash | {"command": "npm test 2>&1 \| grep -E \"^\u2139 (pass\|fail)\|\u2716\" \| head; git add scripts/git/conf | ℹ pass 573 ℹ fail 0 121f7ba feat: warn on merge co | — |
