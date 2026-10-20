// The isolated preparation stage (S14, finding A01): trusted host code runs the actual Sandcastle
// coordinator, its agents and the SDK's Git cleanup inside one disposable container, and takes
// back only an S13 candidate artifact and bounded recovery data. Nothing here verifies, reviews or
// publishes; the public sandcastle commands are not routed through it until S18.
//   1. Pin the inputs: the base SHA of a ref in the trusted source, and this control checkout's
//      HEAD as the guest tooling (the checkout must be clean).
//   2. Create a container with S12's flags plus memory, CPU and process limits, refused unless
//      docker inspect shows no mount, privilege or credential and the limits in place. Only three
//      files are copied in: the tooling tree, a bundle of the base and the run spec. No host Git
//      directory, checkout, home or runtime-control socket is ever named to Docker.
//   3. In the guest: install the tooling, start a fresh repository from the bundle, run the
//      coordinator with noSandbox (guest-runner.ts) under a deadline and the caller's AbortSignal.
//      A timed-out or interrupted run is killed inside the container, and the export runs anyway.
//   4. Copy each artifact file out through `docker exec base64`, bounded, into the run-owned
//      `out` directory, then remove the container. A candidate bundle goes through quarantine.ts;
//      the guest's phase labels stay data and the result is never verified or published.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { tryGit } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";
import { BUNDLE_FILE, LIMITS, MANIFEST_FILE, RECOVERY_FILE, SHA, printable, type Expected } from "./artifact.ts";
import { inspectRefusals, launchRefusals } from "./containment-smoke.ts";
import { dockerRuntime, type Docker } from "./container-runtime.ts";
import { quarantineCandidate, type Accepted } from "./quarantine.ts";

export type Ended = "exited" | "timed-out" | "interrupted";
export type AsyncDocker = (args: readonly string[], options: { timeoutMs: number; signal?: AbortSignal; log?: string }) => Promise<{ status: number | null; ended: Ended }>;
export type Request = {
  source: string; baseRef: string; repository: string; task: string; tooling: string; image: string; out: string;
  /** The tooling-relative script that runs the coordinator; the fake-agent control names its fixture. */
  guest?: string; timeoutMs?: number; signal?: AbortSignal;
};
export type RunEnd = "completed" | "failed" | "timed-out" | "interrupted" | "not-started";
export type Prepared = {
  status: "candidate" | "no-candidate" | "refused" | "blocked" | "failed";
  run: RunEnd; verified: false; published: false;
  pinned: { base: string; tooling: string; image: string | null; launch: string[] };
  candidate: Accepted | null; recovery: string | null; refusals: string[];
};
export type Deps = { docker: Docker; exec: AsyncDocker };

export const GUEST_DIR = "/home/agent/isolated";
const TOOLING_DIR = "/home/agent/tooling";
const INPUTS = { tooling: "/tmp/tooling.tar", bundle: "/tmp/base.bundle", spec: "/tmp/spec.json" };
const GUEST_RUNNER = "scripts/sandcastle/guest-runner.ts";
// The coordinator legitimately runs for hours on a real backlog; past this the run is stopped.
export const RUN_TIMEOUT_MS = 4 * 60 * 60_000;
const SETUP_TIMEOUT_MS = 20 * 60_000;
const EXPORT_TIMEOUT_MS = 10 * 60_000;
const LOG_BYTES = 16 * 1024 * 1024;
export const BOUNDS = ["--memory=4g", "--cpus=2", "--pids-limit=1024"];
const TASK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// A Docker image reference: name, optional tag or digest. Starting alphanumeric keeps it from reading as an option.
const IMAGE = /^[a-z0-9][a-z0-9._/:@-]{0,254}$/;
const REF = /^refs\/(?!.*\.\.)[A-Za-z0-9._/-]+$/;
const COPIED: readonly [string, string][] = [["tooling.tar", INPUTS.tooling], ["base.bundle", INPUTS.bundle], ["spec.json", INPUTS.spec]];
const FILES: readonly [string, number][] = [[MANIFEST_FILE, LIMITS.manifestBytes], [BUNDLE_FILE, LIMITS.bundleBytes], [RECOVERY_FILE, LIMITS.recoveryBytes]];

const SETUP = [
  "set -eu", `mkdir "${TOOLING_DIR}"`, `tar -x -f ${INPUTS.tooling} -C "${TOOLING_DIR}"`, `cd "${TOOLING_DIR}"`,
  "npm ci --no-audit --no-fund", `node ${GUEST_RUNNER} init "${GUEST_DIR}" ${INPUTS.spec} ${INPUTS.bundle}`,
].join("\n");

