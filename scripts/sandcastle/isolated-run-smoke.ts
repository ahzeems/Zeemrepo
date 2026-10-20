// The real-container control for the isolated preparation stage (S14). npm run sandbox:smoke runs it
// after the containment proof, on the image it just built, so the required CI check exercises
// isolated-run.ts end to end with real Docker and the scripted fixture agents (no model):
//   positive: the actual coordinator plans, implements, reviews and merges one issue in the guest;
//             the candidate must come back through quarantine on the pinned base, unverified, with
//             the fsmonitor its implementer planted shown to have fired in the guest, no marker on
//             the host and the host source repository unchanged.
//   hang:     the implementer commits and never returns; the run must time out, claim no candidate
//             and keep the committed issue branch in its recovery data.
// Missing Docker is blocked, never a pass.
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, stateChanges } from "../git/git-state.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { gitOptionsAt } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";
import { printable } from "./artifact.ts";
import { REPOSITORY, TASK, createTarget, type Behaviour } from "../test-support/isolated-run-fixture.ts";
import { dockerCli, dockerRuntime } from "./container-runtime.ts";
import { BOUNDS, dockerExec, prepareRun, type Deps, type Prepared } from "./isolated-run.ts";
import { runGit } from "./quarantine.ts";

export type Observed = { prepared: Prepared; base: string; markerOnHost: boolean; hostChanges: string[]; fired: string; recovery: string | null };

const USAGE = `Usage: node scripts/sandcastle/isolated-run-smoke.ts <image>
Runs the isolated preparation stage twice in real containers from <image> with scripted agents.
Exit: 0 it behaved, 1 it did not or Docker is missing, 2 called wrongly.`;

const TOOLING = join(import.meta.dirname, "..", "..");
const FIXTURE_GUEST = "scripts/test-support/isolated-run-fixture.ts";
const HANG_TIMEOUT_MS = 120_000;
const REQUIRED_FLAGS = ["--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", ...BOUNDS];

function sharedRefusals({ prepared, markerOnHost, hostChanges }: Observed): string[] {
  const refusals = REQUIRED_FLAGS.filter((flag) => !prepared.pinned.launch.includes(flag)).map((flag) => `the launch lacked ${flag}`);
  if (prepared.verified || prepared.published) refusals.push("the preparation claimed verification or publication");
  if (markerOnHost) refusals.push("a sentinel the guest's agent wrote appeared on the host");
  refusals.push(...hostChanges.map((change) => `the host source repository changed: ${change}`));
  return refusals;
}

/** The positive run's observations, each required. */
export function positiveRefusals(observed: Observed): string[] {
  const { prepared, base, fired } = observed;
  const refusals = sharedRefusals(observed);
  if (prepared.status !== "candidate" || prepared.candidate === null) return [...refusals, `the run returned ${prepared.status}, not a quarantined candidate: ${prepared.refusals.join("; ")}`];
  if (prepared.run !== "completed") refusals.push(`the run ended ${prepared.run}, not completed`);
  if (prepared.candidate.base !== base || prepared.pinned.base !== base) refusals.push(`the candidate is on ${prepared.candidate.base}, not the pinned base ${base}`);
  if (!fired.includes("fsmonitor")) refusals.push("the planted fsmonitor did not fire inside the guest, so the run proved nothing about where Git ran");
  return refusals;
}

function keepsIssueBranch(recovery: string | null): boolean {
  try {
    const value: unknown = JSON.parse(recovery ?? "");
    const branches: unknown[] = isRecord(value) && Array.isArray(value.branches) ? value.branches : [];
    return branches.some((branch) => isRecord(branch) && branch.ref === "refs/heads/sandcastle/issue-1" && typeof branch.patch === "string" && branch.patch.includes("work.txt"));
  } catch {
    return false;
  }
}

