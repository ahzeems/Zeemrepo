// Backstop for test fixtures that escape into the real repository. Run from a linked
// worktree, git hands the pre-push hook GIT_DIR, so a test that spawns git without
// scrubbing it would commit to, switch or reconfigure the hooked repository (a branch tip
// and core.bare have been lost that way). The hook snapshots this state before
// `npm run check` and refuses the push if the check changed it. It detects; it cannot undo.
// Covered: HEAD, the checked-out branch, core.bare, local and per-worktree config, every ref,
// the index and the working tree: what git status lists, plus the bytes, executable bit or
// symlink target of each path it lists, so rewriting an already-dirty file is caught. A directory
// listed as one entry (a nested repository, a submodule) is not looked into. Not covered: global config, hooks, the object store, and
// branch.<name>.vscode-merge-base, which the VS Code Git extension writes when it sees a new
// branch, often while the hook's check runs; git never reads it (owner decision, 2026-10-17).
// The snapshot holds hashes, never config values, and messages redact config subsections
// (they can hold URLs with tokens), so neither the shell variable nor stderr leaks secrets.
//   snapshot: prints the state as one JSON line
//   verify:   reads a snapshot on stdin and refuses if the state differs
import { createHash } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readlinkSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { GitError, git, gitOptionsAt, type GitOptions } from "../lib/git.ts";
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

const EDITOR_KEY = /^branch\..+\.vscode-merge-base$/;

// `config -z` prints "key\nvalue" records separated by NUL, so values may hold newlines.
// Entries are grouped under their redacted key and each group hashed in file order, so the
// snapshot holds neither values nor subsections; core.bare is tracked on its own, and VS Code's
// merge-base keys are skipped.
function parseConfig(listing: string): Config {
  const groups = new Map<string, string[][]>();
  for (const entry of listing.split("\0").filter((record) => record.length > 0)) {
    const split = entry.indexOf("\n");
    const key = split === -1 ? entry : entry.slice(0, split);
    if (key === "core.bare" || EDITOR_KEY.test(key)) continue;
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

// Paths git status lists, porcelain v1 -z: "XY path" records, and after a rename or copy the
// source path as its own record. Paths are relative to the top of the work tree.
function statusPaths(listing: string): string[] {
  const records = listing.split("\0").filter((record) => record.length > 0);
  const paths: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i] ?? "";
    paths.push(record.slice(3));
    if (/^(R|C|.R|.C)/.test(record.slice(0, 2)) && i + 1 < records.length) paths.push(records[++i] ?? "");
  }
  return paths;
}

const CHUNK_BYTES = 1 << 20;

/** sha256 of a file read in chunks, so neither memory nor Node's single-read limit caps its size. */
export function hashFile(path: string, chunkBytes = CHUNK_BYTES): string {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(chunkBytes);
  const descriptor = openSync(path, "r");
  try {
    for (let read = readSync(descriptor, buffer); read > 0; read = readSync(descriptor, buffer)) hash.update(buffer.subarray(0, read));
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");

// One path's state as a digest: absent, a symlink's target text (never followed), or a file's
// executable bit and bytes. A path whose directory resolves outside the work tree (a tracked
// directory replaced by a link) is recorded as such and never read, and an unreadable file
// throws, so it never passes as unchanged.
function entryState(top: string, path: string): string {
  const full = resolve(top, path);
  let parent: string;
  try {
    parent = realpathSync(dirname(full));
  } catch (error) {
    if (isMissing(error)) return "absent";
    throw error;
  }
  if (parent !== top && !parent.startsWith(top + sep)) return "outside";
  const target = resolve(parent, full.slice(dirname(full).length + 1));
  let info;
  try {
    info = lstatSync(target);
  } catch (error) {
    if (isMissing(error)) return "absent";
    throw error;
  }
  if (info.isSymbolicLink()) return `link ${digest(readlinkSync(target))}`;
  if (!info.isFile()) return info.isDirectory() ? "directory" : "other";
  return `file ${(info.mode & 0o111) === 0 ? "-" : "x"} ${hashFile(target)}`;
}

function workingTree(options: GitOptions): string {
  const listing = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], options);
  // git prints names as raw bytes; one that is not UTF-8 decodes with U+FFFD and could not be
  // read back, so it would pass as absent. Stop instead.
  if (listing.includes("\uFFFD")) throw new Error("git-state: a path git status lists is not valid UTF-8, so its contents cannot be checked; rename it or add it to .gitignore");
  const top = realpathSync(git(["rev-parse", "--show-toplevel"], options));
  return digest(JSON.stringify([listing, statusPaths(listing).map((path) => entryState(top, path))]));
}

// A repository flipped to core.bare=true has no work tree for status or ls-files to read;
// the core.bare change itself is the refusal, so those two read as "bare".
const BARE = "bare";

export function readState(options: GitOptions = {}): GitState {
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
    tree: workTree ? workingTree(options) : BARE,
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

/** What differs between two states, each change named by its class; never a config value or file content. */
export function stateChanges(before: GitState, after: GitState): string[] {
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
  const gitOptions = gitOptionsAt(options.cwd);
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
  if (changes.length > 0) output.warn("git-state: the check changed this repository's git state. A test probably ran git here instead of in its fixture, or an editor or another program changed a dirty or untracked file while the check ran. Inspect and restore before pushing.");
  return changes.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
