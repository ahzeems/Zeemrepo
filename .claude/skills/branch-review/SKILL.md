---
name: branch-review
description: "Read-only branch-diff review on standards and spec; records findings, never approves or merges."
---

Two questions, kept apart so a pass on one cannot mask a fail on the other: was it built right
(standards), and is it what was asked for (spec)? Prefer a session other than the one that wrote
the code; a builder does not certify its own work.

## 1. Pin the range

```bash
git fetch origin
HEAD_SHA=$(git rev-parse --verify <target>^{commit})
BASE_SHA=$(git merge-base origin/main "$HEAD_SHA")   # or the base the user names
git log --oneline "$BASE_SHA..$HEAD_SHA"; git diff --stat "$BASE_SHA...$HEAD_SHA"
```

Pass SHAs onward, never branch names: a name resolves differently after a fetch or a merge. Refuse
when a ref does not resolve or the diff is empty, and say why. Uncommitted changes are listed in
the report as not reviewed.

## 2. Find the spec

The Acceptance criteria of the owning wiki work record (a ticket, spec, plan, project or issue
under wiki/work/, the note types validated by scripts/wiki/work-tracking.ts), and the
owner's request. Read committed records at `$HEAD_SHA`. If the acceptance lines differ
between base and head, the branch moved its own goalposts: quote both. With no spec, the
spec axis reports "no spec available" and infers nothing from the code.

## 3. Skip what `npm run check` and PR CI already enforce

Read package.json, eslint.config.ts, and the TypeScript configs for the checks. Neither axis
reports a rule one of those checks enforces. Cite existing command evidence instead (a local
`npm run check` result or the PR's CI checks), when its tree matches, and name any FAIL, SKIP, or missing result. Do not run the checks yourself;
this route is read-only. verify-work runs them separately.

## 4. Run the axes separately

**Standards brief:** the diff, the repository rules in .claude/rules/ (including the design
principles), and the standards for each file kind
touched. Report per file and hunk: a documented rule the diff breaks, citing the file and line; and
design smells, named, with the hunk quoted: mysterious name, duplicated logic, feature envy, data
clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative
generality (an abstraction needs two real consumers), message chains, middle man, refused bequest.
A documented rule is a violation; a smell is a judgement call and the repo's own rules override it.

**Spec brief:** the acceptance lines verbatim and their source. Report acceptance lines missing or
partial, behaviour no line asked for, lines that look implemented but are wrong, and gaps in the
definition of done: code, dependency declarations, documentation and work-record state in the same PR.

Each brief carries: do not start other agents, do not edit or commit, state which model you are,
under 400 words. Run both axes in parallel as two read-only Claude Code Agent calls: the
`ecc:code-reviewer` agent for standards, and a read-only `Explore` or general-purpose agent for spec.
If delegation is unavailable, report the limitation; run in sequence only with owner agreement
and say in the report that they shared one context.

## 5. Report without reranking

Report the pinned range, the spec sources, the check evidence line, the reviewers, what was not
reviewed, then each axis verbatim under its own heading with its count and worst finding. Do not
merge the two lists or name one worst issue overall: that is the reranking the separation prevents.
Every finding is a lead to check against its citation, not a fact.

## 6. Record it

Return the report in the task. After leaving review, post it on the pull request as a review
comment (`gh pr review <n> --comment --body-file <file>`) with the pinned SHAs, reviewer models,
separate findings, and context limits. Never `--approve`.
A review is input to a verdict ([verify-work](../verify-work/SKILL.md)); by itself it approves nothing and merges nothing. Only the owner merges.
