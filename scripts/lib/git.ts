import { execFileSync } from "node:child_process";

export type GitOptions = { cwd?: string };

export class GitError extends Error {
  readonly args: readonly string[];
  readonly stderr: string;
  // The exit status when git ran; null when it could not run at all (missing binary,
  // bad cwd, timeout, signal, output over the buffer limit).
  readonly status: number | null;

  constructor(args: readonly string[], stderr: string, status: number | null, cause: unknown) {
    const detail = stderr.trim() || (cause instanceof Error ? cause.message : String(cause));
    super(`git ${args.join(" ")} failed${status === null ? "" : ` (exit ${status})`}: ${detail}`, { cause });
    this.name = "GitError";
    this.args = args;
    this.stderr = stderr;
    this.status = status;
  }
}

// Variables that make git read a different repository, index or history than the one the
// caller named. A hook exports GIT_DIR and GIT_INDEX_FILE, so with an explicit cwd every
// GIT_ variable goes. Without a cwd the hook's repository is the point, so only the
// variables that inject config or rewrite history are dropped.
// Pitfall: inside pre-commit, passing cwd for the hooked repo itself drops the temporary
// index that `git commit -a` uses. Omit cwd there.
const INJECTION = /^GIT_(CONFIG_|REPLACE_REF_BASE$|GRAFT_FILE$|NO_REPLACE_OBJECTS$)/;

export function environmentFor(options: GitOptions): NodeJS.ProcessEnv {
  const drop = options.cwd === undefined ? (key: string) => INJECTION.test(key) : (key: string) => key.startsWith("GIT_");
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !drop(key)));
}

// Pinned so user config cannot change what a guard parses: unquoted non-ASCII names, no
// colour codes, no pager, both sides of a rename, and no replace refs rewriting history.
const FIXED_CONFIG = ["-c", "core.quotePath=false", "-c", "color.ui=false", "-c", "core.pager=cat",
  "-c", "diff.renames=false", "--no-replace-objects"];
const MAX_BUFFER = 64 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

function failureOf(error: unknown): { stderr: string; status: number | null } {
  if (typeof error !== "object" || error === null) return { stderr: "", status: null };
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  const status = "status" in error && typeof error.status === "number" ? error.status : null;
  return { stderr, status };
}

function run(args: readonly string[], options: GitOptions): string {
  try {
    return execFileSync("git", [...FIXED_CONFIG, ...args], {
      cwd: options.cwd, env: environmentFor(options), encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: MAX_BUFFER, timeout: TIMEOUT_MS,
    });
  } catch (error) {
    const { stderr, status } = failureOf(error);
    throw new GitError(args, stderr, status, error);
  }
}

// Only the trailing newline goes: `status --porcelain` starts with a meaningful space.
export function git(args: readonly string[], options: GitOptions = {}): string {
  return run(args, options).replace(/\n+$/, "");
}

export function gitLines(args: readonly string[], options: GitOptions = {}): string[] {
  return run(args, options).split("\n").filter((line) => line.length > 0);
}

// Path lists come NUL-separated: quotePath=false still C-quotes tabs and newlines, and a
// quoted path would slip past an anchored pattern like ^scripts/. -z goes right after the
// subcommand, so it is never read as a pathspec after a caller's "--".
export function gitPaths(args: readonly string[], options: GitOptions = {}): string[] {
  const [subcommand = "", ...rest] = args;
  return run([subcommand, "-z", ...rest], options).split("\0").filter((path) => path.length > 0);
}

// null means git ran and answered "no" (a non-zero exit). Failing to run git at all is an
// error, never an answer.
export function tryGit(args: readonly string[], options: GitOptions = {}): string | null {
  try {
    return git(args, options);
  } catch (error) {
    if (error instanceof GitError && error.status !== null) return null;
    throw error;
  }
}

function assertNotOption(ref: string): void {
  if (ref.startsWith("-")) throw new Error(`"${ref}" would be read as an option, not a ref`);
}

export function refExists(ref: string, options: GitOptions = {}): boolean {
  assertNotOption(ref);
  return tryGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], options) !== null;
}

// Where the branch forked from main. origin/main first: a local main can be stale. A ref
// that exists but shares no history is an error, not a reason to try the next one.
const BASE_REFS = ["refs/remotes/origin/main", "refs/heads/main"];

export function mergeBase(options: GitOptions = {}): string {
  for (const ref of BASE_REFS) {
    if (!refExists(ref, options)) continue;
    const base = tryGit(["merge-base", ref, "HEAD"], options);
    if (base === null) throw new Error(`${ref} and HEAD have no common history`);
    return base;
  }
  throw new Error(`no base ref: none of ${BASE_REFS.join(", ")} exists`);
}

// `merge-base --is-ancestor` exits 1 for "no" and other codes for errors such as a
// missing object. Only the first is an answer; callers decide what an error means.
export function isAncestor(ancestor: string, descendant: string, options: GitOptions = {}): boolean {
  assertNotOption(ancestor);
  assertNotOption(descendant);
  try {
    git(["merge-base", "--is-ancestor", ancestor, descendant], options);
    return true;
  } catch (error) {
    if (error instanceof GitError && error.status === 1) return false;
    throw error;
  }
}