/** The guest container: S12's required flags, resource limits, the image's idle entrypoint, no mount and no environment. */
export function createArgs(name: string, image: string): string[] {
  return ["create", "--name", name, "--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", ...BOUNDS, image];
}

/** Limits docker inspect must show, so a runaway agent cannot exhaust the host. */
export function boundRefusals(value: unknown): string[] {
  const container: unknown = Array.isArray(value) ? value[0] : undefined;
  const host = isRecord(container) && isRecord(container.HostConfig) ? container.HostConfig : {};
  const positive = (key: string): boolean => typeof host[key] === "number" && host[key] > 0;
  return ["Memory", "NanoCpus", "PidsLimit"].filter((key) => !positive(key)).map((key) => `HostConfig.${key} is not limited`);
}

/** Docker run asynchronously, so a deadline or the caller's signal can stop it; output goes to a capped log. */
export function dockerExec(program = "docker", logBytes = LOG_BYTES): AsyncDocker {
  return (args, { timeoutMs, signal, log }) => new Promise((settle, fail) => {
    const child = spawn(program, args, { stdio: ["ignore", "pipe", "pipe"] });
    const fd = log === undefined ? null : openSync(log, "a", 0o600);
    let written = 0;
    const keep = (chunk: Buffer): void => {
      if (fd === null || written >= logBytes) return;
      written += writeSync(fd, chunk.subarray(0, logBytes - written));
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    let ended: Ended = "exited";
    const stop = (why: Ended) => (): void => {
      ended = why;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(stop("timed-out"), timeoutMs);
    const onAbort = stop("interrupted");
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted === true) onAbort();
    child.on("error", (error) => fail(error));
    child.on("close", (status) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (fd !== null) closeSync(fd);
      settle({ status: ended === "exited" ? status : null, ended });
    });
  });
}

// The only Docker calls the launcher makes, as subcommand (with "image inspect" as one) and the
// options each may carry before its container or image: a flag allowed exactly as written, or one
// that takes the next argument as its value. Anything else, including a global option before the
// subcommand, an unknown option or a short-option cluster that could hide -e, fails closed. Docker
// also reads options after a positional, so only exec, whose trailing arguments are the guest
// program's, may have an option-like argument after its container.
const CALLS: Readonly<Record<string, { flags: readonly string[]; valued: readonly string[]; bare?: true }>> = {
  version: { flags: [], valued: ["--format"], bare: true },
  "image inspect": { flags: [], valued: ["--format"] },
  create: { flags: ["--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", ...BOUNDS], valued: ["--name"] },
  inspect: { flags: [], valued: [] }, cp: { flags: [], valued: [] }, start: { flags: [], valued: [] },
  exec: { flags: [], valued: ["--workdir"] }, rm: { flags: ["--force"], valued: [] },
};

/** Why a Docker call is not one the launcher makes; exec-time environment, for one, shows in no inspect. */
export function callRefusals(args: readonly string[]): string[] {
  const [first = "", second = ""] = args;
  const name = first === "image" ? `image ${second}` : first;
  const call = CALLS[name];
  if (call === undefined) return [`docker ${first} is not allowed: only the launcher's own calls are`];
  const refusals: string[] = [];
  let i = name.split(" ").length;
  for (; i < args.length && (args[i] ?? "").startsWith("-"); i += 1) {
    const arg = args[i] ?? "";
    if (call.valued.includes(arg)) i += 1;
    else if (!call.flags.includes(arg)) refusals.push(`docker ${name} option ${arg} is not allowed`);
  }
  if (i >= args.length && call.bare !== true) refusals.push(`docker ${name} names no container or image`);
  const trailing = name === "exec" ? [] : args.slice(i).filter((arg) => arg.startsWith("-"));
  refusals.push(...trailing.map((arg) => `docker ${name} option ${arg} after its container or image is not allowed`));
  return refusals;
}

/** `docker`, refusing any call the launcher does not make: the guest gets the image's environment and nothing else. */
export function guardCalls(docker: Docker): Docker {
  return (args, options) => {
    const refusals = callRefusals(args);
    if (refusals.length > 0) throw new Error(`isolated-run: ${refusals.join("; ")}`);
    return docker(args, options);
  };
}

/** Both Docker functions behind the guard. */
export function guardedDeps(deps: Deps): Deps {
  return {
    docker: guardCalls(deps.docker),
    exec: (args, options) => {
      const refusals = callRefusals(args);
      return refusals.length > 0 ? Promise.reject(new Error(`isolated-run: ${refusals.join("; ")}`)) : deps.exec(args, options);
    },
  };
}

