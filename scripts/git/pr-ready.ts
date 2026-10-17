// npm run pr: get a branch ready for the owner to merge, and open its pull request.
//
// It never merges and never touches main (owner decision, 2026-10-09): it refuses unless the
// branch is clean, contains origin/main (so the branch is the merge result) and passes
// npm run check, then pushes the branch and opens or reports its PR. Merging is the owner's act on GitHub.
// It captures HEAD and the git state git-state compares before the check and refuses if the check
// changed them, passed or failed, so only the commit that was checked is pushed and certified.
import { spawnSync } from "node:child_process";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { MAIN_REFSPEC, environmentFor, gitOptionsAt, type GitOptions } from "../lib/git.ts";
import { parseCodeOwners } from "./code-owners.ts";
import { readState, stateChanges } from "./git-state.ts";

// inherit streams the command's output to the terminal (npm run check can run for a minute
// and its failure explains itself); env adds variables for that command.
type RunOptions = { inherit?: boolean; env?: Record<string, string> };
export type Run = (command: string, args: readonly string[], options?: RunOptions) => { status: number | null; stdout: string };
export type Options = { cwd?: string; output?: Output; run?: Run };

const USAGE = `Usage: node scripts/git/pr-ready.ts [--dry-run]
Refuses unless the branch is clean, contains origin/main and passes npm run check; then
pushes it and opens or reports its pull request. Never merges. --dry-run stops before pushing.
Exit: 0 ready, 1 refused, 2 a step could not run.`;

// A step that talks to the network (fetch, push, gh) is stopped instead of hanging npm run pr; the
// streamed npm run check has no limit, because it legitimately runs for minutes.
const STEP_TIMEOUT_MS = 120_000;

