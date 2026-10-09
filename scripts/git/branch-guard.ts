// CLI for the branch rules, run by the git hooks. Read-only.
//   commit: refuses a commit on main (pre-commit)
//   push:   reads git's ref updates on stdin and refuses pushes to main, rewrites of a
//           published branch and deletions of unlanded branches (pre-push)
import { readFileSync } from "node:fs";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { GitError, isAncestor, tryGit, type GitOptions } from "../lib/git.ts";
import { commitRefusals, pushRefusals, type PushUpdate } from "./branch-policy.ts";

export type Options = { cwd?: string; output?: Output; stdin?: string };

const USAGE = `Usage: node scripts/git/branch-guard.ts <commit|push>
push reads git's pre-push ref updates on stdin. Exit: 0 allowed, 1 refused, 2 the check could not run.`;

export function parsePushInput(input: string): PushUpdate[] {
  return input.split(/\r?\n/).filter((line) => line.trim() !== "").map((line) => {
    const [localRef = "", localOid = "", remoteRef = "", remoteOid = ""] = line.trim().split(/\s+/);
    return { localRef, localOid, remoteRef, remoteOid };
  });
}

// Missing objects and divergent history both read as "not an ancestor", so the push is
// refused rather than allowed when this checkout cannot tell.
function ancestry(options: GitOptions) {
  return (ancestor: string, descendant: string): boolean => {
    try {
      return isAncestor(ancestor, descendant, options);
    } catch (error) {
      if (error instanceof GitError) return false;
      throw error;
    }
  };
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const [mode, ...rest] = args;
  if (mode === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (rest.length > 0 || (mode !== "commit" && mode !== "push")) {
    output.warn("branch-guard: pass commit or push. See --help.");
    return EXIT_ERROR;
  }
  const refusals = mode === "commit"
    ? commitRefusals(tryGit(["symbolic-ref", "--quiet", "HEAD"], gitOptions))
    : pushRefusals(parsePushInput(options.stdin ?? readFileSync(0, "utf8")), ancestry(gitOptions));
  for (const refusal of refusals) output.warn(`branch-guard: ${refusal}`);
  return refusals.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
