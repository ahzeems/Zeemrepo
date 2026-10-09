// npm run pr: get a branch ready for the owner to merge, and open its pull request.
//
// It replaces Zimi's self-merging gate, which merged and pushed main itself. This never merges
// and never touches main (owner decision, 2026-10-09): it refuses unless the branch is clean,
// contains origin/main (so the branch is the merge result) and passes npm run check, then
// pushes the branch and opens or reports its PR. Merging is the owner's act on GitHub.
import { spawnSync } from "node:child_process";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";

export type Run = (command: string, args: readonly string[]) => { status: number | null; stdout: string };
export type Options = { cwd?: string; output?: Output; run?: Run };

const USAGE = `Usage: node scripts/git/pr-ready.ts [--dry-run]
Refuses unless the branch is clean, contains origin/main and passes npm run check; then
pushes it and opens or reports its pull request. Never merges. --dry-run stops before pushing.
Exit: 0 ready, 1 refused, 2 a step could not run.`;

function spawnRunner(cwd: string | undefined): Run {
  return (command, args) => {
    const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout };
  };
}

function must(run: Run, command: string, args: readonly string[]): string {
  const result = run(command, args);
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
  if (run("npm", ["run", "check"]).status !== 0) return { refusal: "npm run check failed. Fix it before opening the pull request." };
  return { branch };
}

function publish(run: Run, branch: string): string {
  must(run, "git", ["push", "--set-upstream", "origin", branch]);
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
  output.write(`pr-ready: pull request ${publish(run, ready.branch)} is open. Only the owner merges; this tool never does.`);
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
