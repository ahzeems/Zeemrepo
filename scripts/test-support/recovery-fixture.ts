import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Repository, Run } from "../git/pr-ready.ts";
import { cleanGitEnv } from "./repo-fixture.ts";
import { createVerifierCandidate, guestOn, REPOSITORY, type VerifierFixture, type VerifierOptions } from "./verifier-fixture.ts";

// A control checkout whose origin is a local bare repository standing in for GitHub's git side,
// plus a stateful fake of GitHub's API side: pull requests and issue comments that persist across
// runs, so a write whose acknowledgement is lost is still there when a retry looks for it. Git runs
// for real; gh never leaves this process.
export const GITHUB: Repository = { host: "github.com", owner: "Zimfra", name: "software_testing" };
const ORIGIN_URL = "https://github.com/Zimfra/software_testing.git";
const NETWORK_FENCE = ["-c", "protocol.allow=never", "-c", "protocol.file.allow=always"];
export const MACHINE = "zimmybot";

export type Reply = { status: number | null; stdout: string };
export type Comment = { login: string; url: string; body: string };
type PullRequest = { number: number; url: string; branch: string; head: string };
/** One-shot faults: each fires on the next matching call, then clears. */
export type Faults = { createLostAck?: boolean; commentLostAck?: boolean; commentFails?: boolean; commentsUnreadable?: boolean };

export type FakeGitHub = {
  pulls: PullRequest[]; comments: Map<string, Comment[]>; faults: Faults;
  creates: number; posts: number; reads: number; reply(args: readonly string[]): Reply;
};

const json = (value: unknown): Reply => ({ status: 0, stdout: `${JSON.stringify(value)}\n` });

function prJson(pr: PullRequest): Record<string, unknown> {
  return {
    number: pr.number, url: pr.url, state: "OPEN", baseRefName: "main", headRefName: pr.branch, headRefOid: pr.head,
    headRepository: { name: GITHUB.name }, headRepositoryOwner: { login: GITHUB.owner }, isCrossRepository: false,
  };
}

const flag = (args: readonly string[], name: string): string => args[args.indexOf(name) + 1] ?? "";

function createPull(github: FakeGitHub, remote: string, args: readonly string[]): Reply {
  github.creates++;
  const number = github.pulls.length + 7;
  const url = `https://github.com/Zimfra/software_testing/pull/${String(number)}`;
  const branch = flag(args, "--head");
  const head = execFileSync("git", ["--git-dir", remote, "rev-parse", `refs/heads/${branch}`], { env: cleanGitEnv, encoding: "utf8" }).trim();
  github.pulls.push({ number, url, branch, head });
  if (github.faults.createLostAck === true) {
    github.faults.createLostAck = false;
    return { status: 1, stdout: "" };
  }
  return { status: 0, stdout: `${url}\n` };
}

function postComment(github: FakeGitHub, args: readonly string[]): Reply {
  if (github.faults.commentFails === true) {
    github.faults.commentFails = false;
    return { status: 1, stdout: "" };
  }
  github.posts++;
  const issue = args[2] ?? "";
  const url = `https://github.com/Zimfra/software_testing/issues/${issue}#issuecomment-${String(github.posts)}`;
  github.comments.set(issue, [...(github.comments.get(issue) ?? []), { login: MACHINE, url, body: flag(args, "--body") }]);
  if (github.faults.commentLostAck === true) {
    github.faults.commentLostAck = false;
    return { status: 1, stdout: "" };
  }
  return { status: 0, stdout: `${url}\n` };
}

// gh api --paginate --jq '... | tojson' prints one JSON object per line.
function listComments(github: FakeGitHub, args: readonly string[]): Reply {
  github.reads++;
  if (github.faults.commentsUnreadable === true) {
    github.faults.commentsUnreadable = false;
    return { status: 1, stdout: "" };
  }
  const path = args.find((arg) => arg.startsWith("repos/")) ?? "";
  const issue = /issues\/(\d+)\/comments$/.exec(path)?.[1] ?? "";
  return { status: 0, stdout: (github.comments.get(issue) ?? []).map((entry) => `${JSON.stringify(entry)}\n`).join("") };
}

