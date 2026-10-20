# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

Each branch passed review at its current tip. Merge only these branches, and do not add commits to them: the coordinator checks afterwards that this branch holds each reviewed commit and that no branch moved, and reports any other result as not integrated.

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, keep the lines from both sides and change nothing else (a work record edited by two branches is the common case: keep both sides' lines). Do not rewrite code or text while resolving a conflict.
3. Run `npm run typecheck` and `npm run test` after each merge.
4. If they fail, make the fix in a separate commit after the merge commit, with its own `<type>: <description>` subject, never inside the merge commit, then run them again. If they still fail, stop and do not comment on that branch's issue.

Follow `CLAUDE.md` and `.claude/rules/zeem/`. Never use `--no-verify`. Never push. Never rebase or force-push. Stage files by name.

# COMMENT ON ISSUES

Do not close any issue. An item is done only when the owner merges its pull request.

For each branch that was merged and whose typecheck and tests pass, leave a comment with the following command:

`gh issue comment -R Zimfra/software_testing <ID> --body "Branch <branch> was merged into the integration branch. It is not landed until the owner merges a pull request."`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
