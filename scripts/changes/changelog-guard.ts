// CLI for the changelog rule. Read-only; run with npm run changelog:guard.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, readMode, runCli, type Output } from "../lib/cli.ts";
import { gitOptionsAt } from "../lib/git.ts";
import { CHANGELOG } from "../lib/paths.ts";
import { addedLineNumbers, atRepositoryRoot, branchBase, changedSince } from "./branch-diff.ts";
import { changelogRefusals } from "./changelog-validation.ts";

export type Options = { cwd?: string; output?: Output; today?: string };

const USAGE = `Usage: node scripts/changes/changelog-guard.ts [--json]
Requires this branch to add its own ${CHANGELOG} entry, under a date heading between the
day the branch started and today (UTC). Exit: 0 allowed, 1 refused, 2 the check could not run.`;

function refusals(options: Options): string[] {
  const { gitOptions, root } = atRepositoryRoot(gitOptionsAt(options.cwd));
  const base = branchBase(gitOptions);
  const path = join(root, CHANGELOG);
  return changelogRefusals({
    changed: changedSince(base.sha, gitOptions),
    addedLines: existsSync(path) ? addedLineNumbers(base.sha, CHANGELOG, gitOptions) : [],
    changelog: existsSync(path) ? readFileSync(path, "utf8") : "",
    window: { from: base.date, to: options.today ?? new Date().toISOString().slice(0, 10) },
  });
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const parsed = readMode(args, { name: "changelog-guard", usage: USAGE, modes: ["--json"] }, output);
  if ("exit" in parsed) return parsed.exit;
  const found = refusals(options);
  if (parsed.mode === "--json") output.write(JSON.stringify({ allowed: found.length === 0, refusals: found }));
  else if (found.length === 0) output.write(`changelog-guard: this branch records its own ${CHANGELOG} entry`);
  else for (const refusal of found) output.warn(`changelog-guard: ${refusal}`);
  return found.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
