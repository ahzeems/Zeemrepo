// CLI for the changelog rule. Read-only; run with npm run changelog:guard.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, readMode, runCli, type Output } from "../lib/cli.ts";
import { gitOptionsAt, gitPaths, type GitOptions } from "../lib/git.ts";
import { CHANGELOG_DIR, CHANGELOG_FRAGMENT_PATTERN } from "../lib/paths.ts";
import { atRepositoryRoot, branchBase, changedSince } from "./branch-diff.ts";
import { changelogRefusals, type FragmentChange } from "./changelog-validation.ts";

export type Options = { cwd?: string; output?: Output; today?: string };

const USAGE = `Usage: node scripts/changes/changelog-guard.ts [--json]
Requires this branch to add its own changelog fragment, ${CHANGELOG_DIR}<YYYY-MM-DD>-<slug>.md, dated
between the day the branch started and today (UTC), and refuses changes to fragments already on
main and, once main holds a fragment, to CHANGELOG.md. Exit: 0 allowed, 1 refused, 2 the check
could not run.`;

const STATUS: Record<string, FragmentChange["status"]> = { A: "added", D: "deleted" };

/** Paths under changelog/ that differ from the base (untracked ones are added), with their content. */
function fragmentChanges(base: string, root: string, options: GitOptions): FragmentChange[] {
  const fields = gitPaths(["diff", "--name-status", "--no-renames", base, "--", CHANGELOG_DIR], options);
  const statuses = new Map<string, FragmentChange["status"]>();
  for (let index = 0; index + 1 < fields.length; index += 2) statuses.set(fields[index + 1] ?? "", STATUS[fields[index] ?? ""] ?? "modified");
  for (const path of gitPaths(["ls-files", "--others", "--exclude-standard", "--", CHANGELOG_DIR], options)) statuses.set(path, "added");
  return [...statuses].map(([path, status]) => {
    const file = join(root, path);
    return { path, status, content: status !== "deleted" && existsSync(file) ? readFileSync(file, "utf8") : "" };
  });
}

function refusals(options: Options): string[] {
  const { gitOptions, root } = atRepositoryRoot(gitOptionsAt(options.cwd));
  const base = branchBase(gitOptions);
  return changelogRefusals({
    changed: changedSince(base.sha, gitOptions),
    fragments: fragmentChanges(base.sha, root, gitOptions),
    // The one transition (ADR-0027): until main holds a fragment, the switching branch may also
    // change CHANGELOG.md, where main's older guard still looks for its record.
    baseHasFragment: gitPaths(["ls-tree", "-r", "--name-only", base.sha, "--", CHANGELOG_DIR], gitOptions).some((path) => CHANGELOG_FRAGMENT_PATTERN.test(path)),
    window: { from: base.date, to: options.today ?? new Date().toISOString().slice(0, 10) },
  });
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const parsed = readMode(args, { name: "changelog-guard", usage: USAGE, modes: ["--json"] }, output);
  if ("exit" in parsed) return parsed.exit;
  const found = refusals(options);
  if (parsed.mode === "--json") output.write(JSON.stringify({ allowed: found.length === 0, refusals: found }));
  else if (found.length === 0) output.write("changelog-guard: this branch records its own changelog fragment");
  else for (const refusal of found) output.warn(`changelog-guard: ${refusal}`);
  return found.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
