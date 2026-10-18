// The container runtime the trusted verifier driver (verifier-driver.ts) runs candidate checks in
// (S15, finding A01). One fresh container per verification, launched with S12's containment flags
// and refused unless docker inspect shows no mounts, privilege or credential (containment-smoke.ts).
// The candidate's tracked tree is copied in; nothing on the host is mounted. Each step is a separate
// docker exec, so its exit code and output reach the host from Docker itself: nothing the candidate
// writes inside the container can claim a result.
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { inspectRefusals, launchRefusals } from "./containment-smoke.ts";

export type Step = { name: string; command: string };
export type StepResult = { name: string; command: string; exit: number | null; outputSha256: string; outputBytes: number };
export type StepRun = StepResult & { output: Buffer };
export type RuntimeResult = { results: StepRun[] } | { refusals: string[] };
export type RuntimeIdentity = { runtime: string; image: string };
export type Runtime = { identity(): RuntimeIdentity | null; run(tarPath: string, steps: readonly Step[]): RuntimeResult };
export type DockerResult = { status: number | null; stdout: string; stderr: string; error?: string };
export type Docker = (args: readonly string[], options?: { timeoutMs?: number; maxOutput?: number; inherit?: boolean }) => DockerResult;

const CONTROL_TIMEOUT_MS = 120_000;
const CONTROL_OUTPUT_BYTES = 16 * 1024 * 1024;
// A check such as the full test suite legitimately runs for minutes; past this it is a failed step.
export const STEP_TIMEOUT_MS = 30 * 60_000;
export const STEP_OUTPUT_BYTES = 16 * 1024 * 1024;
const TREE = "/tmp/candidate.tar";
const WORKDIR = "/home/agent/candidate";

// Each step runs with Python's safe-path mode and no inherited import settings: `python3 -m` would
// otherwise put the working directory first on sys.path, and a candidate's own unittest package
// would replace the standard library's (finding H1 of the S15 review).
export const stepScript = (command: string): string => [
  "exec 2>&1", "unset PYTHONPATH PYTHONHOME PYTHONSTARTUP PYTHONUSERBASE NODE_OPTIONS NODE_PATH",
  "PYTHONSAFEPATH=1", "PYTHONNOUSERSITE=1", "export PYTHONSAFEPATH PYTHONNOUSERSITE",
  'PATH="$PWD/node_modules/.bin:$PATH"', "export PATH", command,
].join("\n");
// The candidate becomes a fresh one-commit repository, as the containment smoke's guest checkout does,
// so checks that read Git see a repository and no host Git metadata crosses. --force keeps tracked
// files the candidate's .gitignore covers, so the checks see the whole tracked tree.
export const prepareScript = (workdir: string, tree: string): string => [
  "set -eu", `mkdir "${workdir}"`, `tar -x -f ${tree} -C "${workdir}"`, `cd "${workdir}"`,
  "git init --quiet --initial-branch=main", "git add --all --force",
  "git -c user.name=Verifier -c user.email=verifier@example.invalid commit --quiet --allow-empty -m candidate",
].join("\n");

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

/** Docker through spawnSync, bounded in time and output; a missing binary throws ENOENT. */
export function dockerCli(): Docker {
  return (args, options = {}) => {
    const inherit = options.inherit === true;
    const result = spawnSync("docker", args, {
      encoding: "utf8", stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      ...(inherit ? {} : { timeout: options.timeoutMs ?? CONTROL_TIMEOUT_MS, maxBuffer: options.maxOutput ?? CONTROL_OUTPUT_BYTES }),
    });
    if (result.error !== undefined && "code" in result.error && result.error.code === "ENOENT") throw result.error;
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", ...(result.error === undefined ? {} : { error: result.error.message }) };
  };
}

/** The verifier container: S12's required flags, the image's own idle entrypoint, no mount and no environment. */
export function verifierCreateArgs(name: string, image: string): string[] {
  return ["create", "--name", name, "--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", image];
}

function must(docker: Docker, args: readonly string[]): string {
  const result = docker(args);
  if (result.status !== 0) throw new Error(`docker ${args[0] ?? ""} failed (exit ${String(result.status)}): ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function identity(docker: Docker, image: string): RuntimeIdentity | null {
  try {
    if (docker(["version", "--format", "{{.Server.Version}}"]).status !== 0) return null;
    const inspected = docker(["image", "inspect", "--format", "{{.Id}}", image]);
    return inspected.status === 0 && inspected.stdout.trim() !== "" ? { runtime: "docker", image: inspected.stdout.trim() } : null;
  } catch {
    return null;
  }
}

function step(docker: Docker, id: string, { name, command }: Step): StepRun {
  const result = docker(["exec", "--workdir", WORKDIR, id, "sh", "-c", stepScript(command)], { timeoutMs: STEP_TIMEOUT_MS, maxOutput: STEP_OUTPUT_BYTES });
  const output = Buffer.from(result.stdout);
  // An overrun (timeout, output cap) has no trustworthy exit code, so it counts as no exit at all.
  const exit = result.error === undefined ? result.status : null;
  return { name, command, exit, outputSha256: digest(output), outputBytes: output.length, output };
}

function exercise(docker: Docker, id: string, tarPath: string, steps: readonly Step[]): RuntimeResult {
  const unsafe = inspectRefusals(JSON.parse(must(docker, ["inspect", id])));
  if (unsafe.length > 0) return { refusals: unsafe };
  must(docker, ["cp", tarPath, `${id}:${TREE}`]);
  must(docker, ["start", id]);
  must(docker, ["exec", id, "sh", "-c", prepareScript(WORKDIR, TREE)]);
  const results: StepRun[] = [];
  for (const each of steps) {
    const ran = step(docker, id, each);
    results.push(ran);
    // The first step installs dependencies; without them no check can say anything.
    if (results.length === 1 && ran.exit !== 0) break;
  }
  return { results };
}

/** A runtime on `image`. No argument handed to Docker may name a `forbidden` host path, such as the receipt store. */
export function dockerRuntime(docker: Docker, image: string, forbidden: readonly string[] = []): Runtime {
  return {
    identity: () => identity(docker, image),
    run: (tarPath, steps) => {
      const args = verifierCreateArgs(`verifier-${randomBytes(6).toString("hex")}`, image);
      const named = forbidden.filter((path) => [tarPath, ...args].some((arg) => arg.includes(path)));
      const refusals = [...launchRefusals(args), ...named.map((path) => `a Docker argument names the forbidden host path ${path}`)];
      if (refusals.length > 0) return { refusals };
      const id = must(docker, args);
      try {
        return exercise(docker, id, tarPath, steps);
      } finally {
        docker(["rm", "--force", id]);
      }
    },
  };
}
