# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list -R Zimfra/software_testing --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues. Every other
issue is **blocked**. If you cannot tell whether an issue depends on another open issue, treat it as
blocked by that issue: a blocked issue waits for a later run, while a wrongly selected one starts
work that may conflict.

For each unblocked issue, assign a branch name using the exact format `sandcastle/issue-{id}` (no slug or other suffix). This must be deterministic so that re-planning the same issue always produces the same branch name and accumulated progress is preserved.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags, with two lists:

- `issues`: the unblocked issues to work on now, each with `id`, `title` and `branch`.
- `blocked`: every blocked issue, each with `id`, `title` and `blockedBy`, the numbers of the open
  issues blocking it (as strings, never its own number).

An issue appears in exactly one of the two lists. Never move a blocked issue into `issues` to keep
the run busy, even when every issue is blocked: an empty `issues` list is a valid plan, and the run
reports the blocked issues instead of working on them.

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "sandcastle/issue-42"}], "blocked": [{"id": "43", "title": "Add login audit log", "blockedBy": ["42"]}]}
</plan>

Always emit the `<plan>` tags with both lists, even when there is nothing to do. If there are no issues to work on at all, output:

<plan>
{"issues": [], "blocked": []}
</plan>