/** The hung run's observations: timed out, no candidate, and the committed work kept. */
export function hangRefusals(observed: Observed): string[] {
  const { prepared, recovery } = observed;
  const refusals = sharedRefusals(observed);
  if (prepared.run !== "timed-out") refusals.push(`the hung run ended ${prepared.run}, not timed-out`);
  if (prepared.status !== "no-candidate" || prepared.candidate !== null) refusals.push(`the hung run claims ${prepared.status} instead of no candidate`);
  if (recovery === null) refusals.push("the hung run kept no recovery data");
  else if (!keepsIssueBranch(recovery)) refusals.push("the hung run's recovery data lost the committed sandcastle/issue-1 work");
  return refusals;
}

async function fired(prepared: Prepared): Promise<string> {
  if (prepared.candidate === null) return "";
  const shown = await runGit(prepared.candidate.gitDir, ["show", `${prepared.candidate.candidate.sha}:fired.txt`], { timeoutMs: 60_000, maxOutput: 64 * 1024 });
  return shown.status === 0 ? shown.stdout : "";
}

const LOG_TAIL_BYTES = 4096;

// The guest log is untrusted text, so each line is escaped before it reaches the terminal.
function logTail(out: string): string[] {
  const path = join(out, "guest.log");
  if (!existsSync(path)) return [];
  return readFileSync(path).subarray(-LOG_TAIL_BYTES).toString("utf8").split("\n").map((line) => `  | ${printable(line)}`);
}

async function observe(image: string, implementer: Behaviour["implementer"], deps: Deps): Promise<Observed & { log: string[] }> {
  const marker = `/tmp/isolated-run-marker-${randomBytes(8).toString("hex")}`;
  const target = createTarget({ marker, implementer });
  const scratch = mkdtempSync(join(tmpdir(), "isolated-run-control-"));
  try {
    const before = readState(gitOptionsAt(target.dir));
    const prepared = await prepareRun({
      source: target.dir, baseRef: "refs/heads/main", repository: REPOSITORY, task: TASK, tooling: TOOLING, image, out: join(scratch, "run"),
      guest: FIXTURE_GUEST, ...(implementer === "hang" ? { timeoutMs: HANG_TIMEOUT_MS } : {}),
    }, deps);
    const hostChanges = stateChanges(before, readState(gitOptionsAt(target.dir)));
    const recovery = prepared.recovery === null ? null : readFileSync(prepared.recovery, "utf8");
    const log = logTail(join(scratch, "run"));
    return { prepared, base: target.git(["rev-parse", "HEAD"]), markerOnHost: existsSync(marker), hostChanges, fired: await fired(prepared), recovery, log };
  } finally {
    target.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Refusals unless both runs behave in real containers; blocked when Docker or the image is missing. */
export async function isolatedRunControl(image: string, deps: Deps = { docker: dockerCli(), exec: dockerExec() }): Promise<string[]> {
  if (dockerRuntime(deps.docker, image).identity() === null) return [`blocked: Docker or the image ${image} is not available, so the isolated run was not exercised. This is not a pass.`];
  const positive = await observe(image, "commit", deps);
  const hang = await observe(image, "hang", deps);
  const named = (name: string, refusals: string[], log: string[]): string[] =>
    refusals.length === 0 ? [] : [...refusals.map((refusal) => `${name}: ${refusal}`), `${name}: guest log tail:\n${log.join("\n")}`];
  return [...named("positive", positiveRefusals(positive), positive.log), ...named("hang", hangRefusals(hang), hang.log)];
}

export async function main(args: readonly string[], options: { output?: Output; deps?: Deps } = {}): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [image] = args;
  if (image === undefined || args.length !== 1 || image.startsWith("-")) {
    output.warn(USAGE);
    return EXIT_ERROR;
  }
  const refusals = await isolatedRunControl(image, options.deps);
  for (const refusal of refusals) output.warn(`isolated-run-control: ${refusal}`);
  if (refusals.length > 0) return EXIT_REFUSED;
  output.write("isolated-run-control: the coordinator ran in a bounded container and returned an unverified candidate on the pinned base; its planted fsmonitor fired only in the guest; a hung run timed out with its committed work kept as recovery data.");
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
