// CLI for the changelog rule. Read-only; run with npm run changelog:guard.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import type { GitOptions } from "../lib/git.ts";
import { CHANGELOG } from "../lib/paths.ts";
import { addedLineNumbers, branchBase, changedSince } from "./branch-diff.ts";
import { changelogRefusals } from "./changelog-validation.ts";

export type Options = { cwd?: string; output?: Output; today?: string };

const USAGE = `Usage: node scripts/changes/changelog-guard.ts [--json]
Requires this branch to add its own ${CHANGELOG} entry, under a date heading between the
day the branch started and today (UTC). Exit: 0 allowed, 1 refused, 2 the check could not run.`;

function refusals(options: Options): string[] {
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const base = branchBase(gitOptions);
  const path = join(options.cwd ?? process.cwd(), CHANGELOG);
  return changelogRefusals({
    changed: changedSince(base.sha, gitOptions),
    addedLines: existsSync(path) ? addedLineNumbers(base.sha, CHANGELOG, gitOptions) : [],
    changelog: existsSync(path) ? readFileSync(path, "utf8") : "",
    window: { from: base.date, to: options.today ?? new Date().toISOString().slice(0, 10) },
  });
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--json")) {
    output.warn("changelog-guard: pass no arguments, or --json. See --help.");
    return EXIT_ERROR;
  }
  const found = refusals(options);
  if (args[0] === "--json") output.write(JSON.stringify({ allowed: found.length === 0, refusals: found }));
  else if (found.length === 0) output.write(`changelog-guard: this branch records its own ${CHANGELOG} entry`);
  else for (const refusal of found) output.warn(`changelog-guard: ${refusal}`);
  return found.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
