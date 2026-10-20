// Receives a candidate artifact (artifact.ts) into quarantine: a fresh directory holding copies
// of the checked files and a new bare repository with trusted configuration, into which the
// bundle's one ref is fetched as refs/quarantine/candidate. Git here runs with no system or
// global config, no hooks, no fsmonitor, object checks on, and only local transports. Nothing is
// checked out and nothing in the artifact is executed. An accepted candidate is still only a
// candidate: its builder claims are data, and nothing here verifies, reviews or publishes it.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { environmentFor } from "../lib/git.ts";
import { BUNDLE_FILE, LIMITS, MANIFEST_FILE, RECOVERY_FILE, SHA, printable, readArtifacts, validateArtifacts, type Checked, type Expected, type Files, type Limits, type Manifest } from "./artifact.ts";

export type Request = { artifacts: string; source: string; expected: Expected; root?: string; limits?: Limits; timeoutMs?: number };
export type Accepted = {
  accepted: true; quarantine: string; gitDir: string; base: string; kind: "full" | "incremental"; prerequisites: string[];
  candidate: { ref: string; sha: string };
  recovery: { path: string; sha256: string; bytes: number } | null;
  builderClaims: Manifest["claims"];
};
export type Refused = { accepted: false; quarantine: string | null; refusals: string[] };
export type Outcome = Accepted | Refused;

const CANDIDATE_REF = "refs/quarantine/candidate";
const BASE_REF = "refs/quarantine/base";
const TRUSTED_CONFIG = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-c", "fetch.fsckObjects=true",
  "-c", "transfer.fsckObjects=true", "-c", "pack.threads=1", "-c", "protocol.allow=never", "-c", "protocol.file.allow=always", "--no-replace-objects"];
// fsck and the 64 MiB bundle cap bound only compressed bytes; a few hundred bytes of deltas can
// inflate to gigabytes inside index-pack. Git refuses any single allocation over this limit, and
// one index-pack thread keeps several such objects from resolving at once.
const ALLOC_LIMIT = "64m";
// Many deltas each under the allocation limit still cost CPU time, so every Git command has a
// deadline; past it the command's whole process group is killed and the candidate is refused.
const TIMEOUT_MS = 120_000;

type Result = { status: number; stdout: string; stderr: string };
/** How one Git command is bounded; `kill` signals a process group and is replaceable in tests. */
export type RunOptions = { timeoutMs: number; maxOutput: number; kill?: (pid: number, signal: NodeJS.Signals) => void };
type Git = (args: readonly string[]) => Promise<Result>;

/** A Git command stopped at its deadline or output cap; the caller refuses the candidate rather than failing. */
class Stopped extends Error {}

// ESRCH means the group has already emptied, which is what the kill wanted; anything else is the tool's error.
function killGroup(kill: NonNullable<RunOptions["kill"]>, pid: number): Error | null {
  try {
    kill(-pid, "SIGKILL");
    return null;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH") return null;
    return error instanceof Error ? error : new Error(String(error));
  }
}

// Every GIT_ variable goes (lib/git.ts's rule for a named repository), then system and global
// config are switched off, so neither the guest nor the host user's settings reach this Git.
export function trustedEnv(): NodeJS.ProcessEnv {
  return { ...environmentFor({ cwd: tmpdir() }), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull, GIT_TERMINAL_PROMPT: "0", GIT_ALLOC_LIMIT: ALLOC_LIMIT };
}

