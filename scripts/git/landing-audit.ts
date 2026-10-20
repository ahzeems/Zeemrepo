// npm run audit: does every commit on this repository's main, after its configured boundary,
// correspond to a pull request into main that a code owner of the time merged as that commit?
// History at and before the boundary (inherited from the upstream repository) is outside the
// audit. It fetches origin's main and changes nothing else. It asks GitHub, which records every
// merge, rather than git notes, which do not travel with fetch.
import { spawnSync } from "node:child_process";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { fetchMain, git, gitLines, gitOptionsAt, type GitOptions } from "../lib/git.ts";
import { parseCodeOwners } from "./code-owners.ts";
import { isRecord } from "../lib/record.ts";
import { CONFIG_DIR } from "../lib/paths.ts";

type Landing = { sha: string; subject: string };
type Verdict = Landing & { verdict: "ok" | "no-pr" | "unverified-pr" | "wrong-base" | "unauthorized-merger"; pr: number | null };
export type PullRequest = { state: string; mergeCommit: string | null; base: string; mergedBy: string | null };
/** GitHub's record of a pull request, or null when it has none by that number. */
export type PullRequestLookup = (pr: number) => PullRequest | null;
/** The lower-case logins allowed to merge the given landing commit. */
type MergersAt = (sha: string) => readonly string[];
export type Options = { cwd?: string; output?: Output; lookup?: PullRequestLookup };

const CONFIG = `${CONFIG_DIR}landing-audit.json`;

/** The PR number in a GitHub merge-commit or squash-merge subject. */
export function prNumberOf(subject: string): number | null {
  const match = /^Merge pull request #(\d+) from /.exec(subject) ?? /\(#(\d+)\)$/.exec(subject);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function classifyLandings(commits: readonly Landing[], lookup: PullRequestLookup, mergersAt: MergersAt): Verdict[] {
  return commits.map((commit) => {
    const pr = prNumberOf(commit.subject);
    return { ...commit, pr, verdict: pr === null ? "no-pr" : verdictOf(lookup(pr), commit.sha, mergersAt) };
  });
}

function verdictOf(pull: PullRequest | null, sha: string, mergersAt: MergersAt): Verdict["verdict"] {
  if (pull?.state !== "MERGED" || pull.mergeCommit !== sha) return "unverified-pr";
  if (pull.base !== "main") return "wrong-base";
  if (pull.mergedBy === null || !mergersAt(sha).includes(pull.mergedBy.toLowerCase())) return "unauthorized-merger";
  return "ok";
}

// GitHub's own record of the PR. gh failing (not installed, not logged in, offline) or giving an
// answer of another shape is an error, never a verdict about the landing. A hung gh (a stalled
// network, an auth prompt) is stopped instead of stalling npm run audit.
const GH_TIMEOUT_MS = 60_000;

export function githubPullRequest(cwd: string | undefined, repo: string, { program = "gh", timeoutMs = GH_TIMEOUT_MS } = {}): PullRequestLookup {
  return (pr) => {
    const result = spawnSync(program, ["pr", "view", String(pr), "--repo", repo, "--json", "state,mergeCommit,baseRefName,mergedBy"], { cwd, encoding: "utf8", timeout: timeoutMs });
    if (result.error) throw new Error(`gh could not run: ${result.error.message}`);
    if (result.status !== 0) {
      if (/could not resolve to a pullrequest|no pull requests found/i.test(result.stderr)) return null;
      throw new Error(`gh pr view ${pr} failed: ${result.stderr.trim()}`);
    }
    const pull = pullRequestFrom(result.stdout);
    if (pull === undefined) throw new Error(`gh pr view ${pr} gave an answer without state, mergeCommit, baseRefName and mergedBy`);
    return pull;
  };
}

function pullRequestFrom(text: string): PullRequest | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return undefined; }
  if (!isRecord(parsed) || typeof parsed.state !== "string" || typeof parsed.baseRefName !== "string") return undefined;
  const mergeCommit = nullableField(parsed.mergeCommit, "oid");
  const mergedBy = nullableField(parsed.mergedBy, "login");
  if (mergeCommit === undefined || mergedBy === undefined) return undefined;
  return { state: parsed.state, mergeCommit, base: parsed.baseRefName, mergedBy };
}

// null stays null; an object yields its string field; anything else is malformed (undefined).
function nullableField(value: unknown, key: string): string | null | undefined {
  if (value === null) return null;
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

// The code owners on main just before this commit landed: the policy its merger was held to.
// The commit's own change to CODEOWNERS applies from the next landing on.
function mergersAt(options: GitOptions): MergersAt {
  return (sha) => {
    const parent = `${sha}^1`;
    if (git(["ls-tree", "--name-only", parent, "--", ".github/CODEOWNERS"], options) === "") return [];
    return parseCodeOwners(git(["show", `${parent}:.github/CODEOWNERS`], options));
  };
}

// Read from the fetched main, not the working tree, so a local edit cannot move the start point.
function auditConfig(main: string, options: GitOptions): { since: string; repo: string } {
  const parsed: unknown = JSON.parse(git(["show", `${main}:${CONFIG}`], options));
  const full = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
  if (!isRecord(parsed) || typeof parsed.since !== "string" || !full.test(parsed.since)) throw new Error(`${CONFIG} needs a full "since" commit id`);
  if (typeof parsed.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(parsed.repo)) throw new Error(`${CONFIG} needs "repo" as owner/name`);
  return { since: parsed.since, repo: parsed.repo };
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(`Usage: node scripts/git/landing-audit.ts\nChecks that each first-parent commit on origin/main after the "since" commit in ${CONFIG} is a pull request into main, merged as that commit by a code owner of the time. Commits at and before "since" are not audited. Exit: 0 all landed by PR, 1 found others, 2 the audit could not run.`);
    return EXIT_OK;
  }
  if (args.length > 0) {
    output.warn("landing-audit: takes no arguments. See --help.");
    return EXIT_ERROR;
  }
  const gitOptions = gitOptionsAt(options.cwd);
  // A stale origin/main would audit old history and could report a direct push as absent.
  const mainCommit = fetchMain(gitOptions);
  const { since, repo } = auditConfig(mainCommit, gitOptions);
  // A boundary off main's first-parent line would make since..main include or skip landings.
  if (!gitLines(["rev-list", "--first-parent", mainCommit], gitOptions).includes(since)) throw new Error(`${CONFIG}: "since" ${since} is not on main's first-parent history`);
  const commits = gitLines(["log", "--first-parent", "--format=%H%x09%s", `${since}..${mainCommit}`], gitOptions)
    .map((line) => { const [sha = "", ...subject] = line.split("\t"); return { sha, subject: subject.join("\t") }; });
  const verdicts = classifyLandings(commits, options.lookup ?? githubPullRequest(options.cwd, repo), mergersAt(gitOptions));
  const bad = verdicts.filter((entry) => entry.verdict !== "ok");
  for (const entry of bad) output.warn(`  x ${entry.sha.slice(0, 12)} [${entry.verdict}] ${entry.subject}`);
  if (bad.length === 0) output.write(`landing-audit: ${verdicts.length} commit(s) on ${repo} main after ${since.slice(0, 12)} all landed by a pull request into main that a code owner of the time merged; history at and before ${since.slice(0, 12)} is outside this audit`);
  return bad.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
