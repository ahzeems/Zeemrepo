// CLI for governance alignment. Read-only; run with npm run governance:check.
//
// One question: do the files that declare how this repository works still agree with how it
// works? A workflow change that leaves a skill, rule, doc or script asserting the old rule is
// incomplete, and a search by hand does not reliably catch it.
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { walk } from "../lib/walk.ts";
import { checkGovernance, configProblems, globToRegExp, readConfig, type Config, type Result } from "./governance-validation.ts";

export type Options = { output?: Output };

const CONFIG = "config/governance-alignment.json";
const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/governance/governance-guard.ts [--json] [--root <repository>]";

function parseArgs(args: readonly string[]): { json: boolean; root: string } {
  let json = false;
  let root = REPOSITORY;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--json") json = true;
    else if (args[index] === "--root" && args[index + 1] !== undefined) root = resolve(args[++index] ?? "");
    else throw new Error(USAGE);
  }
  return { json, root };
}

type Scan = Result & { scanned: string[]; emptySurfaces: string[] };

// Files are walked, not taken from git, so a new file is checked before it is staged.
// Symbolic links are never followed; the governing files are real files.
function scan(root: string, config: Config): Scan {
  const files = walk(root, { includeDot: true, skipDirs: new Set([".git", "node_modules", ".worktrees"]) }).files
    .map((file) => relative(root, file).split("\\").join("/"));
  const excluded = config.exclude.map(globToRegExp);
  const candidates = files.filter((path) => !excluded.some((rule) => rule.test(path)));
  const matchers = config.surfaces.map((surface) => ({ surface, re: globToRegExp(surface) }));
  const emptySurfaces = matchers.filter(({ re }) => !candidates.some((path) => re.test(path))).map(({ surface }) => surface);
  const scanned = candidates.filter((path) => matchers.some(({ re }) => re.test(path))).sort();
  const surfaces = scanned.map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
  return { ...checkGovernance(surfaces, config), scanned, emptySurfaces };
}

function reportDrift(found: Scan, output: Output): void {
  for (const violation of found.violations) output.warn(`  x ${violation.path}:${violation.line} [${violation.claim}] ${violation.text}`);
  for (const allowance of found.unusedAllowances) output.warn(`  x ${allowance.path}: allowed wording "${allowance.contains}" no longer appears; remove the allowance`);
  for (const surface of found.emptySurfaces) output.warn(`  x surface "${surface}" matches no file; the check is not looking where it claims to`);
  output.warn(`governance-guard: update the file, or record the wording in ${CONFIG} with a reason.`);
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const { json, root } = parseArgs(args);
  const parsed: unknown = JSON.parse(readFileSync(join(root, CONFIG), "utf8"));
  const problems = configProblems(parsed);
  if (problems.length > 0) {
    if (json) output.write(JSON.stringify({ aligned: false, configProblems: problems }));
    else for (const problem of problems) output.warn(`governance-guard: ${CONFIG}: ${problem}`);
    return EXIT_REFUSED;
  }
  const found = scan(root, readConfig(parsed));
  const aligned = found.violations.length === 0 && found.unusedAllowances.length === 0 && found.emptySurfaces.length === 0;
  if (json) output.write(JSON.stringify({ aligned, ...found }));
  else if (aligned) output.write(`governance-guard: ${found.scanned.length} declared surface(s) aligned with the operating model`);
  else reportDrift(found, output);
  return aligned ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
