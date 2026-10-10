// Backstop for test fixtures that escape into the real repository. Run from a linked
// worktree, git hands the pre-push hook GIT_DIR, so a test that spawns git without
// scrubbing it would commit to, switch or reconfigure the hooked repository (Zimi lost a
// branch tip and core.bare that way). The hook snapshots this state before
// `npm run check` and refuses the push if the check changed it. It detects; it cannot undo.
// Covered: HEAD, the checked-out branch, core.bare, local and per-worktree config, every ref,
// the index and the working tree. Not covered: global config, hooks, the object store.
// The snapshot holds hashes, never config values, and messages redact config subsections
// (they can hold URLs with tokens), so neither the shell variable nor stderr leaks secrets.
//   snapshot: prints the state as one JSON line
//   verify:   reads a snapshot on stdin and refuses if the state differs
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { GitError, git, type GitOptions } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";

export type Options = { cwd?: string; output?: Output; stdin?: string };

type Config = Record<string, string>;
type GitState = {
  head: string | null; branch: string | null; bare: string | null;
  config: Config; worktreeConfig: Config | null; refs: string; index: string; tree: string;
};

const USAGE = `Usage: node scripts/git/git-state.ts <snapshot|verify>
verify reads a snapshot on stdin. Exit: 0 unchanged, 1 changed, 2 the check could not run.`;

const digest = (text: string): string => createHash("sha256").update(text).digest("hex");

// Exit 1 is git's "not there" for these queries; anything else (a corrupt config or HEAD)
// is an error, so a broken repository stops the push instead of looking unchanged.
function absentOnOne(args: readonly string[], options: GitOptions): string | null {
  try {
    return git(args, options);
  } catch (error) {
    if (error instanceof GitError && error.status === 1) return null;
    throw error;
  }
}

// `config -z` prints "key\nvalue" records separated by NUL, so values may hold newlines.
// Entries are grouped under their redacted key and each group hashed in file order, so the
// snapshot holds neither values nor subsections; core.bare is tracked on its own.
function parseConfig(listing: string): Config {
  const groups = new Map<string, string[][]>();
  for (const entry of listing.split("\0").filter((record) => record.length > 0)) {
    const split = entry.indexOf("\n");
    const key = split === -1 ? entry : entry.slice(0, split);
    if (key === "core.bare") continue;
    const name = redactKey(key);
    groups.set(name, [...(groups.get(name) ?? []), [key, split === -1 ? "" : entry.slice(split + 1)]]);
  }
  return Object.fromEntries([...groups].map(([name, entries]) => [name, digest(JSON.stringify(entries))]));
}

// Read the file directly: with extensions.worktreeConfig set but no file yet,
// `git config --worktree` exits 128.
function worktreeConfig(options: GitOptions): Config | null {
  const path = resolve(options.cwd ?? ".", git(["rev-parse", "--git-path", "config.worktree"], options));
  return existsSync(path) ? parseConfig(git(["config", "--file", path, "--list", "-z"], options)) : null;
}

// A repository flipped to core.bare=true has no work tree for status or ls-files to read;
// the core.bare change itself is the refusal, so those two read as "bare".
const BARE = "bare";

function readState(options: GitOptions = {}): GitState {
  git(["rev-parse", "--git-dir"], options);
  const bare = absentOnOne(["config", "--local", "--get", "core.bare"], options);
  const workTree = bare !== "true";
  return {
    head: absentOnOne(["rev-parse", "--verify", "--quiet", "HEAD"], options),
    branch: absentOnOne(["symbolic-ref", "--quiet", "HEAD"], options),
    bare,
    config: parseConfig(git(["config", "--local", "--list", "-z"], options)),
    worktreeConfig: worktreeConfig(options),
    refs: digest(git(["for-each-ref", "--format=%(refname) %(objectname)"], options)),
    index: workTree ? digest(git(["ls-files", "--stage", "-z"], options)) : BARE,
    tree: workTree ? digest(git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], options)) : BARE,
  };
}

const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isConfig = (value: unknown): value is Config => isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

function parseState(text: string): GitState | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { head, branch, bare, config, worktreeConfig: perWorktree, refs, index, tree } = value;
  if (!nullableString(head) || !nullableString(branch) || !nullableString(bare) || !isConfig(config)) return null;
  if (!(perWorktree === null || isConfig(perWorktree))) return null;
  if (typeof refs !== "string" || typeof index !== "string" || typeof tree !== "string") return null;
  return { head, branch, bare, config, worktreeConfig: perWorktree, refs, index, tree };
}

// section.subsection.variable -> section.<...>.variable: a subsection can be a URL with a token.
export function redactKey(key: string): string {
  const first = key.indexOf(".");
  const last = key.lastIndexOf(".");
  return first === last ? key : `${key.slice(0, first)}.<...>${key.slice(last)}`;
}

function configChanges(label: string, before: Config | null, after: Config | null): string[] {
  const was = before ?? {};
  const now = after ?? {};
  const names = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((name) => was[name] !== now[name]).sort();
  return names.length === 0 ? [] : [`${label} changed: ${names.join(", ")}`];
}

function stateChanges(before: GitState, after: GitState): string[] {
  const changes: string[] = [];
  if (before.head !== after.head) changes.push(`HEAD moved from ${before.head ?? "(none)"} to ${after.head ?? "(none)"}`);
  if (before.branch !== after.branch) changes.push(`the checked-out branch changed from ${before.branch ?? "(detached)"} to ${after.branch ?? "(detached)"}`);
  if (before.bare !== after.bare) changes.push(`core.bare changed from ${before.bare ?? "(unset)"} to ${after.bare ?? "(unset)"}`);
  changes.push(...configChanges("local git config", before.config, after.config));
  changes.push(...configChanges("per-worktree git config", before.worktreeConfig, after.worktreeConfig));
  if (before.refs !== after.refs) changes.push("refs changed (a branch, tag, stash or remote-tracking ref was created, moved or deleted)");
  if (before.index !== after.index) changes.push("the index changed");
  if (before.tree !== after.tree) changes.push("the working tree changed");
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
