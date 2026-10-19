// npm run sandcastle:afk: run the Sandcastle loop, then hand its work to the owner and walk away.
//
// `npm run sandcastle` only merges issue branches into the checked-out branch: nothing is pushed,
// no pull request is opened and nobody is told. This wrapper adds those steps without adding any
// authority. Landing is the repository's own tool (scripts/git/pr-ready.ts, what `npm run pr`
// runs), so the checks, the refusal of an owner login and the push of the branch stay where they
// are. Notification is GitHub only: the pull request's review request to the code owner and a
// comment on each issue. It never pushes main, never merges or approves, never closes an issue,
// never skips a hook and does not read .sandcastle/.env itself (the loop it starts does).
import { createHash } from "node:crypto";
import { accessSync, constants, lstatSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { destination, exactOpenPullRequest, slug, spawnRunner, type Repository, type Run } from "../git/pr-ready.ts";
import { MAIN_REFSPEC } from "../lib/git.ts";
import { CHANGELOG_FRAGMENT_PATTERN } from "../lib/paths.ts";
import { branchWork, type BranchWork } from "./already-done.ts";
import { HANDED_RECORD } from "./coordinator.ts";

export type Options = { cwd?: string; output?: Output; run?: Run; env?: NodeJS.ProcessEnv };

// The repository the Sandcastle prompts read issues from and comment on (.sandcastle/*.md). Every gh
// call names it with its host, so GH_REPO, GH_HOST and gh's choice among remotes cannot redirect a
// lookup or a comment.
const AFK_REPOSITORY: Repository = { host: "github.com", owner: "Zimfra", name: "software_testing" };
export const PROMPT_REPO = `${AFK_REPOSITORY.owner}/${AFK_REPOSITORY.name}`;
const REPO_SCOPE = slug(AFK_REPOSITORY);
// The landing step runs `npm run check` on the host, as the owner and unattended, and that executes
// the repository's own scripts, tests and configuration, including whatever an agent just changed.
// So the guard is an allowlist of what is not executed: Markdown documentation, changelog fragments
// included. Any other changed path (a root json.py that `python3 -m unittest` would import, a nested
// eslint config, an upper-case Scripts/ on a case-insensitive disk) needs a person to read the diff
// first, unless the owner opted in to landing code unattended with SANDCASTLE_AFK_LAND_CODE=1.
const DOCUMENTATION = [/^wiki\/.+\.md$/, /^docs\/.+\.md$/, /^[^/]+\.md$/, CHANGELOG_FRAGMENT_PATTERN];
const LAND_CODE_ENV = "SANDCASTLE_AFK_LAND_CODE";
const ISSUE_BRANCH = /^refs\/heads\/sandcastle\/issue-([1-9]\d*)$/;

const USAGE = `Usage: node scripts/sandcastle/afk.ts
Runs the Sandcastle loop on the current feature branch, then opens a pull request for the issue
branches it merged (npm run pr's tool) and comments on each issue. It lands only branches the loop
handed its merger, as the loop's record says. Never merges or closes anything.
Exit: 0 done or nothing to land, 1 refused with nothing pushed (before the loop: a failed fetch,
an unreadable hooks directory, code on the branch, a record of the branches handed to the
merger that cannot be removed; after it: code that may not land unattended, or
a refusal from the landing tool), 2 a step failed or work is incomplete (including a loop that
reported blocked or incomplete work, after landing what it integrated; a fetch that failed after
the loop, when issue branches may already be merged here; and, landing nothing, a missing or
malformed record of the branches handed to the merger or an issue branch merged without being
handed to it).`;

function git(run: Run, args: readonly string[]): string {
  const result = run("git", args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed (exit ${String(result.status)})`);
  return result.stdout;
}

// npm run pr publishes to origin's one destination (its own check, which a git failure throws
// from). afk refuses before the paid loop unless that destination is the repository it serves.
function originRefusal(run: Run): string | undefined {
  const published = readDestination(run);
  if ("refusal" in published) return published.refusal;
  if (slug(published).toLowerCase() === REPO_SCOPE.toLowerCase()) return undefined;
  return `origin publishes to ${slug(published)}, but the Sandcastle prompts read and comment on issues of ${REPO_SCOPE}, so npm run pr would open the pull request in another repository. Point origin at ${REPO_SCOPE}, then rerun.`;
}

function readDestination(run: Run): Repository | { refusal: string } {
  try {
    return destination(run);
  } catch {
    return { refusal: "origin's URLs cannot be read (git remote get-url failed). Check the origin remote, then rerun." };
  }
}

// A gh call that times out throws (spawnRunner); it means "cannot resolve", not a crash.
function resolveRepo(run: Run): string {
  try {
    const view = run("gh", ["repo", "view", REPO_SCOPE, "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    return view.status === 0 ? view.stdout.trim() : "";
  } catch {
    return "";
  }
}

// A git call that times out throws (spawnRunner); for a fetch that is a failed fetch, not a crash. The
// explicit destination, and the check that the ref exists afterwards, keep a narrowed remote.origin.fetch
// from leaving the comparison below on a stale or absent origin/main.
function fetchMain(run: Run): boolean {
  try {
    const fetched = run("git", ["fetch", "--quiet", "origin", MAIN_REFSPEC]).status === 0;
    return fetched && run("git", ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main^{commit}"]).status === 0;
  } catch {
    return false;
  }
}

// What the loop could change that runs code on the next git command: the hooks directory the repository
// is configured to use (git rev-parse --git-path honours core.hooksPath). Each entry is its name, type,
// mode and a SHA-256 of its content (of the target, for a symlink), so a rewrite that keeps size and
// mtime is seen. Compared before and after the loop, and before any other git command after it, because
// git status, checkout and fetch can run hooks. undefined means the directory could not be read, which
// the caller must treat as a refusal and never as an empty directory; a missing directory is "".
function hooksSnapshot(run: Run, cwd: string | undefined): string | undefined {
  const where = run("git", ["rev-parse", "--git-path", "hooks"]);
  if (where.status !== 0) return undefined;
  const dir = resolve(cwd ?? process.cwd(), where.stdout.trim());
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT" ? "" : undefined;
  }
  const entries: string[] = [];
  for (const name of names) {
    try {
      const path = join(dir, name);
      const link = lstatSync(path).isSymbolicLink() ? `->${readlinkSync(path)}` : "";
      const info = statSync(path);
      const content = info.isFile() ? createHash("sha256").update(readFileSync(path)).digest("hex") : "dir";
      entries.push(`${name}${link}:${String(info.mode)}:${content}`);
    } catch {
      return undefined;
    }
  }
  return entries.join("\n");
}

/** The current branch (empty on a detached HEAD), the repository gh reports, and every reason not to run the loop. */
function readiness(run: Run, env: NodeJS.ProcessEnv, cwd: string | undefined): { branch: string; repo: string; refused: string[]; hooks: string; record: string } {
  const head = run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const branch = head.status === 0 ? head.stdout.trim() : "";
  const refused: string[] = [];
  // A tracking ref that is behind makes the comparison below name code the owner never wrote.
  const fetched = fetchMain(run);
  if (!fetched) refused.push("git fetch of origin/main failed or left no origin/main: check the network and the origin remote, then rerun.");
  if (branch === "" || branch === "main") refused.push("Run this on a feature branch, not main or a detached HEAD.");
  if (git(run, ["status", "--porcelain"]).trim() !== "") refused.push("The tree has uncommitted changes. Commit or stash them first.");
  // One cheap call before the loop spends minutes: it fails when gh is not logged in or cannot
  // see the repository. The owner-login refusal stays with pr-ready.ts, after the loop.
  if (resolveRepo(run) === "") refused.push("gh cannot resolve this repository. Run gh auth login (as the machine account), then rerun.");
  const origin = originRefusal(run);
  if (origin !== undefined) refused.push(origin);
  // A branch that already carries code would be refused after a paid loop; say so before it runs.
  if (!landCode(env) && fetched && branch !== "" && branch !== "main") {
    const code = guardedChanges(run);
    if (code === undefined) refused.push("This branch has no history in common with origin/main. Merge origin/main into it, then rerun.");
    else if (code.length > 0) refused.push(codeMessage(code));
  }
  const hooks = hooksSnapshot(run, cwd);
  if (hooks === undefined) refused.push("The git hooks directory cannot be read (an unreadable entry or a dangling link), so changes to it could not be seen. Fix or remove that entry, then rerun.");
  const record = resolve(cwd ?? process.cwd(), git(run, ["rev-parse", "--git-path", HANDED_RECORD]).trim());
  if (!removable(record)) refused.push(`The record of the branches handed to the merger at ${record} cannot be removed (a directory, or no permission), so this run's record could not be told from an earlier one. Remove it, then rerun.`);
  return { branch, repo: REPO_SCOPE, refused, hooks: hooks ?? "", record };
}

const branchesMerged = (run: Run, flag: string, ref: string): string[] =>
  git(run, ["for-each-ref", "--format=%(refname)", flag, ref, "refs/heads/sandcastle/"]).split("\n").filter((name) => name !== "");

/** Refs of sandcastle/issue-<N> branches merged into HEAD but not into origin/main, with whether each holds a commit of its own. */
function mergedBranches(run: Run, cwd: string | undefined): { ref: string; work: BranchWork }[] {
  const onMain = new Set(branchesMerged(run, "--merged", "refs/remotes/origin/main"));
  return branchesMerged(run, "--merged", "HEAD")
    .filter((name) => !onMain.has(name) && ISSUE_BRANCH.test(name))
    .map((ref) => ({ ref, work: branchWork(ref, cwd ?? process.cwd()) }));
}

const issueNumber = (ref: string): string => ISSUE_BRANCH.exec(ref)?.[1] ?? ref;
const byNumber = (a: string, b: string): number => Number(a) - Number(b);

// A gh call that times out throws (spawnRunner); it counts as a failed comment, not a crash.
function comment(run: Run, repo: string, issue: string, url: string): boolean {
  const body = `Sandcastle merged a branch for this issue into the branch of ${url}, which is waiting for the owner's review. The work may be incomplete: read the pull request before merging it. This issue stays open until the owner merges that pull request.`;
  try {
    return run("gh", ["issue", "comment", issue, "-R", repo, "--body", body]).status === 0;
  } catch {
    return false;
  }
}

// A gh call that fails or times out, or an answer that is malformed, means "no open pull request",
// not a crash. Only the open pull request that is exactly `head` on this branch into main of the
// repository holds this work, the same check npm run pr makes; anything else gets no comment.
function pullRequestUrl(run: Run, branch: string, head: string): string {
  try {
    const found = exactOpenPullRequest(run, { repository: AFK_REPOSITORY, branch, head });
    return typeof found === "string" ? found : "";
  } catch {
    return "";
  }
}

/** True when origin already holds every one of these branch tips under this branch's name (pr-ready pushed them). */
function isPushed(run: Run, branch: string, refs: readonly string[]): boolean {
  const remote = `refs/remotes/origin/${branch}`;
  // A branch that was never pushed has no remote ref; asking merge-base about it prints a raw
  // `fatal:` line, so the ref is checked quietly first.
  if (run("git", ["rev-parse", "--verify", "--quiet", `${remote}^{commit}`]).status !== 0) return false;
  return refs.every((ref) => run("git", ["merge-base", "--is-ancestor", ref, remote]).status === 0);
}

/** Every local sandcastle/issue-<N> branch tip, by full ref name. */
function issueTips(run: Run): Map<string, string> {
  const lines = git(run, ["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads/sandcastle/"]).split("\n");
  const tips = new Map<string, string>();
  for (const line of lines) {
    const [ref, sha] = line.split(" ");
    if (ref !== undefined && sha !== undefined && ISSUE_BRANCH.test(ref)) tips.set(ref, sha);
  }
  return tips;
}

/** Issue branches this run moved or created, with work, that neither HEAD nor origin/main holds. */
function strandedIssues(run: Run, cwd: string | undefined, before: ReadonlyMap<string, string>): string[] {
  const held = (ref: string, into: string): boolean => run("git", ["merge-base", "--is-ancestor", ref, into]).status === 0;
  return [...issueTips(run)]
    .filter(([ref, sha]) => before.get(ref) !== sha)
    .filter(([ref]) => !held(ref, "HEAD") && !held(ref, "refs/remotes/origin/main"))
    .filter(([ref]) => branchWork(ref, cwd ?? process.cwd()) !== "empty")
    .map(([ref]) => issueNumber(ref))
    .sort(byNumber);
}

/**
 * Paths that differ from origin/main (so earlier unlanded work counts too) and are not
 * documentation, or undefined when the branch shares no history with origin/main.
 */
function guardedChanges(run: Run): string[] | undefined {
  const base = run("git", ["merge-base", "HEAD", "refs/remotes/origin/main"]);
  if (base.status === 1) return undefined; // exit 1 is "no common ancestor"; anything else is a failure
  if (base.status !== 0) throw new Error(`git merge-base HEAD refs/remotes/origin/main failed (exit ${String(base.status)})`);
  return git(run, ["diff", "--name-only", "-z", "--no-renames", base.stdout.trim(), "HEAD"]).split("\0")
    .filter((path) => path !== "" && !DOCUMENTATION.some((pattern) => pattern.test(path)));
}

const landCode = (env: NodeJS.ProcessEnv): boolean => env[LAND_CODE_ENV] === "1";

const codeMessage = (paths: string[]): string =>
  `the branch differs from origin/main in files that are not documentation and that npm run check would run: ${paths.join(", ")}. Review that diff and land with npm run pr, or set ${LAND_CODE_ENV}=1 in your own shell to accept running agent-written code on this machine unattended.`;

/** Tell each announced issue, since the owner may be away; returns the issues that could not be told. */
function noticeComments(run: Run, repo: string, branch: string, issues: readonly string[]): string[] {
  const body = `Sandcastle merged this issue into the local branch ${branch} but it is not landed: the branch changes code or configuration that npm run check would execute unattended. Nothing was pushed. Review the diff and run npm run pr.`;
  return issues.filter((issue) => {
    try {
      return run("gh", ["issue", "comment", issue, "-R", repo, "--body", body]).status !== 0;
    } catch {
      return true;
    }
  });
}

// Branch tracking keys (branch.<name>.remote and .merge) appear whenever a branch is created from a
// remote-tracking ref; the keys that run code (core.hooksPath, core.fsmonitor, alias.*, filter.*,
// credential.*) are what this comparison is for.
const localConfig = (run: Run): string =>
  git(run, ["config", "--local", "--list", "-z"]).split("\0")
    .filter((entry) => !entry.split("\n", 1)[0]?.startsWith("branch."))
    .join("\0");

type CodeRefusal = Landing & { incomplete: boolean };

/** Refuse to land non-documentation changes: name them, tell the issues, and pick the exit code. */
function refuseCode(run: Run, output: Output, { repo, branch, issues, incomplete }: CodeRefusal): number | undefined {
  const guarded = guardedChanges(run) ?? ["(no history in common with origin/main)"];
  if (guarded.length === 0) return undefined;
  output.warn(`afk: ${codeMessage(guarded)} Nothing was pushed.`);
  const untold = noticeComments(run, repo, branch, issues);
  if (untold.length > 0) output.warn(`afk: issue ${untold.join(", ")} could not be told that its work is merged locally and not landed.`);
  return incomplete || untold.length > 0 ? EXIT_ERROR : EXIT_REFUSED;
}

type Landing = { repo: string; branch: string; issues: string[] };

/** Steps 2 and 3: open the pull request through pr-ready.ts, then comment on each issue. */
function land(run: Run, output: Output, { repo, branch, issues }: Landing): number {
  output.write(`afk: step 2 of 3, landing issue(s) ${issues.join(", ")} with scripts/git/pr-ready.ts (checks, push, pull request).`);
  const landing = run("node", ["scripts/git/pr-ready.ts"], { inherit: true });
  if (landing.status !== 0) {
    if (landing.status === 1) {
      output.warn("afk: the landing step refused (exit 1, reason above). The work stays merged on this branch; nothing was pushed or commented.");
      return EXIT_REFUSED;
    }
    output.warn(`afk: the landing step failed (exit ${String(landing.status)}, reason above). A push may already have happened: check origin before rerunning. Nothing was commented, and the work stays merged on this branch.`);
    return EXIT_ERROR;
  }
  const url = pullRequestUrl(run, branch, git(run, ["rev-parse", "HEAD"]).trim());
  if (url === "") {
    output.warn("afk: the landing step succeeded but gh reports no pull request URL for this branch, so no issue was commented. Find the pull request on GitHub.");
    return EXIT_ERROR;
  }

  output.write(`afk: step 3 of 3, commenting on issue(s) ${issues.join(", ")}.`);
  const failed = issues.filter((issue) => !comment(run, repo, issue, url));
  if (failed.length > 0) {
    output.warn(`afk: the pull request ${url} is open, but the comment on issue ${failed.join(", ")} failed.`);
    return EXIT_ERROR;
  }
  output.write(`afk: done. ${url} is waiting for the owner's review; this tool never merges.`);
  return EXIT_OK;
}

type Before = { branch: string; configBefore: string; hooksBefore: string };

/**
 * What the loop left that must be looked at before any further git command runs: the merger is an
 * agent with a shell on this checkout. Undefined when nothing is wrong. The hooks comparison comes
 * before the post-loop fetch because a reference-transaction hook runs when a fetch updates refs.
 */
function loopAftermath(run: Run, cwd: string | undefined, before: Before): string | undefined {
  // Config and hooks first, with the fewest git commands (neither git config nor rev-parse runs a
  // hook): git status can refresh and write the index, and a post-index-change hook an agent planted
  // would run as the owner.
  if (localConfig(run) !== before.configBefore) {
    return "the loop changed this repository's git config, which a tracked diff cannot show (core.hooksPath and core.fsmonitor run code); review git config --local --list.";
  }
  const hooks = hooksSnapshot(run, cwd);
  if (hooks === undefined || hooks !== before.hooksBefore) {
    return "the loop changed this repository's git hooks or left them unreadable, which a tracked diff cannot show and which a later git command would run; no other git command was run first; review .git/hooks.";
  }
  if (run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]).stdout.trim() !== before.branch) {
    return `HEAD is no longer on ${before.branch} after the loop; check the checkout.`;
  }
  const leftover = unfinishedTree(run);
  if (leftover !== undefined) return `the loop left the tree ${leftover}; finish or abort that by hand.`;
  return undefined;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 0) {
    output.warn("afk: pass no arguments. See --help.");
    return EXIT_ERROR;
  }
  const run = options.run ?? defaultRunner(options.cwd);
  const env = options.env ?? process.env;
  const { branch, repo, refused, hooks: hooksBefore, record } = readiness(run, env, options.cwd);
  for (const reason of refused) output.warn(`afk: ${reason}`);
  if (refused.length > 0) return EXIT_REFUSED;
  // "Earlier" work is a branch that was already merged here with its tip unchanged by the loop.
  // A branch whose tip the loop moved is this run's, even when it was merged or empty before.
  const mergedBefore = new Set(mergedBranches(run, options.cwd).map((entry) => entry.ref));
  const before: BeforeLoop = { tipsBefore: issueTips(run), mergedBefore, record: cleared(record) };
  const headBefore = git(run, ["rev-parse", "HEAD"]).trim();
  const configBefore = localConfig(run);

  output.write("afk: step 1 of 3, running the Sandcastle loop (node .sandcastle/main.ts).");
  const loop = run("node", [".sandcastle/main.ts"], { inherit: true }).status;
  // Exit 2 is the loop's blocked, incomplete or failed run (run-result.ts): reviewed issues it
  // integrated may still proceed, judged below from the branch and the loop's record of what it
  // handed the merger, and this run then exits 2 as well.
  if (loop !== EXIT_OK && loop !== EXIT_ERROR) {
    output.warn("afk: the Sandcastle loop failed (output above). Nothing was pushed or commented, but the loop may already have merged issues into this branch.");
    return EXIT_ERROR;
  }
  const loopIncomplete = loop === EXIT_ERROR;
  if (loopIncomplete) output.warn("afk: the Sandcastle loop reported incomplete or failed work, or blocked issues (exit 2, named above). What it merged is judged from the branch below; this run exits 2 whatever lands.");
  const tampered = loopAftermath(run, options.cwd, { branch, configBefore, hooksBefore });
  if (tampered !== undefined) {
    output.warn(`afk: ${tampered} Nothing was pushed or commented.`);
    return EXIT_ERROR;
  }
  if (!fetchMain(run)) {
    output.warn("afk: the loop ran and may have merged issue branches into this branch, but git fetch origin main failed afterwards, so the result cannot be classified. Nothing was pushed or commented; check the network, then rerun.");
    return EXIT_ERROR;
  }
  const found = classifyHanded(run, options.cwd, before);
  if (typeof found === "string") {
    output.warn(`afk: ${found} Nothing was pushed or commented.`);
    return EXIT_ERROR;
  }
  const { issues, unannounced, earlier, earlierRefs, stranded, deleted } = found;
  reportClassification(output, { issues, unannounced, earlier, earlierRefs, stranded, deleted });
  const incomplete = loopIncomplete || unannounced.length > 0 || stranded.length > 0 || deleted.length > 0;
  if (issues.length === 0) return nothingToAnnounce(run, output, { branch, headBefore, earlier, earlierRefs, incomplete });

  const refusal = landCode(env) ? undefined : refuseCode(run, output, { repo, branch, issues, incomplete });
  if (refusal !== undefined) return refusal;
  const code = land(run, output, { repo, branch, issues });
  return code === EXIT_OK && incomplete ? EXIT_ERROR : code;
}