// lib/git.ts's rule: with an explicit cwd every GIT_ variable goes, so git, and anything that runs
// git, acts on that checkout; without one, only variables that inject config or rewrite history go.
export function spawnRunner(cwd: string | undefined, timeoutMs = STEP_TIMEOUT_MS): Run {
  return (command, args, options = {}) => {
    const inherit = options.inherit === true;
    const result = spawnSync(command, args, {
      cwd, encoding: "utf8", env: { ...environmentFor(gitOptionsAt(cwd)), ...options.env },
      stdio: inherit ? "inherit" : ["ignore", "pipe", "inherit"], ...(inherit ? {} : { timeout: timeoutMs }),
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

/** The branch to publish, the commit that was checked and the main commit it contains, or a refusal. */
function readiness(run: Run, gitOptions: GitOptions): { branch: string; head: string; main: string } | { refusal: string } {
  const symbolic = run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const branch = symbolic.stdout.trim();
  if (symbolic.status !== 0 || branch === "main") return { refusal: "Run this on a feature branch, not main or a detached HEAD." };
  if (must(run, "git", ["status", "--porcelain"]) !== "") return { refusal: "The branch has uncommitted changes. Commit or stash them first." };
  must(run, "git", ["fetch", "--quiet", "origin", MAIN_REFSPEC]);
  const mainCommit = must(run, "git", ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main^{commit}"]);
  const contains = run("git", ["merge-base", "--is-ancestor", mainCommit, "HEAD"]);
  if (contains.status === 1) return { refusal: "The branch is behind main: merge origin/main into this branch (never rebase published history), then rerun." };
  if (contains.status !== 0) throw new Error("cannot compare this branch with origin/main");
  if (must(run, "git", ["rev-list", "--count", `${mainCommit}..HEAD`]) === "0") return { refusal: "The branch has no commits that are not on main; there is nothing to open a pull request for." };
  const head = must(run, "git", ["rev-parse", "HEAD"]);
  const before = readState(gitOptions);
  const passed = run("npm", ["run", "check"], { inherit: true }).status === 0;
  const changes = stateChanges(before, readState(gitOptions));
  const refusals = [
    ...(passed ? [] : ["npm run check failed (output above). Fix it before opening the pull request."]),
    ...(changes.length === 0 ? [] : [`npm run check changed this repository's git state, so ${head} cannot be certified as checked and nothing is pushed: ${changes.join("; ")}. Inspect and restore it, then rerun.`]),
  ];
  return refusals.length > 0 ? { refusal: refusals.join("\npr-ready: ") } : { branch, head, main: mainCommit };
}

/**
 * Lower-case user logins named in the fetched main's .github/CODEOWNERS. A file that is absent from
 * the tree means no code owners; a tree that cannot be read throws, so the refusal never fails open.
 */
function codeOwners(run: Run, mainCommit: string): string[] {
  const listed = must(run, "git", ["ls-tree", "--name-only", mainCommit, "--", ".github/CODEOWNERS"]);
  if (listed === "") return [];
  return parseCodeOwners(must(run, "git", ["show", `${mainCommit}:.github/CODEOWNERS`]));
}

// gh is checked before the push, so a missing login never leaves a branch published with no PR.
// The pre-push hook would rerun npm run check; it skips that for the commit just checked here.
function publish(run: Run, { branch, head, main: mainCommit }: { branch: string; head: string; main: string }): string | { refusal: string } {
  const auth = run("gh", ["auth", "status"]);
  if (auth.status !== 0) return { refusal: "gh is not logged in. Run gh auth login, then rerun." };
  // Agents act as the machine account, which cannot approve its own pull requests; under the
  // owner's login an agent could approve and merge, so that login is refused (ADR-0025).
  const user = must(run, "gh", ["api", "user", "--jq", ".login"]);
  const owner = must(run, "gh", ["repo", "view", "--json", "owner", "--jq", ".owner.login"]);
  // A repository owned by an organisation has the organisation as its owner login, so the human
  // owner is found among the code owners instead. Read from origin/main: a branch cannot edit
  // its own way past this. Team entries (@org/team) are not logins and are skipped.
  const refusals: string[] = [];
  if (user === owner) {
    refusals.push(`gh is logged in as the repository owner (${owner}). Agents push as the machine account: log gh in as it and remove the owner's login from this machine (wiki/reference/Merge gate contract.md).`);
  }
  if (codeOwners(run, mainCommit).includes(user.toLowerCase())) {
    refusals.push(`gh is logged in as a code owner (${user}) named in .github/CODEOWNERS. Agents push as the machine account: log gh in as it and remove the owner's login from this machine (wiki/reference/Merge gate contract.md).`);
  }
  if (refusals.length > 0) return { refusal: refusals.join("\npr-ready: ") };
  // The checked commit is pushed by SHA, so a HEAD that moves after the check is never published
  // under the checked commit's name. --set-upstream needs a branch name as the source, and
  // --set-upstream-to needs a remote-tracking ref that a fetch refspec narrowed to main never
  // creates, so tracking is written directly.
  must(run, "git", ["push", "origin", `${head}:refs/heads/${branch}`], { env: { PR_READY_CHECKED: head } });
  must(run, "git", ["config", `branch.${branch}.remote`, "origin"]);
  must(run, "git", ["config", `branch.${branch}.merge`, `refs/heads/${branch}`]);
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
  if (run("git", ["config", "--get", "core.hooksPath"]).stdout.trim() !== ".githooks") {
    output.warn("pr-ready: git hooks are not installed in this checkout; run npm run hooks:install so commits on main are refused locally.");
  }
  const ready = readiness(run, gitOptionsAt(options.cwd));
  if ("refusal" in ready) {
    output.warn(`pr-ready: ${ready.refusal}`);
    return EXIT_REFUSED;
  }
  if (args[0] === "--dry-run") {
    output.write(`pr-ready: ${ready.branch} is ready; dry run, nothing pushed.`);
    return EXIT_OK;
  }
  const published = publish(run, ready);
  if (typeof published !== "string") {
    output.warn(`pr-ready: ${published.refusal}`);
    return EXIT_REFUSED;
  }
  output.write(`pr-ready: pull request ${published} is open. Only the owner merges; this tool never does.`);
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
