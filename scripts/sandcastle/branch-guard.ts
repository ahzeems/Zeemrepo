import { tryGit } from "../lib/git.ts";

/** Why the loop must not run in `cwd`, or undefined when its branch is a feature branch. */
export function branchRefusal(cwd: string): string | undefined {
  const branch = tryGit(["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd })?.trim() ?? "";
  if (branch === "" || branch === "main") {
    return "Sandcastle merges into the checked-out branch: run it on a feature branch, not main or a detached HEAD.";
  }
  return undefined;
}
