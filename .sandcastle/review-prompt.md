# TASK

Review the code changes on branch `{{BRANCH}}` at commit `{{CANDIDATE}}` and give a verdict. You are read-only: you judge this exact commit and change nothing. Only a passing verdict for `{{CANDIDATE}}` lets the coordinator merge it; any commit you make on the branch voids your review and holds the issue until a fresh reviewer reviews the new tip.

# CONTEXT

## Branch diff

!`git diff {{BASE}}...{{CANDIDATE}}`

## Commits on this branch

!`git log {{BASE}}..{{CANDIDATE}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Note, as reasons in your verdict, opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

4. **Maintain balance**: Do not suggest over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Judge against the coding standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserved functionality**: A refactor in the change must not alter what the code did before. All original features, outputs, and behaviors must remain intact.

# EXECUTION

1. Run the tests and type checking (`npm run typecheck`, `npm run test`) to see whether the commit works. Do not edit, stage, commit, stash, reset, rebase or push anything, and never use `--no-verify`.
2. Fail the review when a correctness, test or security problem from step 3 remains, or the change does not do what its commits say. Style suggestions alone do not fail it.
3. End your answer with exactly one verdict block, JSON inside the tags, naming the full commit you reviewed. The coordinator reads only the last block and holds the issue when it is missing, malformed or names another commit:

<review>{"verdict": "<pass or fail>", "sha": "<the full commit you reviewed>", "reason": "<one sentence>"}</review>

Replace each placeholder: `"verdict"` is `"pass"` or `"fail"` (with the reasons when it fails), and `"sha"` is `{{CANDIDATE}}`, written out in full. A verdict that names any other commit holds the issue.

Then output <promise>COMPLETE</promise>.