// detached gives Git its own process group. A fetch hands the pack to an index-pack child, and a
// signal to the fetch alone leaves that child running as an orphan, so the whole group is killed.
// A stopped command settles on its exit or at once if it already exited (late output), never on
// its pipes closing, which an orphan would hold open. An unstopped command settles on close, and
// its exit clears the deadline: a group member that outlives git and holds the pipes is then not
// bounded. Only aliases or hooks could start one, and the trusted config allows neither.
export function runGit(gitDir: string, args: readonly string[], options: RunOptions): Promise<Result> {
  const { timeoutMs, maxOutput } = options;
  const kill = options.kill ?? ((pid: number, signal: NodeJS.Signals): void => { process.kill(pid, signal); });
  return new Promise((settle, fail) => {
    const child = spawn("git", [...TRUSTED_CONFIG, `--git-dir=${gitDir}`, ...args], { cwd: tmpdir(), env: trustedEnv(), stdio: ["ignore", "pipe", "pipe"], detached: true });
    const output: { stdout: Buffer[]; stderr: Buffer[]; bytes: number } = { stdout: [], stderr: [], bytes: 0 };
    let stopped: Error | null = null;
    let exited = false;
    const stop = (reason: Error): void => {
      if (stopped !== null) return;
      stopped = reason;
      clearTimeout(timer);
      const killFailure = exited || child.pid === undefined ? null : killGroup(kill, child.pid);
      if (killFailure !== null) fail(killFailure);
      else if (exited) fail(reason);
    };
    const timer = setTimeout(() => stop(new Stopped(`Git did not finish ${args[0] ?? ""} within ${String(timeoutMs)} ms; its process group was killed`)), timeoutMs);
    const collect = (into: Buffer[]) => (chunk: Buffer): void => {
      output.bytes += chunk.length;
      if (output.bytes > maxOutput) stop(new Stopped(`git ${args[0] ?? ""} wrote more than ${String(maxOutput)} bytes in quarantine; its process group was killed`));
      else into.push(chunk);
    };
    child.stdout.on("data", collect(output.stdout));
    child.stderr.on("data", collect(output.stderr));
    child.on("error", (error) => { clearTimeout(timer); fail(new Error(`git ${args[0] ?? ""} could not run in quarantine`, { cause: error })); });
    child.on("exit", () => {
      exited = true;
      clearTimeout(timer);
      if (stopped !== null) fail(stopped);
    });
    child.on("close", (status) => {
      if (stopped !== null) return fail(stopped);
      if (status === null) fail(new Error(`git ${args[0] ?? ""} was stopped by a signal in quarantine`));
      else settle({ status, stdout: Buffer.concat(output.stdout).toString("utf8").trim(), stderr: Buffer.concat(output.stderr).toString("utf8").trim() });
    });
  });
}

async function must(git: Git, args: readonly string[]): Promise<string> {
  const result = await git(args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in quarantine (exit ${String(result.status)}): ${result.stderr}`);
  return result.stdout;
}

const firstLine = (text: string): string => printable(text.split("\n")[0] ?? "");
const answers = async (git: Git, args: readonly string[]): Promise<boolean> => (await git(args)).status === 0;

function copyInto(quarantine: string, files: Files): void {
  const copy = (name: string, bytes: Buffer): void => writeFileSync(join(quarantine, name), bytes, { flag: "wx", mode: 0o600 });
  copy(MANIFEST_FILE, files.manifest);
  copy(BUNDLE_FILE, files.bundle);
  if (files.recovery !== null) copy(RECOVERY_FILE, files.recovery);
}

async function baseRefusals(git: Git, source: string, base: string, prerequisites: readonly string[]): Promise<string[]> {
  const fetched = await git(["fetch", "--no-tags", "--quiet", "--no-write-fetch-head", resolve(source), `${base}:${BASE_REF}`]);
  if (fetched.status !== 0 || !(await answers(git, ["cat-file", "-e", `${base}^{commit}`]))) return [`the trusted source does not hold the base ${base}`];
  const refusals: string[] = [];
  // 1 is "not an ancestor" and 128 a missing object; both mean the base cannot satisfy it.
  for (const sha of prerequisites) if (!(await answers(git, ["merge-base", "--is-ancestor", sha, base]))) refusals.push(`the prerequisite ${sha} is not in the base's history`);
  return refusals;
}

async function candidateRefusals(git: Git, bundle: string, manifest: Manifest): Promise<string[]> {
  const { ref, sha } = manifest.candidate;
  for (const args of [["bundle", "verify", "--quiet", bundle], ["fetch", "--no-tags", "--quiet", "--no-write-fetch-head", bundle, `+${ref}:${CANDIDATE_REF}`]]) {
    const result = await git(args);
    if (result.status !== 0) return [`Git refused the bundle (${args[0] ?? ""} exit ${String(result.status)}): ${firstLine(result.stderr)}`];
  }
  const imported = await must(git, ["rev-parse", "--verify", "--quiet", CANDIDATE_REF]);
  const type = await must(git, ["cat-file", "-t", imported]);
  if (type !== "commit") return [`the candidate ref names a ${type}, not a commit`];
  if (imported !== sha) return [`the bundle imported ${imported}, but the manifest says ${sha}`];
  if (imported === manifest.base) return ["the candidate adds no commit to the base"];
  if (!(await answers(git, ["merge-base", "--is-ancestor", manifest.base, imported]))) return [`the candidate ${imported} does not descend from the base ${manifest.base}`];
  return [];
}

function accept(quarantine: string, gitDir: string, checked: Checked): Accepted {
  const { manifest } = checked;
  const { recovery } = manifest;
  return {
    accepted: true, quarantine, gitDir, base: manifest.base,
    kind: manifest.bundle.prerequisites.length === 0 ? "full" : "incremental",
    prerequisites: [...manifest.bundle.prerequisites],
    candidate: { ref: CANDIDATE_REF, sha: manifest.candidate.sha },
    recovery: recovery === null ? null : { path: join(quarantine, RECOVERY_FILE), sha256: recovery.sha256, bytes: recovery.bytes },
    builderClaims: { ...manifest.claims },
  };
}

async function importRefusals(git: Git, gitDir: string, quarantine: string, source: string, manifest: Manifest): Promise<string[]> {
  try {
    await must(git, ["init", "--quiet", "--bare", "--template=", gitDir]);
    const base = await baseRefusals(git, source, manifest.base, manifest.bundle.prerequisites);
    return base.length > 0 ? base : await candidateRefusals(git, join(quarantine, BUNDLE_FILE), manifest);
  } catch (error) {
    if (error instanceof Stopped) return [error.message];
    throw error;
  }
}

/** Read, check and import one candidate artifact. A refusal keeps whatever reached quarantine for diagnostics. */
export async function quarantineCandidate(request: Request): Promise<Outcome> {
  const limits = request.limits ?? LIMITS;
  const read = readArtifacts(request.artifacts, limits);
  if ("refusals" in read) return { accepted: false, quarantine: null, refusals: read.refusals };
  const quarantine = mkdtempSync(join(request.root ?? tmpdir(), "candidate-quarantine-"));
  copyInto(quarantine, read.files);
  const checked = validateArtifacts(read.files, request.expected, limits);
  if ("refusals" in checked) return { accepted: false, quarantine, refusals: checked.refusals };
  const gitDir = join(quarantine, "repo.git");
  const git: Git = (args) => runGit(gitDir, args, { timeoutMs: request.timeoutMs ?? TIMEOUT_MS, maxOutput: limits.gitOutputBytes });
  const refusals = await importRefusals(git, gitDir, quarantine, request.source, checked.manifest);
  return refusals.length > 0 ? { accepted: false, quarantine, refusals } : accept(quarantine, gitDir, checked);
}

const USAGE = `Usage: node scripts/sandcastle/quarantine.ts --artifacts <dir> --source <trusted repo> --repository <owner/name>
  --task <id> --base <sha> --ref <refs/heads/...> [--quarantine-root <dir>]
Checks a Sandcastle candidate artifact and imports its bundle into a new quarantine repository.
It never checks out or runs candidate content, and acceptance is not verification or approval.
Exit: 0 accepted, 1 refused, 2 the tool failed or was called wrongly.`;

const FLAGS = ["--artifacts", "--source", "--repository", "--task", "--base", "--ref", "--quarantine-root"];
const BRANCH_REF = /^refs\/heads\/(?!.*\.\.)(?!.*\/\.)[A-Za-z0-9._/-]+$/;

function parseArgs(args: readonly string[]): Map<string, string> | string {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const [flag = "", value] = [args[i], args[i + 1]];
    if (!FLAGS.includes(flag) || value === undefined || values.has(flag)) return `quarantine: unknown, repeated or valueless argument ${flag}. See --help.`;
    values.set(flag, value);
  }
  const missing = FLAGS.slice(0, -1).filter((flag) => !values.has(flag));
  if (missing.length > 0) return `quarantine: missing ${missing.join(", ")}. See --help.`;
  if (!SHA.test(values.get("--base") ?? "")) return "quarantine: --base must be a full lowercase SHA-1.";
  if (!BRANCH_REF.test(values.get("--ref") ?? "")) return "quarantine: --ref must be one branch ref under refs/heads/.";
  return values;
}

