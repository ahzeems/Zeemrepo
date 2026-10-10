// CLI for the skill library standards. Read-only; run with npm run skills:lint.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { consoleOutput, isEntryPoint, report, rootFrom, runCli, type Output } from "../lib/cli.ts";
import { git, mergeBase, tryGit } from "../lib/git.ts";
import { BASELINE_PATH, baselineHistoryErrors } from "./provenance.ts";
import { validateSkills } from "./skill-validation.ts";

export type Options = { output?: Output; cwd?: string };

const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/skills/skill-lint.ts [--root <repository>]";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Landed provenance is append-only, so the branch's baseline is compared with the one at
// the merge base. Only a baseline that is absent there (the PR that introduces it) means
// there is nothing to compare; failing to read one that exists is an error, never a pass.
function historyErrors(root: string, output: Output): string[] {
  if (tryGit(["rev-parse", "--is-inside-work-tree"], { cwd: root }) !== "true") {
    output.write("skills-lint: not a git checkout; provenance history not checked");
    return [];
  }
  const base = mergeBase({ cwd: root });
  if (git(["ls-tree", "--name-only", base, "--", BASELINE_PATH], { cwd: root }) === "") return [];
  const landed = git(["show", `${base}:./${BASELINE_PATH}`], { cwd: root });
  const currentPath = join(root, BASELINE_PATH);
  const current = existsSync(currentPath) ? parseJson(readFileSync(currentPath, "utf8")) : { skills: [] };
  return baselineHistoryErrors(parseJson(landed), current);
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const root = rootFrom(args, options.cwd ?? REPOSITORY, USAGE);
  const result = validateSkills(root);
  const errors = [...result.errors, ...historyErrors(root, output)];
  return report(errors.map((error) => `  x ${error}`), `skills-lint: ${result.skillCount} skill(s) OK`, output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
