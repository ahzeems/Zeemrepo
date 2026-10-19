// Runs inside the disposable container that isolated-run.ts launches (S14, finding A01). The host
// copies in a spec, a bundle of the pinned base and this tooling; everything here reports data the
// host trusts none of.
//   init <dir> <spec> <bundle>: a fresh repository in <dir>/run on the base, on the run branch
//   run <dir>:                  the actual coordinator (coordinator.ts) with the SDK's noSandbox
//                               provider, so its agents and its Git cleanup run in this container
//   export <dir>:               the run branch as an S13 candidate artifact in <dir>/artifacts, with
//                               bounded recovery data for unfinished work
// The host runs export after run whatever run did, including after a timeout or interruption.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as sdk from "@ai-hero/sandcastle";
import type { AgentProvider, NoSandboxProvider } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { EXIT_ERROR, EXIT_OK, consoleOutput, isEntryPoint, runCli } from "../lib/cli.ts";
import { environmentFor } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";
import { BUNDLE_FILE, LIMITS, MANIFEST_FILE, MANIFEST_VERSION, RECOVERY_FILE, parseBundleHeader, sha256, type Claim } from "./artifact.ts";
import { runSandcastle } from "./coordinator.ts";
import type { RunResult } from "./run-result.ts";

export type Spec = { repository: string; task: string; base: string; ref: string; baseRef: string };
type Agent = AgentProvider;

const USAGE = `Usage: node scripts/sandcastle/guest-runner.ts init <dir> <spec.json> <base.bundle>
       node scripts/sandcastle/guest-runner.ts run|export <dir>
Runs inside the isolated-run container only. Exit: 0 done, 1 the step failed, 2 called wrongly.`;

export const RUN_RESULT = "run-result.json";
const SPEC = "spec.json";
const BRANCH_PREFIX = "refs/heads/";
// Git the export runs on the repository the agents controlled ignores what they planted there.
const HARDENED = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"];
const PATCH_LIMIT = 256 * 1024;

function git(cwd: string, args: readonly string[]): { status: number | null; stdout: string } {
  const result = spawnSync("git", [...HARDENED, ...args], { cwd, env: environmentFor({ cwd }), encoding: "utf8", maxBuffer: LIMITS.bundleBytes, stdio: ["ignore", "pipe", "pipe"] });
  return { status: result.status, stdout: result.stdout.replace(/\n+$/, "") };
}

function must(cwd: string, args: readonly string[]): string {
  const result = git(cwd, args);
  if (result.status !== 0) throw new Error(`guest-runner: git ${args[0] ?? ""} failed (exit ${String(result.status)})`);
  return result.stdout;
}

export function readSpec(path: string): Spec {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  const keys = ["repository", "task", "base", "ref", "baseRef"] as const;
  if (!isRecord(value) || !keys.every((key) => typeof value[key] === "string")) throw new Error(`guest-runner: ${path} is not a run spec`);
  return { repository: String(value.repository), task: String(value.task), base: String(value.base), ref: String(value.ref), baseRef: String(value.baseRef) };
}

/** A fresh repository on the bundled base, checked out on the run branch; no host Git metadata exists here. */
export function init(dir: string, specPath: string, bundle: string): void {
  const spec = readSpec(specPath);
  const run = join(dir, "run");
  mkdirSync(run, { recursive: true });
  copyFileSync(specPath, join(dir, SPEC));
  must(run, ["init", "--quiet", "--initial-branch=sandcastle-init"]);
  must(run, ["fetch", "--quiet", "--no-tags", bundle, `${spec.baseRef}:refs/remotes/base/head`]);
  if (must(run, ["rev-parse", "refs/remotes/base/head^{commit}"]) !== spec.base) throw new Error("guest-runner: the bundle's base is not the spec's base");
  must(run, ["checkout", "--quiet", "-b", spec.ref.slice(BRANCH_PREFIX.length), spec.base]);
}

/** The real SDK with noSandbox standing in for the docker provider, and `agent` for every role. */
export function guestSandcastle(agent: (model: string) => Agent): Omit<typeof sdk, "claudeCode"> & { claudeCode(model: string): Agent; docker(): NoSandboxProvider } {
  return { ...sdk, claudeCode: agent, docker: () => noSandbox() };
}

/** Run the coordinator in <dir>/run and record its result there, as untrusted data for export. */
export async function run(dir: string, agent: (model: string) => Agent = sdk.claudeCode): Promise<RunResult> {
  const cwd = join(dir, "run");
  // createSandbox runs `git config --global`, so the run has a global config of its own.
  process.env.GIT_CONFIG_GLOBAL = join(dir, "gitconfig");
  if (!existsSync(process.env.GIT_CONFIG_GLOBAL)) writeFileSync(process.env.GIT_CONFIG_GLOBAL, "");
  // promptFile resolves against the process's working directory, not the SDK's cwd option.
  process.chdir(cwd);
  const result = await runSandcastle({ cwd, sandcastle: guestSandcastle(agent), log: (line) => consoleOutput.write(line), error: (line) => consoleOutput.warn(line) });
  writeFileSync(join(dir, RUN_RESULT), `${JSON.stringify(result)}\n`);
  return result;
}

