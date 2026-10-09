// CLI for governance alignment. Read-only; run with npm run governance:check.
//
// One question: do the files that declare how this repository works still agree with how it
// works? A workflow change that leaves a skill, rule, doc or script asserting the old rule is
// incomplete, and a search by hand does not reliably catch it.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { walk } from "../lib/walk.ts";
import { checkGovernance, configProblems, globToRegExp, readConfig, type Config, type Result } from "./governance-validation.ts";

export type Options = { output?: Output };

const CONFIG = "config/governance-alignment.json";
const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/governance/governance-guard.ts [--json] [--root <repository>]";
// Never authored here: git internals, installed dependencies and other checkouts. Only at
// the root; a node_modules folder anywhere else is scanned like any other.
const ROOT_SKIPPED = new Set([".git", "node_modules", ".worktrees"]);

type Args = { json: boolean; root: string; help: boolean };

function parseArgs(args: readonly string[]): Args {
  const parsed: Args = { json: false, root: REPOSITORY, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--json") parsed.json = true;
    else if (arg === "--help") parsed.help = true;
    else if (arg === "--root" && args[index + 1] !== undefined) parsed.root = resolve(args[++index] ?? "");
    else throw new Error(USAGE);
  }
  return parsed;
}

function repositoryFiles(root: string): { files: string[]; symlinks: string[] } {
  const found: { files: string[]; symlinks: string[] } = { files: [], symlinks: [] };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (ROOT_SKIPPED.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) found.symlinks.push(path);
    else if (entry.isFile()) found.files.push(path);
    else if (entry.isDirectory()) {
      const nested = walk(path, { includeDot: true, skipDirs: new Set([".git"]) });
      found.files.push(...nested.files);
      found.symlinks.push(...nested.symlinks);
    }
  }
  const rel = (file: string): string => relative(root, file).split("\\").join("/");
  return { files: found.files.map(rel), symlinks: found.symlinks.map(rel) };
}

type Scan = Result & { scanned: string[]; excluded: number; symlinks: string[]; emptySurfaces: string[]; emptyExclusions: string[] };

function scan(root: string, config: Config): Scan {
  const { files, symlinks } = repositoryFiles(root);
  const exclusions = config.exclude.map((entry) => ({ glob: entry.glob, re: globToRegExp(entry.glob) }));
  const isExcluded = (path: string): boolean => exclusions.some(({ re }) => re.test(path));
  const surfaces = config.surfaces.map((surface) => ({ surface, re: globToRegExp(surface) }));
  const candidates = files.filter((path) => !isExcluded(path));
  const texts = candidates.filter((path) => surfaces.some(({ re }) => re.test(path)))
    .map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }))
    .filter(({ text }) => !text.includes("\0")).sort((a, b) => a.path.localeCompare(b.path));
  return {
    ...checkGovernance(texts, config),
    scanned: texts.map(({ path }) => path),
    excluded: files.length - candidates.length,
    symlinks: symlinks.filter((path) => !isExcluded(path)),
    emptySurfaces: surfaces.filter(({ re }) => !candidates.some((path) => re.test(path))).map(({ surface }) => surface),
    emptyExclusions: exclusions.filter(({ re }) => !files.some((path) => re.test(path))).map(({ glob }) => glob),
  };
}

function reportDrift(found: Scan, output: Output): void {
  for (const violation of found.violations) output.warn(`  x ${violation.path}:${violation.line} [${violation.claim}] ${violation.text}`);
  for (const link of found.symlinks) output.warn(`  x ${link}: symbolic link; not scanned, replace it with the file`);
  for (const allowance of found.unusedAllowances) output.warn(`  x ${allowance.path}: allowed wording "${allowance.contains}" no longer appears; remove the allowance`);
  for (const surface of found.emptySurfaces) output.warn(`  x surface "${surface}" matches no file; the check is not looking where it claims to`);
  for (const glob of found.emptyExclusions) output.warn(`  x exclusion "${glob}" matches no file; remove it`);
  output.warn(`governance-guard: ${found.excluded} file(s) excluded. Update the file, or record the wording in ${CONFIG} with a reason.`);
}

function summary(found: Scan): string {
  const history = found.history.length > 0 ? `; ${found.history.length} superseded wiki note(s) read as history` : "";
  return `governance-guard: ${found.scanned.length} file(s) aligned with the operating model; ${found.excluded} file(s) excluded${history}`;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const { json, root, help } = parseArgs(args);
  if (help) {
    output.write(USAGE);
    return EXIT_OK;
  }
  const parsed: unknown = JSON.parse(readFileSync(join(root, CONFIG), "utf8"));
  const problems = configProblems(parsed);
  if (problems.length > 0) {
    if (json) output.write(JSON.stringify({ aligned: false, configProblems: problems }));
    else for (const problem of problems) output.warn(`governance-guard: ${CONFIG}: ${problem}`);
    return EXIT_REFUSED;
  }
  const found = scan(root, readConfig(parsed));
  const aligned = [found.violations, found.symlinks, found.unusedAllowances, found.emptySurfaces, found.emptyExclusions].every((list) => list.length === 0);
  if (json) output.write(JSON.stringify({ aligned, ...found }));
  else if (aligned) output.write(summary(found));
  else reportDrift(found, output);
  return aligned ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