type Classified = { issues: string[]; unannounced: string[]; earlier: string[]; earlierRefs: string[]; stranded: string[]; deleted: string[] };
type BeforeLoop = { record: string; tipsBefore: ReadonlyMap<string, string>; mergedBefore: ReadonlySet<string> };

/**
 * True when the record path is absent, or a file or link afk may delete: checked without deleting,
 * so a refusal before the loop changes nothing.
 */
function removable(record: string): boolean {
  let entry: ReturnType<typeof lstatSync>;
  try {
    entry = lstatSync(record);
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
  if (!entry.isFile() && !entry.isSymbolicLink()) return false;
  try {
    accessSync(dirname(record), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Remove the record an earlier run left, once every check before the loop has passed. */
function cleared(record: string): string {
  rmSync(record, { force: true });
  return record;
}

/** The refs of the branches the loop recorded handing its merger, or undefined when the record is missing or malformed. */
function handedRefs(record: string): Set<string> | undefined {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(record, "utf8"));
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || !("handed" in value) || !Array.isArray(value.handed)) return undefined;
  const handed: readonly unknown[] = value.handed;
  return handed.every((branch) => typeof branch === "string") ? new Set(handed.map((branch) => `refs/heads/${String(branch)}`)) : undefined;
}

/**
 * Classify the issue branches, or say why nothing may land: the loop's record of what it handed the
 * merger is missing or malformed, or this run merged a branch with work that the merger was not handed
 * (the pushed branch would carry it).
 */
function classifyHanded(run: Run, cwd: string | undefined, before: BeforeLoop): Classified | string {
  const handed = handedRefs(before.record);
  if (handed === undefined) return "the loop's record of the branches handed to the merger is missing or malformed, so a branch the merger was not handed cannot be told apart.";
  const found = classify(run, cwd, before, handed);
  if (found.unhanded.length === 0) return found;
  return `issue ${found.unhanded.join(", ")} was merged into this branch by this run but not handed to the merger (the loop's record does not name it), so the branch, which carries that work, is not landed; review it.`;
}

/** Sort the issue branches after the loop into announced, earlier, unrecognised and stranded work. */
function classify(run: Run, cwd: string | undefined, { tipsBefore, mergedBefore }: BeforeLoop, handed: ReadonlySet<string>): Classified & { unhanded: string[] } {
  const merged = mergedBranches(run, cwd);
  const tipsAfter = issueTips(run);
  const isEarlier = (ref: string): boolean => mergedBefore.has(ref) && tipsBefore.get(ref) === tipsAfter.get(ref);
  const fresh = merged.filter((entry) => !isEarlier(entry.ref));
  const numbers = (refs: string[]): string[] => refs.map(issueNumber).sort(byNumber);
  const earlierRefs = merged.filter((entry) => isEarlier(entry.ref) && entry.work === "worked").map((entry) => entry.ref);
  return {
    unhanded: numbers(fresh.filter((entry) => entry.work !== "empty" && !handed.has(entry.ref)).map((entry) => entry.ref)),
    issues: numbers(fresh.filter((entry) => entry.work === "worked").map((entry) => entry.ref)),
    unannounced: numbers(fresh.filter((entry) => entry.work === "unrecognised").map((entry) => entry.ref)),
    earlier: numbers(earlierRefs),
    earlierRefs,
    stranded: strandedIssues(run, cwd, tipsBefore),
    deleted: numbers([...tipsBefore.keys()].filter((ref) => !tipsAfter.has(ref))),
  };
}

function reportClassification(output: Output, found: Classified): void {
  const { unannounced, earlier, stranded, deleted } = found;
  if (earlier.length > 0) {
    output.warn(`afk: issue ${earlier.join(", ")} was merged on this branch by an earlier run and is not commented on by this run; the pull request carries its work.`);
  }
  if (unannounced.length > 0) {
    output.warn(`afk: issue ${unannounced.join(", ")} was merged by this run but its branch has no commit entry in its reflog, so it is not commented on; the pull request still carries its work.`);
  }
  if (stranded.length > 0) {
    output.warn(`afk: issue ${stranded.join(", ")} has work on its branch that this run did not merge, and origin/main does not hold it. The run exits 2; rerun, or merge it by hand.`);
  }
  if (deleted.length > 0) {
    output.warn(`afk: the branch of issue ${deleted.join(", ")} was deleted during the loop, so its work cannot be classified. Check the repository before landing by hand.`);
  }
}

type Quiet = { branch: string; headBefore: string; earlier: string[]; earlierRefs: string[]; incomplete: boolean };

/** "dirty" or "mid-merge" when the loop left the tree unfinished, undefined when it is clean. */
function unfinishedTree(run: Run): string | undefined {
  if (run("git", ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"]).status === 0) return "in the middle of a merge";
  return git(run, ["status", "--porcelain"]).trim() === "" ? undefined : "with uncommitted changes";
}

/** Nothing was announceable: decide whether that is a quiet success or work left unlanded. */
function nothingToAnnounce(run: Run, output: Output, state: Quiet): number {
  const moved = git(run, ["rev-parse", "HEAD"]).trim() !== state.headBefore;
  if (state.incomplete || moved) {
    output.warn("afk: nothing was announced, but HEAD moved during the loop, or issue work was left incomplete, unmerged or unrecognised (see above). Check the branch before landing it by hand.");
    return EXIT_ERROR;
  }
  if (state.earlier.length > 0 && !isPushed(run, state.branch, state.earlierRefs)) {
    output.warn("afk: work merged by an earlier run is on this branch and not pushed, and this run found nothing new. Land it with npm run pr.");
    return EXIT_ERROR;
  }
  if (state.earlier.length > 0) {
    // Pushed work with no open pull request means an earlier run stopped between the push and the
    // pull request; exit 0 would hide that. A comment that failed after the pull request opened
    // is not visible from here and is not retried.
    if (pullRequestUrl(run, state.branch, git(run, ["rev-parse", `refs/remotes/origin/${state.branch}`]).trim()) === "") {
      output.warn("afk: the work an earlier run merged is pushed but gh finds no open pull request for this branch. Open it with npm run pr, then comment on the issues by hand.");
      return EXIT_ERROR;
    }
    output.write("afk: nothing new to announce; the work an earlier run merged is already pushed and has a pull request.");
    return EXIT_OK;
  }
  output.write("afk: no Sandcastle issue branch was merged into this branch by this run; nothing to land.");
  return EXIT_OK;
}

// The loop and the landing tool run for minutes and are not given a timeout; git and gh are.
function defaultRunner(cwd: string | undefined): Run {
  const quick = spawnRunner(cwd);
  const long = spawnRunner(cwd, 0);
  return (command, args, options) => (command === "node" ? long : quick)(command, args, options);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
