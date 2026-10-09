// npm run pr: get a branch ready for the owner to merge, and open its pull request.
//
// It replaces Zimi's self-merging gate, which merged and pushed main itself. This never merges
// and never touches main (owner decision, 2026-10-09): it refuses unless the branch is clean,
// contains origin/main (so the branch is the merge result) and passes npm run check, then
// pushes the branch and opens or reports its PR. Merging is the owner's act on GitHub.
import { spawnSync } from "node:child_process";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";

// inherit streams the command's output to the terminal (npm run check can run for a minute
// and its failure explains itself); env adds variables for that command.
export type RunOptions = { inherit?: boolean; env?: Record<string, string> };
export type Run = (command: string, args: readonly string[], options?: RunOptions) => { status: number | null; stdout: string };
export type Options = { cwd?: string; output?: Output; run?: Run };

const USAGE = `Usage: node scripts/git/pr-ready.ts [--dry-run]
Refuses unless the branch is clean, contains origin/main and passes npm run check; then
pushes it and opens or reports its pull request. Never merges. --dry-run stops before pushing.
Exit: 0 ready, 1 refused, 2 a step could not run.`;

function spawnRunner(cwd: string | undefined): Run {
  return (command, args, options = {}) => {
    const result = spawnSync(command, args, {
      cwd, encoding: "utf8", env: { ...process.env, ...options.env },
      stdio: options.inherit === true ? "inherit" : ["ignore", "pipe", "inherit"],
    });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout ?? "" };
  };
}

function must(run: Run, command: string, args: readonly string[], options?: RunOptions): string {
  const result = run(command, args, options);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${String(result.status)})`);
  return result.stdout.trim();
}

/** The branch to publish, or a refusal. */
function readiness(run: Run): { branch: string } | { refusal: string } {
  const head = run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const branch = head.stdout.trim();
  if (head.status !== 0 || branch === "main") return { refusal: "Run this on a feature branch, not main or a detached HEAD." };
  if (must(run, "git", ["status", "--porcelain"]) !== "") return { refusal: "The branch has uncommitted changes. Commit or stash them first." };
  must(run, "git", ["fetch", "--quiet", "origin", "main"]);
  const contains = run("git", ["merge-base", "--is-ancestor", "refs/remotes/origin/main", "HEAD"]);
  if (contains.status === 1) return { refusal: "The branch is behind main: merge origin/main into this branch (never rebase published history), then rerun." };
  if (contains.status !== 0) throw new Error("cannot compare this branch with origin/main");
  if (must(run, "git", ["rev-list", "--count", "refs/remotes/origin/main..HEAD"]) === "0") return { refusal: "The branch has no commits that are not on main; there is nothing to open a pull request for." };
  if (run("npm", ["run", "check"], { inherit: true }).status !== 0) return { refusal: "npm run check failed (output above). Fix it before opening the pull request." };
  return { branch };
}

// gh is checked before the push, so a missing login never leaves a branch published with no PR.
// The pre-push hook would rerun npm run check; it skips that for the commit just checked here.
function publish(run: Run, branch: string): string | { refusal: string } {
  const auth = run("gh", ["auth", "status"]);
  if (auth.status !== 0) return { refusal: "gh is not logged in. Run gh auth login, then rerun." };
  const head = must(run, "git", ["rev-parse", "HEAD"]);
  must(run, "git", ["push", "--set-upstream", "origin", branch], { env: { PR_READY_CHECKED: head } });
  const view = run("gh", ["pr", "view", branch, "--json", "url,state"]);
  if (view.status === 0) {
    const parsed: unknown = JSON.parse(view.stdout);
    if (typeof parsed === "object" && parsed !== null && "state" in parsed && parsed.state === "OPEN" && "url" in parsed) return String(parsed.url);
  }
  return must(run, "gh", ["pr", "create", "--base", "main", "--head", branch, "--fill"]);
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== "--dry-run")) {
    output.warn("pr-ready: pass no arguments, or --dry-run. See --help.");
    return EXIT_ERROR;
  }
  const run = options.run ?? spawnRunner(options.cwd);
  const ready = readiness(run);
  if ("refusal" in ready) {
    output.warn(`pr-ready: ${ready.refusal}`);
    return EXIT_REFUSED;
  }
  if (args[0] === "--dry-run") {
    output.write(`pr-ready: ${ready.branch} is ready; dry run, nothing pushed.`);
    return EXIT_OK;
  }
  const published = publish(run, ready.branch);
  if (typeof published !== "string") {
    output.warn(`pr-ready: ${published.refusal}`);
    return EXIT_REFUSED;
  }
  output.write(`pr-ready: pull request ${published} is open. Only the owner merges; this tool never does.`);
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
