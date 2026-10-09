import { git, gitLines, gitPaths, mergeBase, type GitOptions } from "../lib/git.ts";

// The change guards judge the branch as it stands: commits since the fork point plus the
// index and working tree. pre-commit cannot see the commit it is about to create, so judging
// only the committed range would refuse the very commit that satisfies the rule. With a
// clean tree (in CI) this reduces to the committed range.

export type Base = { sha: string; date: string };

/** The fork point from main and its commit date in UTC. */
export function branchBase(options: GitOptions = {}): Base {
  const sha = mergeBase(options);
  const date = new Date(git(["show", "-s", "--format=%cI", sha], options)).toISOString().slice(0, 10);
  return { sha, date };
}

/** Paths changed since the base: commits, index and tracked working-tree edits; both sides of renames. */
export function changedSince(base: string, options: GitOptions = {}): string[] {
  return gitPaths(["diff", "--name-only", "--no-renames", base], options);
}

/** Lines added to the given paths since the base. */
export function addedLines(base: string, paths: readonly string[], options: GitOptions = {}): string[] {
  if (paths.length === 0) return [];
  return gitLines(["diff", "--unified=0", "--no-renames", base, "--", ...paths], options)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}
