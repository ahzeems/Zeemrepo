import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { Run } from "../git/pr-ready.ts";
import type { Output } from "../lib/cli.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "./repo-fixture.ts";
import { main } from "../sandcastle/afk.ts";
import { handedRecordPath, writeHanded } from "../sandcastle/coordinator.ts";

export const PR_URL = "https://github.com/Zimfra/software_testing/pull/21";

// origin names the repository afk serves, as a real checkout's does. The fixture's own config
// allows only local transports, so neither afk's git nor a test's direct git can reach that URL;
// the runner routes origin's fetches and pushes to the bare remote, and a test publishes with
// publish() below.
export const AFK_ORIGIN = "https://github.com/Zimfra/software_testing.git";
export type AfkFixture = RepoFixture & { remote: string; origin: string };

export function fixture(t: TestContext, origin = AFK_ORIGIN): AfkFixture {
  const repo = createRepo("afk-");
  const remote = mkdtempSync(join(tmpdir(), "afk-remote-"));
  t.after(() => { repo.cleanup(); rmSync(remote, { recursive: true, force: true }); });
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  repo.git(["config", "protocol.allow", "never"]);
  repo.git(["config", "protocol.file.allow", "always"]);
  repo.commit("base");
  repo.git(["remote", "add", "origin", origin]);
  const fixed = { ...repo, remote, origin };
  publish(fixed, "main");
  repo.git(["switch", "--quiet", "-c", "feat/afk-work"]);
  return fixed;
}

/** Push a ref to the fixture's bare origin and update the remote-tracking refs, as a real push and fetch would. */
export function publish(repo: AfkFixture, ref: string): void {
  repo.git(["push", "--quiet", repo.remote, ref]);
  repo.git(["fetch", "--quiet", repo.remote, "+refs/heads/*:refs/remotes/origin/*"]);
}

// An issue branch with one commit, left unmerged; the caller merges it where it should land.
export function issueBranch(repo: RepoFixture, name: string): void {
  const from = repo.git(["symbolic-ref", "--short", "HEAD"]);
  repo.git(["switch", "--quiet", "-c", name, from]);
  repo.write(`${name.replaceAll("/", "-")}.md`, "work\n");
  repo.commit(`feat: ${name}`);
  repo.git(["switch", "--quiet", from]);
}

export function mergeInto(repo: RepoFixture, target: string, name: string): void {
  repo.git(["switch", "--quiet", target]);
  repo.git(["merge", "--quiet", "--no-ff", "-m", `Merge ${name}`, name]);
}

// The open pull request GitHub would list for the branch at `head`; a test overrides a field to break it.
export function exactPr(head: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 21, url: PR_URL, state: "OPEN", baseRefName: "main", headRefName: "feat/afk-work", headRefOid: head,
    headRepository: { name: "software_testing" }, headRepositoryOwner: { login: "Zimfra" }, isCrossRepository: false, ...overrides,
  };
}

type Reply = { status: number; stdout: string };
export const prList = (...prs: Record<string, unknown>[]): Reply => ({ status: 0, stdout: `${JSON.stringify(prs)}\n` });

export type Script = {
  loop?: () => number;
  pr?: Reply;
  // What gh pr list answers for the branch, given the commit at HEAD; by default the exact open PR.
  prs?: (head: string) => Reply;
  ghRepo?: Reply;
  failComments?: string[];
  // The coordinator's record of the branches it handed the merger: by default every local issue
  // branch, null for no record, a string for the record's raw text.
  handed?: readonly string[] | null | string;
};

// The commit GitHub would show as the branch's pull request head: the branch's tip on origin.
function pushedTip(repo: AfkFixture): string {
  const listed = repo.git(["ls-remote", repo.remote, `refs/heads/${repo.git(["symbolic-ref", "--short", "HEAD"])}`]);
  return listed.split("\t")[0] ?? "";
}

// Only local transports, so no git a test or a mutation starts can reach a network.
const NETWORK_FENCE = ["-c", "protocol.allow=never", "-c", "protocol.file.allow=always"];

// git runs for real; the Sandcastle loop, pr-ready, gh and npm are scripted and recorded.
export function runner(repo: AfkFixture, script: Script = {}): { run: Run; calls: string[]; inherited: string[] } {
  const calls: string[] = [];
  const inherited: string[] = [];
  const run: Run = (command, args, options) => {
    const line = `${command} ${args.join(" ")}`;
    calls.push(line);
    if (options?.inherit === true) inherited.push(line);
    if (command === "git") {
      const network = args[0] === "fetch" || args[0] === "push" ? ["-c", `url.${repo.remote}.insteadOf=${repo.origin}`] : [];
      const result = spawnSync("git", [...NETWORK_FENCE, ...network, ...args], { cwd: repo.dir, env: cleanGitEnv, encoding: "utf8" });
      return { status: result.status, stdout: result.stdout };
    }
    if (line === "node .sandcastle/main.ts") {
      const status = script.loop?.() ?? 0;
      const issues = (): string[] => repo.git(["for-each-ref", "--format=%(refname:short)", "refs/heads/sandcastle/issue-*"]).split("\n").filter((ref) => ref !== "");
      if (typeof script.handed === "string") writeFileSync(handedRecordPath(repo.dir), script.handed);
      else if (script.handed !== null) writeHanded(repo.dir, script.handed ?? issues());
      return { status, stdout: "" };
    }
    if (line === "node scripts/git/pr-ready.ts") {
      const landed = script.pr ?? { status: 0, stdout: `pr-ready: pull request ${PR_URL} is open.\n` };
      // A successful landing pushed the checked HEAD to the branch on origin, as pr-ready does.
      if (landed.status === 0) publish(repo, `HEAD:refs/heads/${repo.git(["symbolic-ref", "--short", "HEAD"])}`);
      return landed;
    }
    if (line === GH_REPO) return script.ghRepo ?? { status: 0, stdout: "Zimfra/software_testing\n" };
    if (command === "gh" && args[0] === "pr" && args[1] === "list") {
      const head = pushedTip(repo);
      return script.prs?.(head) ?? prList(exactPr(head));
    }
    if (command === "gh" && args[0] === "issue" && args[1] === "comment") {
      return { status: script.failComments?.includes(args[2] ?? "") === true ? 1 : 0, stdout: "" };
    }
    throw new Error(`unexpected ${line}`);
  };
  return { run, calls, inherited };
}

export function go(repo: RepoFixture, run: Run, args: string[] = [], env: NodeJS.ProcessEnv = {}): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd: repo.dir, output, run, env }), out: out.join("\n"), err: err.join("\n") };
}

export const comments = (calls: string[]): string[] => calls.filter((call) => call.startsWith("gh issue comment"));
export const GH_REPO = "gh repo view github.com/Zimfra/software_testing --json nameWithOwner --jq .nameWithOwner";
export const sawAnything = (calls: string[]): boolean => calls.some((call) => !call.startsWith("git ") && call !== GH_REPO);

