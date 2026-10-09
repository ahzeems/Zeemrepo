// npm run audit: does every commit on main's first-parent history since the PR-only rule
// began correspond to a pull request the owner merged? Read-only. Zimi's audit walked git
// notes, which do not travel with fetch; this asks GitHub, which records every merge.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { gitLines, type GitOptions } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";

export type Landing = { sha: string; subject: string };
export type Verdict = Landing & { verdict: "ok" | "no-pr" | "unverified-pr"; pr: number | null };
export type MergedCheck = (pr: number, sha: string) => boolean;
export type Options = { cwd?: string; output?: Output; merged?: MergedCheck };

const CONFIG = "config/landing-audit.json";

/** The PR number in a GitHub merge-commit or squash-merge subject. */
export function prNumberOf(subject: string): number | null {
  const match = /^Merge pull request #(\d+) from /.exec(subject) ?? /\(#(\d+)\)$/.exec(subject);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function classifyLandings(commits: readonly Landing[], merged: MergedCheck): Verdict[] {
  return commits.map((commit) => {
    const pr = prNumberOf(commit.subject);
    if (pr === null) return { ...commit, pr, verdict: "no-pr" };
    return { ...commit, pr, verdict: merged(pr, commit.sha) ? "ok" : "unverified-pr" };
  });
}

// GitHub's own record: the PR is merged and its merge commit is this commit.
function githubMerged(cwd: string | undefined): MergedCheck {
  return (pr, sha) => {
    const result = spawnSync("gh", ["pr", "view", String(pr), "--json", "state,mergeCommit"], { cwd, encoding: "utf8" });
    if (result.error || result.status !== 0) return false;
    const parsed: unknown = JSON.parse(result.stdout);
    return isRecord(parsed) && parsed.state === "MERGED" && isRecord(parsed.mergeCommit) && parsed.mergeCommit.oid === sha;
  };
}

function since(root: string): string {
  const parsed: unknown = JSON.parse(readFileSync(join(root, CONFIG), "utf8"));
  if (!isRecord(parsed) || typeof parsed.since !== "string" || !/^[a-f0-9]{7,40}$/.test(parsed.since)) throw new Error(`${CONFIG} needs a "since" commit`);
  return parsed.since;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(`Usage: node scripts/git/landing-audit.ts\nChecks that each first-parent commit on origin/main after the "since" commit in ${CONFIG} is a merged PR. Exit: 0 all landed by PR, 1 found others, 2 the audit could not run.`);
    return EXIT_OK;
  }
  if (args.length > 0) {
    output.warn("landing-audit: takes no arguments. See --help.");
    return EXIT_ERROR;
  }
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const first = since(options.cwd ?? process.cwd());
  const commits = gitLines(["log", "--first-parent", "--format=%H%x09%s", `${first}..refs/remotes/origin/main`], gitOptions)
    .map((line) => { const [sha = "", ...subject] = line.split("\t"); return { sha, subject: subject.join("\t") }; });
  const verdicts = classifyLandings(commits, options.merged ?? githubMerged(options.cwd));
  const bad = verdicts.filter((entry) => entry.verdict !== "ok");
  for (const entry of bad) output.warn(`  x ${entry.sha.slice(0, 12)} [${entry.verdict}] ${entry.subject}`);
  if (bad.length === 0) output.write(`landing-audit: ${verdicts.length} commit(s) on main since ${first.slice(0, 12)} all landed by merged pull request`);
  return bad.length === 0 ? EXIT_OK : EXIT_REFUSED;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
