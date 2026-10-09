// CLI for the repo-memory rule. Read-only; run with npm run memory:guard.
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import type { GitOptions } from "../lib/git.ts";
import { WORK_DIR } from "../lib/paths.ts";
import { addedLines, branchBase, changedSince } from "./branch-diff.ts";
import { memoryRefusals } from "./repo-memory-validation.ts";

export type Options = { cwd?: string; output?: Output };

const USAGE = `Usage: node scripts/changes/repo-memory-guard.ts [--json]
Requires this branch to record itself in the wiki: a work record under ${WORK_DIR} with labelled
evidence and a changed status or next action, and an operating document when workflow-critical
files change. Exit: 0 recorded, 1 refused, 2 the check could not run.`;

function refusals(options: Options): { changed: number; refusals: string[] } {
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const base = branchBase(gitOptions);
  const changed = changedSince(base.sha, gitOptions);
  const records = changed.filter((file) => file.startsWith(WORK_DIR));
  return { changed: changed.length, refusals: memoryRefusals(changed, addedLines(base.sha, records, gitOptions)) };
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--json")) {
    output.warn("repo-memory-guard: pass no arguments, or --json. See --help.");
    return EXIT_ERROR;
  }
  const found = refusals(options);
  if (args[0] === "--json") output.write(JSON.stringify({ recorded: found.refusals.length === 0, ...found }));
  else if (found.refusals.length === 0) output.write("repo-memory-guard: the wiki records this branch");
  else for (const refusal of found.refusals) output.warn(`repo-memory-guard: ${refusal}`);
  return found.refusals.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