function report(outcome: Outcome, output: Output): number {
  if (!outcome.accepted) {
    for (const refusal of outcome.refusals) output.warn(`quarantine: ${refusal}`);
    if (outcome.quarantine !== null) output.warn(`quarantine: the rejected artifact is kept for diagnostics in ${outcome.quarantine}`);
    return EXIT_REFUSED;
  }
  output.write(`quarantine: accepted candidate ${outcome.candidate.sha} (${outcome.kind}) on base ${outcome.base} as ${outcome.candidate.ref} in ${outcome.gitDir}`);
  if (outcome.recovery !== null) output.write(`quarantine: recovery data (${String(outcome.recovery.bytes)} bytes) is kept, not applied, at ${outcome.recovery.path}`);
  output.write(`quarantine: builder claims are not verification: ${JSON.stringify(outcome.builderClaims)}`);
  return EXIT_OK;
}

export async function main(args: readonly string[], options: { output?: Output } = {}): Promise<number> {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  const values = parseArgs(args);
  if (typeof values === "string") {
    output.warn(values);
    return EXIT_ERROR;
  }
  const value = (flag: string): string => values.get(flag) ?? "";
  const expected: Expected = { repository: value("--repository"), task: value("--task"), base: value("--base"), ref: value("--ref") };
  const root = values.get("--quarantine-root");
  return report(await quarantineCandidate({ artifacts: value("--artifacts"), source: value("--source"), expected, ...(root === undefined ? {} : { root }) }), output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
