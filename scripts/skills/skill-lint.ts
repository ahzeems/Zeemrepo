// CLI for the skill library standards. Read-only; run with npm run skills:lint.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { consoleOutput, isEntryPoint, report, runCli, type Output } from "../lib/cli.ts";
import { mergeBase, tryGit } from "../lib/git.ts";
import { BASELINE_PATH, baselineHistoryErrors } from "./provenance.ts";
import { validateSkills } from "./skill-validation.ts";

export type Options = { output?: Output; cwd?: string };

const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/skills/skill-lint.ts [--root <repository>]";

function rootFrom(args: readonly string[], cwd: string | undefined): string {
  if (args.length === 0) return cwd ?? REPOSITORY;
  const [flag, value, ...rest] = args;
  if (flag !== "--root" || value === undefined || rest.length > 0) throw new Error(USAGE);
  return resolve(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Landed provenance is append-only, so the branch's baseline is compared with the one at
// the merge base. No baseline there yet (the PR that introduces it) means nothing to compare.
function historyErrors(root: string): string[] {
  if (tryGit(["rev-parse", "--is-inside-work-tree"], { cwd: root }) !== "true") return [];
  const base = mergeBase({ cwd: root });
  const landed = tryGit(["show", `${base}:./${BASELINE_PATH}`], { cwd: root });
  if (landed === null) return [];
  const currentPath = join(root, BASELINE_PATH);
  const current = existsSync(currentPath) ? parseJson(readFileSync(currentPath, "utf8")) : { skills: [] };
  return baselineHistoryErrors(parseJson(landed), current);
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const root = rootFrom(args, options.cwd);
  const result = validateSkills(root);
  const errors = [...result.errors, ...historyErrors(root)];
  return report(errors.map((error) => `  x ${error}`), `skills-lint: ${result.skillCount} skill(s) OK`, output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
