// CLI for the repo-memory rule. Read-only; run with npm run memory:guard.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, readMode, runCli, type Output } from "../lib/cli.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { isOperatingDoc } from "../lib/change-policy.ts";
import { git, gitOptionsAt, type GitOptions } from "../lib/git.ts";
import { WORK_DIR } from "../lib/paths.ts";
import { addedLines, atRepositoryRoot, branchBase, changedSince, renamesSince } from "./branch-diff.ts";
import { memoryRefusals, type RecordChange } from "./repo-memory-validation.ts";

export type Options = { cwd?: string; output?: Output };

const USAGE = `Usage: node scripts/changes/repo-memory-guard.ts [--json]
Requires this branch to record itself in the wiki: one work record under ${WORK_DIR} gains
VERIFIED: or OWNER DECISION: evidence and a changed status or next action, and an operating
document gains content when workflow-critical files change. Exit: 0 recorded, 1 refused,
2 the check could not run.`;

const fields = (text: string): RecordChange["after"] => {
  const parsed = parseFrontmatter(text);
  return parsed.kind === "ok" ? parsed.data : null;
};

// The base copy is read only when the base tree has the path; failing to read one that is
// there is an error, never "new record". A renamed record is compared with its old path, so
// moving it does not make the evidence it already had look new.
function recordChange(path: string, basePath: string, base: string, root: string, options: GitOptions): RecordChange {
  const atBase = git(["ls-tree", "--name-only", base, "--", basePath], options) !== "";
  const beforeText = atBase ? git(["show", `${base}:./${basePath}`], options) : "";
  const file = join(root, path);
  const afterText = existsSync(file) ? readFileSync(file, "utf8") : "";
  return { path, before: atBase ? fields(beforeText) : null, after: existsSync(file) ? fields(afterText) : null, beforeText, afterText };
}

function refusals(options: Options): { changed: number; refusals: string[] } {
  const { gitOptions, root } = atRepositoryRoot(gitOptionsAt(options.cwd));
  const base = branchBase(gitOptions);
  const changed = changedSince(base.sha, gitOptions);
  const renames = renamesSince(base.sha, gitOptions);
  const isRecord = (file: string): boolean => file.toLowerCase().startsWith(WORK_DIR) && file.toLowerCase().endsWith(".md");
  // The old side of a rename is not a separate deleted record.
  const records = changed.filter((file) => isRecord(file) && ![...renames.values()].includes(file))
    .map((path) => recordChange(path, renames.get(path) ?? path, base.sha, root, gitOptions));
  const docs = changed.filter(isOperatingDoc);
  const docLines = [...addedLines(base.sha, docs, gitOptions), ...docs.filter((path) => !records.some((record) => record.path === path))
    .filter((path) => git(["ls-tree", "--name-only", base.sha, "--", path], gitOptions) === "" && existsSync(join(root, path)))
    .flatMap((path) => readFileSync(join(root, path), "utf8").split("\n"))];
  return { changed: changed.length, refusals: memoryRefusals({ changed, records, addedOperatingDocLines: docLines }) };
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const parsed = readMode(args, { name: "repo-memory-guard", usage: USAGE, modes: ["--json"] }, output);
  if ("exit" in parsed) return parsed.exit;
  const found = refusals(options);
  if (parsed.mode === "--json") output.write(JSON.stringify({ recorded: found.refusals.length === 0, ...found }));
  else if (found.refusals.length === 0) output.write("repo-memory-guard: the wiki records this branch");
  else for (const refusal of found.refusals) output.warn(`repo-memory-guard: ${refusal}`);
  return found.refusals.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
