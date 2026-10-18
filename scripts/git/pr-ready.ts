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

/** The GitHub repository a remote URL names; credentials in it are dropped. */
export type Repository = { host: string; owner: string; name: string };

const GITHUB_URLS = [
  /^https:\/\/(?:[^@/]+@)?([\w.-]+)\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
  /^ssh:\/\/git@([\w.-]+)\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
  /^git@([\w.-]+):([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
];

function githubRepository(url: string): Repository | undefined {
  for (const pattern of GITHUB_URLS) {
    const [, host, owner, name] = pattern.exec(url) ?? [];
    if (host !== undefined && owner !== undefined && name !== undefined) return { host, owner, name };
  }
  return undefined;
}

export const slug = ({ host, owner, name }: Repository): string => `${host}/${owner}/${name}`;
// GitHub names are case-insensitive, and gh reports them in their canonical case.
const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * The one repository npm run pr publishes to: what git really pushes origin to (after pushurl and
 * insteadOf rewriting), which must also be where main was fetched from. Every gh call names it, so
 * GH_REPO, GH_HOST and gh's own choice among remotes cannot send the handoff anywhere else.
 */
function destination(run: Run): Repository | { refusal: string } {
  // git push origin pushes to every push URL (every URL when no pushurl is set), so all are read.
  const urls = (push: string[]): string[] => must(run, "git", ["remote", "get-url", "--all", ...push, "origin"]).split("\n").filter((url) => url !== "");
  const fetchUrls = urls([]);
  const pushUrls = urls(["--push"]);
  if (fetchUrls.length !== 1 || pushUrls.length !== 1) {
    return { refusal: `origin must have exactly one fetch URL and one push URL; it has ${String(fetchUrls.length)} and ${String(pushUrls.length)}. git push origin pushes to every push URL, so there would be no single repository to open the pull request in. Nothing is pushed.` };
  }
  const fetched = githubRepository(fetchUrls[0] ?? "");
  const pushed = githubRepository(pushUrls[0] ?? "");
  if (fetched === undefined || pushed === undefined) {
    return { refusal: "origin is not a GitHub repository URL (https://HOST/OWNER/REPO, git@HOST:OWNER/REPO or ssh://git@HOST/OWNER/REPO) for both fetch and push, so there is no repository to open the pull request in. Nothing is pushed." };
  }
  if (!sameName(slug(fetched), slug(pushed))) {
    return { refusal: `origin fetches from ${slug(fetched)} but pushes to ${slug(pushed)}, so the main this branch was checked against and the pull request would be in different repositories. Make origin's URL, pushurl and insteadOf settings agree, then rerun. Nothing is pushed.` };
  }
  return pushed;
}

export const PR_FIELDS = "number,url,state,baseRefName,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository";
type PullRequest = {
  number: number; url: string; state: string; baseRefName: string; headRefName: string; headRefOid: string;
  source: { owner: string; name: string }; isCrossRepository: boolean;
};

function parsedJson(command: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${command} did not return JSON`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function missing(key: string): Error {
  return new Error(`GitHub reported a pull request without a usable ${key}`);
}

function text(record: Record<string, unknown>, key: string, inner?: string): string {
  const outer = record[key];
  const value = inner === undefined ? outer : isRecord(outer) ? outer[inner] : undefined;
  if (typeof value !== "string") throw missing(inner === undefined ? key : `${key}.${inner}`);
  return value;
}

function pullRequest(value: unknown): PullRequest {
  if (!isRecord(value)) throw new Error("GitHub reported a pull request that is not an object");
  const { number, isCrossRepository } = value;
  if (typeof number !== "number") throw missing("number");
  if (typeof isCrossRepository !== "boolean") throw missing("isCrossRepository");
  return {
    number, isCrossRepository, url: text(value, "url"), state: text(value, "state"), baseRefName: text(value, "baseRefName"),
    headRefName: text(value, "headRefName"), headRefOid: text(value, "headRefOid"),
    source: { owner: text(value, "headRepositoryOwner", "login"), name: text(value, "headRepository", "name") },
  };
}

export type Intended = { repository: Repository; branch: string; head: string };

/** Each way the pull request differs from the checked commit on the branch into main of the repository. */
function mismatches(pr: PullRequest, { repository, branch, head }: Intended): string[] {
  const source = `${pr.source.owner}/${pr.source.name}`;
  const expected = `${repository.owner}/${repository.name}`;
  const checks: [boolean, string][] = [
    [sameName(pr.url, `https://${slug(repository)}/pull/${String(pr.number)}`), `${pr.url} is not in ${slug(repository)}`],
    [pr.state === "OPEN", `state is ${pr.state}`],
    [pr.baseRefName === "main", `base is ${pr.baseRefName}, not main`],
    [!pr.isCrossRepository && sameName(source, expected), `source repository is ${source}${pr.isCrossRepository ? " (cross-repository)" : ""}, not ${expected}`],
    [pr.headRefName === branch, `source branch is ${pr.headRefName}, not ${branch}`],
    [pr.headRefOid === head, `head is ${pr.headRefOid}, not the checked commit ${head}`],
  ];
  return checks.filter(([ok]) => !ok).map(([, problem]) => problem);
}

// A same-named branch in a fork is someone else's pull request, not this branch's. A deleted fork
// leaves no source repository or owner, so this is read before the strict parse and never blocks.
function fromFork(listed: unknown, { repository }: Intended): boolean {
  if (!isRecord(listed) || listed.isCrossRepository !== true) return false;
  const { headRepositoryOwner: owner, headRepository: source } = listed;
  const login = isRecord(owner) ? owner.login : undefined;
  const name = isRecord(source) ? source.name : undefined;
  return typeof login !== "string" || typeof name !== "string" || !sameName(`${login}/${name}`, `${repository.owner}/${repository.name}`);
}

function openPullRequests(run: Run, intended: Intended): PullRequest[] {
  const args = ["pr", "list", "--repo", slug(intended.repository), "--head", intended.branch, "--state", "open", "--json", PR_FIELDS];
  const listed = parsedJson(`gh ${args.join(" ")}`, must(run, "gh", args));
  if (!Array.isArray(listed)) throw new Error(`gh ${args.join(" ")} did not return a list`);
  return listed.filter((pr) => !fromFork(pr, intended)).map(pullRequest);
}

/** Opens the pull request and reads back what GitHub made, under the URL gh create printed. */
function createdPullRequest(run: Run, { repository, branch }: Intended): PullRequest {
  const printed = must(run, "gh", ["pr", "create", "--repo", slug(repository), "--base", "main", "--head", branch, "--fill"]);
  const number = /^https:\/\/\S+\/pull\/(\d+)$/.exec(printed)?.[1];
  if (number === undefined) throw new Error(`gh pr create did not print a pull request URL: ${printed}`);
  const viewed = must(run, "gh", ["pr", "view", number, "--repo", slug(repository), "--json", PR_FIELDS]);
  return { ...pullRequest(parsedJson(`gh pr view ${number}`, viewed)), url: printed };
}

/**
 * The open pull request from the branch, scoped to the repository and checked to be exactly the
 * intended commit into main: its URL, a refusal naming each difference, or undefined when none is open.
 */
export function exactOpenPullRequest(run: Run, intended: Intended): string | { refusal: string } | undefined {
  const open = openPullRequests(run, intended);
  if (open.length > 1) {
    return { refusal: `${String(open.length)} open pull requests come from ${intended.branch} (${open.map((pr) => pr.url).join(", ")}). Only one may remain; npm run pr will not choose, retarget or close one.` };
  }
  return open[0] === undefined ? undefined : checked(open[0], intended);
}

/** The pull request for exactly what was pushed: the open one reused, or a new one; never another. */
function handoff(run: Run, intended: Intended): string | { refusal: string } {
  return exactOpenPullRequest(run, intended) ?? checked(createdPullRequest(run, intended), intended);
}

function checked(pr: PullRequest, intended: Intended): string | { refusal: string } {
  const problems = mismatches(pr, intended);
  if (problems.length === 0) return pr.url;
  return { refusal: `pull request ${pr.url} is not the branch's checked commit into main of ${slug(intended.repository)}: ${problems.join("; ")}. It is not reported as this branch's pull request, and npm run pr will not retarget it.` };
}

// After the push, a refusal or failure leaves the branch published; say so, and that a rerun repeats
// the push harmlessly and reuses an open pull request instead of opening a duplicate.
const pushedNote = (head: string, branch: string): string =>
  `${head} is already pushed to ${branch}; nothing was merged or retargeted. Fix the cause and rerun npm run pr: it pushes the same commit again and reuses a matching open pull request instead of opening another.`;

// gh is checked before the push, so a missing login never leaves a branch published with no PR.
// The pre-push hook would rerun npm run check; it skips that for the commit just checked here.
function publish(run: Run, { branch, head, main: mainCommit }: { branch: string; head: string; main: string }): string | { refusal: string } {
  const repository = destination(run);
  if ("refusal" in repository) return repository;
  const auth = run("gh", ["auth", "status", "--hostname", repository.host]);
  if (auth.status !== 0) return { refusal: `gh is not logged in to ${repository.host}. Run gh auth login, then rerun.` };
  // Agents act as the machine account, which cannot approve its own pull requests; under the
  // owner's login an agent could approve and merge, so that login is refused (ADR-0025).
  const user = must(run, "gh", ["api", "user", "--hostname", repository.host, "--jq", ".login"]);
  const owner = must(run, "gh", ["repo", "view", slug(repository), "--json", "owner", "--jq", ".owner.login"]);
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
  const handed = afterPush(head, branch, () => {
    must(run, "git", ["config", `branch.${branch}.remote`, "origin"]);
    must(run, "git", ["config", `branch.${branch}.merge`, `refs/heads/${branch}`]);
    return handoff(run, { repository, branch, head });
  });
  return typeof handed === "string" ? handed : { refusal: `${handed.refusal}\npr-ready: ${pushedNote(head, branch)}` };
}

function afterPush<T>(head: string, branch: string, step: () => T): T {
  try {
    return step();
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}. ${pushedNote(head, branch)}`, { cause: error });
  }
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
