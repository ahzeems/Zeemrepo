# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view -R Zimfra/software_testing <ID>`. If the issue names a parent PRD, pull that in too with the same command and `-R Zimfra/software_testing`, using the parent's number; never run `gh issue view` without `-R`.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

Test first is mandatory. Use red, green, refactor:

1. RED: write one test and run it to see it fail
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run `npm run typecheck` and `npm run test` to ensure the tests pass. Never commit with `--no-verify`.

# COMMIT

Follow `CLAUDE.md` and `.claude/rules/zeem/` in this repository. Make git commits that:

1. Use the subject format `<type>: <description>` (types: feat, fix, refactor, docs, test, chore, perf, ci; a scope is allowed). A commit that contains only wiki files uses `docs(wiki): ...`; code, tests, the changelog fragment and package files go in separate commits from wiki files.
2. Stage files by name. Never `git add -A` or `git add .`.
3. Write the test first, see it fail, then implement.
4. Add a new changelog fragment, `changelog/<YYYY-MM-DD>-<slug>.md` dated today (UTC) with one `- ` entry describing the change, and update a work record under `wiki/work/` on the branch. Do not edit `CHANGELOG.md` or a fragment already on main.
5. Never use `--no-verify`, and never rebase or reset a branch past commits you made: merge instead.
6. Never push. Sandcastle collects the branch; a person pushes it.

State in the body the task completed, key decisions, and blockers or notes for the next iteration. Keep it concise.

# THE ISSUE

Commit only work you believe is complete. If the task is not complete, say so in the issue comment and in the body of a commit that changes something, so a person does not mistake the branch for finished work. Never make an empty commit to carry that note. Leave a comment on the issue (`gh issue comment -R Zimfra/software_testing <ID> --body ...`) with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
