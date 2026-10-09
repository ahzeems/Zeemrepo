// Backstop for test fixtures that escape into the real repository. Run from a linked
// worktree, git hands the pre-push hook GIT_DIR, so a test that spawns git without
// scrubbing it would commit to, switch or reconfigure the hooked repository (Zimi lost a
// branch tip and core.bare that way). The hook snapshots this state before
// `npm run check` and refuses the push if the check changed it. It detects; it cannot undo.
//   snapshot: prints the state as one JSON line
//   verify:   reads a snapshot on stdin and refuses if the state differs
import { readFileSync } from "node:fs";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { git, tryGit, type GitOptions } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";

export type Options = { cwd?: string; output?: Output; stdin?: string };

type GitState = { head: string | null; branch: string | null; bare: string | null; config: [string, string][] };

const USAGE = `Usage: node scripts/git/git-state.ts <snapshot|verify>
verify reads a snapshot on stdin. Exit: 0 unchanged, 1 changed, 2 the check could not run.`;

// `config -z` prints "key\nvalue" records separated by NUL, so values may hold newlines.
function localConfig(options: GitOptions): [string, string][] {
  const listing = tryGit(["config", "--local", "--list", "-z"], options) ?? "";
  return listing.split("\0").filter((entry) => entry.length > 0).map((entry): [string, string] => {
    const split = entry.indexOf("\n");
    return split === -1 ? [entry, ""] : [entry.slice(0, split), entry.slice(split + 1)];
  }).filter(([key]) => key !== "core.bare").sort(([a], [b]) => a.localeCompare(b));
}

export function readState(options: GitOptions = {}): GitState {
  git(["rev-parse", "--git-dir"], options);
  return {
    head: tryGit(["rev-parse", "--verify", "--quiet", "HEAD"], options),
    branch: tryGit(["symbolic-ref", "--quiet", "HEAD"], options),
    bare: tryGit(["config", "--local", "--get", "core.bare"], options),
    config: localConfig(options),
  };
}

const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isPair = (value: unknown): value is [string, string] =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "string";

function parseState(text: string): GitState | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || !nullableString(value.head) || !nullableString(value.branch) || !nullableString(value.bare)) return null;
  if (!Array.isArray(value.config) || !value.config.every(isPair)) return null;
  return { head: value.head, branch: value.branch, bare: value.bare, config: value.config.filter(isPair) };
}

function keysOf(config: readonly [string, string][]): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const [key, value] of config) keys.set(key, [...(keys.get(key) ?? []), value]);
  return keys;
}

// Key names only: a changed value may be an email or a token.
export function stateChanges(before: GitState, after: GitState): string[] {
  const changes: string[] = [];
  if (before.head !== after.head) changes.push(`HEAD moved from ${before.head ?? "(none)"} to ${after.head ?? "(none)"}`);
  if (before.branch !== after.branch) changes.push(`the checked-out branch changed from ${before.branch ?? "(detached)"} to ${after.branch ?? "(detached)"}`);
  if (before.bare !== after.bare) changes.push(`core.bare changed from ${before.bare ?? "(unset)"} to ${after.bare ?? "(unset)"}`);
  const was = keysOf(before.config);
  const now = keysOf(after.config);
  const keys = [...new Set([...was.keys(), ...now.keys()])].sort();
  const changed = keys.filter((key) => JSON.stringify(was.get(key)) !== JSON.stringify(now.get(key)));
  if (changed.length > 0) changes.push(`local git config changed: ${changed.join(", ")}`);
  return changes;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const [mode, ...rest] = args;
  if (mode === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (rest.length > 0 || (mode !== "snapshot" && mode !== "verify")) {
    output.warn("git-state: pass snapshot or verify. See --help.");
    return EXIT_ERROR;
  }
  if (mode === "snapshot") {
    output.write(JSON.stringify(readState(gitOptions)));
    return EXIT_OK;
  }
  const before = parseState((options.stdin ?? readFileSync(0, "utf8")).trim());
  if (before === null) {
    output.warn("git-state: stdin is not a snapshot from `git-state.ts snapshot`.");
    return EXIT_ERROR;
  }
  const changes = stateChanges(before, readState(gitOptions));
  for (const change of changes) output.warn(`git-state: ${change}`);
  if (changes.length > 0) output.warn("git-state: the check changed this repository's git state. A test probably ran git here instead of in its fixture. Inspect and restore before pushing.");
  return changes.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
