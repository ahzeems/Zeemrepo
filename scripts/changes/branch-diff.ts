import { git, gitLines, gitPaths, mergeBase, type GitOptions } from "../lib/git.ts";

// The change guards judge the branch as it stands: commits since the fork point plus the
// index, the working tree and untracked files. pre-commit cannot see the commit it is about
// to create, so judging only the committed range would refuse the very commit that satisfies
// the rule. With a clean tree (in CI) this reduces to the committed range.

export type Base = { sha: string; date: string };

const utcDate = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/**
 * The fork point from main, and the day the branch started in UTC: the earlier of the fork
 * point's commit date and the first own commit's author date. Author dates survive a rebase,
 * so moving the branch onto a newer main does not move its changelog window.
 */
export function branchBase(options: GitOptions = {}): Base {
  const sha = mergeBase(options);
  const dates = [git(["show", "-s", "--format=%cI", sha], options), ...gitLines(["log", "--format=%aI", `${sha}..HEAD`], options)].map(utcDate);
  return { sha, date: dates.reduce((earliest, date) => (date < earliest ? date : earliest)) };
}

/** Paths changed since the base: commits, index, working tree and untracked (not ignored) files. */
export function changedSince(base: string, options: GitOptions = {}): string[] {
  const tracked = gitPaths(["diff", "--name-only", "--no-renames", base], options);
  const untracked = gitPaths(["ls-files", "--others", "--exclude-standard"], options);
  return [...new Set([...tracked, ...untracked])];
}

function diffLines(base: string, paths: readonly string[], options: GitOptions): string[] {
  return gitLines(["diff", "--unified=0", "--no-renames", base, "--", ...paths], options).map((line) => line.replace(/\r$/, ""));
}

/** Lines added to the given paths since the base. */
export function addedLines(base: string, paths: readonly string[], options: GitOptions = {}): string[] {
  if (paths.length === 0) return [];
  return diffLines(base, paths, options).filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1));
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** 1-based positions, in the file as it stands, of lines added since the base. */
export function addedLineNumbers(base: string, path: string, options: GitOptions = {}): number[] {
  return diffLines(base, [path], options).flatMap((line) => {
    const hunk = HUNK.exec(line);
    if (!hunk) return [];
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    return Array.from({ length: count }, (_, offset) => start + offset);
  });
}