function runStatus(dir: string): string {
  try {
    const value: unknown = JSON.parse(readFileSync(join(dir, RUN_RESULT), "utf8"));
    return isRecord(value) && typeof value.status === "string" ? value.status : "unreadable";
  } catch {
    return "interrupted";
  }
}

const claimOf = (status: string): Claim => (status === "complete" ? "succeeded" : status === "interrupted" ? "interrupted" : "failed");

type Branch = { ref: string; sha: string; patch: string };

// Work not in the run branch: other sandcastle branches as patches, and each worktree's uncommitted changes.
function unfinished(run: string, tip: string): { branches: Branch[]; uncommitted: { worktree: string; status: string; diff: string }[] } {
  const refs = must(run, ["for-each-ref", "--format=%(refname) %(objectname)", "refs/heads/sandcastle/"]).split("\n").filter((line) => line !== "");
  const branches = refs.map((line) => line.split(" ")).map(([ref = "", sha = ""]) => ({ ref, sha, patch: git(run, ["format-patch", "--stdout", `${tip}..${sha}`]).stdout.slice(0, PATCH_LIMIT) }));
  const worktrees = must(run, ["worktree", "list", "--porcelain"]).split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length));
  const uncommitted = worktrees.map((worktree) => ({ worktree, status: git(worktree, ["status", "--porcelain"]).stdout, diff: git(worktree, ["diff", "--no-ext-diff", "--no-textconv", "HEAD"]).stdout.slice(0, PATCH_LIMIT) }))
    .filter((entry) => entry.status !== "");
  return { branches, uncommitted };
}

/** Recovery data under S13's limit: whole when it fits, otherwise branch tips and statuses only. */
export function recoveryData(run: string, tip: string, status: string): Buffer {
  const { branches, uncommitted } = unfinished(run, tip);
  const whole = Buffer.from(JSON.stringify({ version: 1, status, tip, branches, uncommitted }));
  if (whole.length <= LIMITS.recoveryBytes) return whole;
  const brief = { version: 1, status, tip, truncated: true, branches: branches.map(({ ref, sha }) => ({ ref, sha })), uncommitted: uncommitted.map(({ worktree, status: state }) => ({ worktree, status: state.slice(0, 4096) })) };
  return Buffer.from(JSON.stringify(brief)).subarray(0, LIMITS.recoveryBytes);
}

function writeBundle(run: string, spec: Spec, artifacts: string): { sha256: string; bytes: number; prerequisites: string[] } {
  const path = join(artifacts, BUNDLE_FILE);
  must(run, ["bundle", "create", "--quiet", path, `^${spec.base}`, spec.ref]);
  const bytes = readFileSync(path);
  const header = parseBundleHeader(bytes);
  return { sha256: sha256(bytes), bytes: bytes.length, prerequisites: "header" in header ? header.header.prerequisites : [] };
}

/** The run branch as a candidate artifact, or recovery data alone when it holds nothing past the base. */
export function exportArtifacts(dir: string): "candidate" | "recovery-only" {
  const spec = readSpec(join(dir, SPEC));
  const run = join(dir, "run");
  const artifacts = join(dir, "artifacts");
  rmSync(artifacts, { recursive: true, force: true });
  mkdirSync(artifacts);
  const status = runStatus(dir);
  const tip = must(run, ["rev-parse", "--verify", `${spec.ref}^{commit}`]);
  const recovery = recoveryData(run, tip, status);
  writeFileSync(join(artifacts, RECOVERY_FILE), recovery);
  if (tip === spec.base) return "recovery-only";
  const bundle = writeBundle(run, spec, artifacts);
  const manifest = {
    version: MANIFEST_VERSION, repository: spec.repository, task: spec.task, base: spec.base,
    candidate: { ref: spec.ref, sha: tip }, bundle, recovery: { sha256: sha256(recovery), bytes: recovery.length },
    claims: { merge: claimOf(status) },
  };
  writeFileSync(join(artifacts, MANIFEST_FILE), `${JSON.stringify(manifest)}\n`);
  return "candidate";
}

export async function main(args: readonly string[], agent?: (model: string) => Agent): Promise<number> {
  const [mode, dir, ...rest] = args;
  if (mode === "init" && dir !== undefined && rest.length === 2) {
    init(dir, rest[0] ?? "", rest[1] ?? "");
    return EXIT_OK;
  }
  if (mode === "run" && dir !== undefined && rest.length === 0) {
    await run(dir, agent);
    return EXIT_OK;
  }
  if (mode === "export" && dir !== undefined && rest.length === 0) {
    consoleOutput.write(`guest-runner: exported ${exportArtifacts(dir)}`);
    return EXIT_OK;
  }
  consoleOutput.warn(USAGE);
  return EXIT_ERROR;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
