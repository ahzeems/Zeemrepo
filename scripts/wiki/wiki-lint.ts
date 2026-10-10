// CLI for the wiki validator. Read-only; run with npm run wiki:lint.
import { join } from "node:path";
import { EXIT_OK, consoleOutput, isEntryPoint, report, rootFrom, runCli, type Output } from "../lib/cli.ts";
import type { Identity } from "./redaction.ts";
import { validateWiki } from "./wiki-validation.ts";

export type Options = { output?: Output; identity?: Identity };

const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/wiki/wiki-lint.ts [--root <repository>]";

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const result = validateWiki(rootFrom(args, REPOSITORY, USAGE), options.identity === undefined ? {} : { identity: options.identity });
  const success = `wiki-lint: ${result.noteCount} note(s) OK, ${result.tagCount} allowed tags`;
  const code = report(result.errors.map((error) => `  x ${error}`), success, output);
  if (code !== EXIT_OK) output.warn(`wiki-lint: ${result.errors.length} problem(s) in ${result.noteCount} note(s)`);
  return code;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