type Pinned = Prepared["pinned"];
const result = (status: Prepared["status"], run: RunEnd, pinned: Pinned, extra: Partial<Prepared> = {}): Prepared =>
  ({ status, run, verified: false, published: false, pinned, candidate: null, recovery: null, refusals: [], ...extra });

function inputRefusals(request: Request): { refusals: string[]; base: string; tooling: string } {
  const refusals: string[] = [];
  if (!TASK.test(request.task)) refusals.push(`the task ${JSON.stringify(request.task)} is not a plain identifier`);
  if (!IMAGE.test(request.image)) refusals.push(`the image ${JSON.stringify(request.image)} is not a Docker image reference`);
  if (existsSync(request.out)) refusals.push(`the output directory ${request.out} already exists; each run owns a new one`);
  const status = tryGit(["status", "--porcelain"], { cwd: request.tooling });
  if (status === null || status !== "") refusals.push(`the tooling checkout ${request.tooling} has uncommitted changes or is not a checkout`);
  const tooling = tryGit(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"], { cwd: request.tooling }) ?? "";
  const base = REF.test(request.baseRef) ? tryGit(["rev-parse", "--verify", "--quiet", `${request.baseRef}^{commit}`], { cwd: request.source }) ?? "" : "";
  if (!SHA.test(base)) refusals.push(`the base ref ${request.baseRef} does not name a commit in the trusted source`);
  return { refusals, base, tooling };
}

// The guest's three inputs, made by trusted Git on trusted repositories; the bundle must hold exactly the pinned base.
function writeInputs(request: Request, base: string, scratch: string): string[] {
  const bundle = join(scratch, "base.bundle");
  if (tryGit(["archive", "--format=tar", "--output", join(scratch, "tooling.tar"), "HEAD"], { cwd: request.tooling }) === null) return ["git archive of the tooling failed"];
  if (tryGit(["bundle", "create", "--quiet", bundle, request.baseRef], { cwd: request.source }) === null) return [`git bundle of ${request.baseRef} failed`];
  const heads = tryGit(["bundle", "list-heads", bundle], { cwd: request.source });
  if (heads !== `${base} ${request.baseRef}`) return [`the base bundle holds ${JSON.stringify(heads)}, not ${base} alone`];
  const spec = { repository: request.repository, task: request.task, base, ref: `refs/heads/sandcastle/run-${request.task}`, baseRef: request.baseRef };
  writeFileSync(join(scratch, "spec.json"), `${JSON.stringify(spec)}\n`, { mode: 0o644 });
  return [];
}

type Session = { deps: Deps; id: string; request: Request; artifacts: string };

const exec = (id: string, program: readonly string[]): string[] => ["exec", "--workdir", TOOLING_DIR, id, ...program];

async function runGuest({ deps, id, request }: Session): Promise<RunEnd> {
  const script = request.guest ?? GUEST_RUNNER;
  const ran = await deps.exec(exec(id, ["node", script, "run", GUEST_DIR]), {
    timeoutMs: request.timeoutMs ?? RUN_TIMEOUT_MS, log: join(request.out, "guest.log"), ...(request.signal === undefined ? {} : { signal: request.signal }),
  });
  if (ran.ended !== "exited") {
    // Every process the guest user owns except the container's init, so the export sees a still repository.
    deps.docker(exec(id, ["sh", "-c", "kill -KILL -1 || true"]));
    return ran.ended;
  }
  return ran.status === 0 ? "completed" : "failed";
}

// Each file comes out as base64 on docker exec's stdout, capped at its S13 limit; a missing file is simply absent.
function collect({ deps, id, artifacts }: Session): string[] {
  const refusals: string[] = [];
  for (const [name, limit] of FILES) {
    const read = deps.docker(exec(id, ["base64", "-w0", `${GUEST_DIR}/artifacts/${name}`]), { timeoutMs: EXPORT_TIMEOUT_MS, maxOutput: Math.ceil(limit / 3) * 4 + 16 });
    if (read.error !== undefined) refusals.push(`${name} could not be collected within its ${String(limit)}-byte limit: ${read.error}`);
    else if (read.status === 0) writeFileSync(join(artifacts, name), Buffer.from(read.stdout.trim(), "base64"), { flag: "wx", mode: 0o600 });
  }
  return refusals;
}

async function contained(session: Session, scratch: string): Promise<{ run: RunEnd; refusals: string[]; setupFailed?: boolean }> {
  const { deps, id } = session;
  const unsafe = deps.docker(["inspect", id]);
  const inspected: unknown = unsafe.status === 0 ? JSON.parse(unsafe.stdout) : null;
  const refusals = [...inspectRefusals(inspected), ...boundRefusals(inspected)];
  if (refusals.length > 0) return { run: "not-started", refusals };
  for (const [name, path] of COPIED) deps.docker(["cp", join(scratch, name), `${id}:${path}`]);
  deps.docker(["start", id]);
  const setup = deps.docker(["exec", id, "sh", "-c", SETUP], { timeoutMs: SETUP_TIMEOUT_MS });
  if (setup.status !== 0) return { run: "not-started", refusals: [`the guest setup failed (exit ${String(setup.status)}): ${printable(setup.stderr.trim().slice(-2000))}`], setupFailed: true };
  const run = await runGuest(session);
  const exported = deps.docker(exec(id, ["node", GUEST_RUNNER, "export", GUEST_DIR]), { timeoutMs: EXPORT_TIMEOUT_MS });
  const exportRefusals = exported.status === 0 ? [] : [`the guest export did not finish (exit ${String(exported.status)}${exported.error === undefined ? "" : `, ${exported.error}`})`];
  return { run, refusals: [...exportRefusals, ...collect(session)] };
}

async function judge(request: Request, pinned: Pinned, run: RunEnd, collected: string[], artifacts: string): Promise<Prepared> {
  const recovery = existsSync(join(artifacts, RECOVERY_FILE)) ? join(artifacts, RECOVERY_FILE) : null;
  const kept = { recovery };
  if (!existsSync(join(artifacts, BUNDLE_FILE)) && !existsSync(join(artifacts, MANIFEST_FILE))) {
    return collected.length > 0 ? result("refused", run, pinned, { ...kept, refusals: collected }) : result("no-candidate", run, pinned, kept);
  }
  const expected: Expected = { repository: request.repository, task: request.task, base: pinned.base, ref: `refs/heads/sandcastle/run-${request.task}` };
  const outcome = await quarantineCandidate({ artifacts, source: request.source, expected, root: request.out });
  if (!outcome.accepted || collected.length > 0) return result("refused", run, pinned, { ...kept, refusals: [...collected, ...(outcome.accepted ? [] : outcome.refusals)] });
  return result("candidate", run, pinned, { ...kept, candidate: outcome });
}

/** Prepare and execute one isolated run; see the file comment. Refusals before the run leave no container behind. */
export async function prepareRun(request: Request, unguarded: Deps): Promise<Prepared> {
  const deps = guardedDeps(unguarded);
  const inputs = inputRefusals(request);
  const pinned: Pinned = { base: inputs.base, tooling: inputs.tooling, image: null, launch: [] };
  if (inputs.refusals.length > 0) return result("refused", "not-started", pinned, { refusals: inputs.refusals });
  const image = dockerRuntime(deps.docker, request.image).identity()?.image ?? null;
  if (image === null) return result("blocked", "not-started", pinned, { refusals: [`blocked: Docker or the image ${request.image} is not available, so nothing ran. This is not a pass.`] });
  const launch = createArgs(`isolated-run-${randomBytes(6).toString("hex")}`, request.image);
  const ready: Pinned = { ...pinned, image, launch };
  const unsafe = launchRefusals(launch);
  if (unsafe.length > 0) return result("refused", "not-started", ready, { refusals: unsafe });
  const scratch = mkdtempSync(join(tmpdir(), "isolated-run-"));
  try {
    const written = writeInputs(request, inputs.base, scratch);
    if (written.length > 0) return result("failed", "not-started", ready, { refusals: written });
    const artifacts = join(request.out, "artifacts");
    mkdirSync(artifacts, { recursive: true, mode: 0o700 });
    return await launched({ deps, id: "", request, artifacts }, scratch, ready);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function launched(session: Session, scratch: string, pinned: Pinned): Promise<Prepared> {
  const created = session.deps.docker(pinned.launch);
  if (created.status !== 0) return result("failed", "not-started", pinned, { refusals: [`docker create failed: ${created.stderr.trim()}`] });
  const id = created.stdout.trim();
  let done: Awaited<ReturnType<typeof contained>>;
  try {
    done = await contained({ ...session, id }, scratch);
  } finally {
    session.deps.docker(["rm", "--force", id]);
  }
  if (done.setupFailed === true) return result("failed", done.run, pinned, { refusals: done.refusals });
  if (done.run === "not-started") return result("refused", done.run, pinned, { refusals: done.refusals });
  return judge(session.request, pinned, done.run, done.refusals, session.artifacts);
}
