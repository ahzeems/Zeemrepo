// CLI for the worktree rules. Read-only; run with npm run worktree:guard before removing a
// checkout. Reports work that exists only on this machine.
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { git, type GitOptions } from "../lib/git.ts";
import { countLines, describeRisk, parseWorktrees, type Risk } from "./worktree-validation.ts";

export type Options = { cwd?: string; output?: Output };

const USAGE = "Usage: node scripts/git/worktree-guard.ts [--json]\nReports worktrees holding uncommitted or unpushed work. Exit: 0 clean, 1 work at risk, 2 the check could not run.";

// Untracked files count: losing an uncommitted note is the failure this guard prevents.
// Any commit not reachable from a remote-tracking ref exists only in this checkout.
function inspect(path: string): Risk {
  const options: GitOptions = { cwd: path };
  return {
    path,
    uncommitted: countLines(git(["status", "--porcelain", "--untracked-files=all"], options)),
    unpushed: countLines(git(["log", "--format=%H", "HEAD", "--not", "--remotes"], options)),
  };
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--json")) {
    output.warn("worktree-guard: pass no arguments, or --json. See --help.");
    return EXIT_ERROR;
  }
  const listing = git(["worktree", "list", "--porcelain", "-z"], options.cwd === undefined ? {} : { cwd: options.cwd });
  const risks = parseWorktrees(`${listing}\0`).filter((worktree) => !worktree.bare).map((worktree) => inspect(worktree.path))
    .filter((risk) => risk.uncommitted > 0 || risk.unpushed > 0);
  if (args[0] === "--json") output.write(JSON.stringify({ safe: risks.length === 0, risks }));
  else if (risks.length === 0) output.write("worktree-guard: every worktree is committed and pushed");
  else {
    for (const risk of risks) output.warn(`worktree-guard: ${describeRisk(risk)}`);
    output.warn("worktree-guard: push this work before removing any checkout.");
  }
  return risks.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