function viewPull(github: FakeGitHub, args: readonly string[]): Reply {
  const pr = github.pulls.find((entry) => String(entry.number) === args[2]);
  return pr === undefined ? { status: 1, stdout: "" } : json(prJson(pr));
}

export function fakeGitHub(remote: string): FakeGitHub {
  const github: FakeGitHub = { pulls: [], comments: new Map(), faults: {}, creates: 0, posts: 0, reads: 0, reply: () => ({ status: 1, stdout: "" }) };
  github.reply = (args) => {
    const [area, verb] = args;
    if (area === "auth") return { status: 0, stdout: "" };
    if (area === "api" && verb === "user") return { status: 0, stdout: `${MACHINE}\n` };
    if (area === "api") return listComments(github, args);
    if (area === "repo" && verb === "view") return { status: 0, stdout: "Zimfra\n" };
    if (area === "pr" && verb === "list") return json(github.pulls.filter((pr) => pr.branch === flag(args, "--head")).map(prJson));
    if (area === "pr" && verb === "create") return createPull(github, remote, args);
    if (area === "pr" && verb === "view") return viewPull(github, args);
    if (area === "issue" && verb === "comment") return postComment(github, args);
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
  return github;
}

export type RecoveryFixture = VerifierFixture & { remote: string; state: string; github: FakeGitHub; runner: Run };

/** A verifier fixture whose control checkout publishes to a bare remote, with a fresh private state store. */
export function createRecoveryFixture(options: VerifierOptions = {}): RecoveryFixture {
  const made = createVerifierCandidate(options);
  const remote = mkdtempSync(join(tmpdir(), "recovery-remote-"));
  const state = mkdtempSync(join(tmpdir(), "recovery-state-"));
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  made.host.git(["remote", "add", "origin", remote]);
  made.host.git(["push", "--quiet", "origin", "main"]);
  made.host.git(["fetch", "--quiet", "origin"]);
  made.host.git(["remote", "set-url", "origin", ORIGIN_URL]);
  const github = fakeGitHub(remote);
  const runner: Run = (command, args) => {
    if (command === "gh") return github.reply(args);
    if (command !== "git") throw new Error(`recovery started ${command}`);
    const network = args.some((arg) => ["push", "fetch", "ls-remote"].includes(arg)) ? ["-c", `url.${remote}.insteadOf=${ORIGIN_URL}`] : [];
    const result = spawnSync("git", [...NETWORK_FENCE, ...network, ...args], { cwd: made.host.dir, env: cleanGitEnv, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout };
  };
  const cleanup = (): void => {
    made.cleanup();
    for (const dir of [remote, state]) rmSync(dir, { recursive: true, force: true });
  };
  return { ...made, remote, state, github, runner, cleanup };
}

/** An artifact for another issue's task on the same base, as a second sandbox would export it. */
export function artifactForTask(made: VerifierFixture, task: string, files: Readonly<Record<string, string>>): { artifacts: string; candidate: string; ref: string } {
  const guest = guestOn(made.host, made.base);
  for (const [path, content] of Object.entries(files)) guest.write(path, content);
  const candidate = guest.commit(`feat: ${task}`);
  const ref = `refs/heads/sandcastle/${task}`;
  const artifacts = mkdtempSync(join(tmpdir(), "recovery-artifact-"));
  guest.git(["update-ref", ref, candidate]);
  guest.git(["bundle", "create", "--quiet", join(artifacts, "candidate.bundle"), ref]);
  guest.cleanup();
  const bytes = readFileSync(join(artifacts, "candidate.bundle"));
  const manifest = {
    version: 1, repository: REPOSITORY, task, base: made.base, candidate: { ref, sha: candidate },
    bundle: { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, prerequisites: [] },
    claims: { implement: "succeeded", review: "succeeded" },
  };
  writeFileSync(join(artifacts, "candidate.json"), JSON.stringify(manifest));
  return { artifacts, candidate, ref };
}

/** The SHA-256 of every file in a directory, by name, to show a run left it untouched. */
export function digests(dir: string, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, createHash("sha256").update(readFileSync(join(dir, name))).digest("hex")]));
}
