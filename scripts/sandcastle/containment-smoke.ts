// npm run sandbox:smoke: the real, non-model containment control for the isolated Sandcastle
// workflow (S12, findings A01 and A14). It builds .sandcastle/Dockerfile, copies the checkout's
// tracked files into a container with no mounts, and runs containment-smoke-guest.ts there: the
// repository's checks on that copy, and the real SDK create/run/close with a fake agent that
// plants a core.fsmonitor command and hooks. The verdict is the host's alone. It needs the
// planted command to have fired inside the guest during close(), nothing on the host, an
// unchanged host checkout, and a container that inspection shows has no mounts, no privilege
// and no credential in its environment. Missing Docker is a blocked result, never a pass.
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnRunner, type Run } from "../git/pr-ready.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { gitOptionsAt } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";
import { readState, stateChanges } from "../git/git-state.ts";
import { installedSdkVersion } from "./containment-smoke-guest.ts";

export type Options = { cwd?: string; output?: Output; run?: Run; markerRoot?: string };

const USAGE = `Usage: node scripts/sandcastle/containment-smoke.ts
Builds the sandbox image and proves the containment boundary with a fake agent; needs Docker
and makes no model calls. Exit: 0 contained, 1 refused or blocked, 2 the tool failed.`;

const IMAGE = "zeemrepo-sandbox:containment-smoke";
const RESULT_PATH = "/tmp/containment-result.json";
const CHECKS = ["lint", "typecheck", "test", "evals:test"];
// The owner's machine runs Ubuntu 26.04, and the sandbox matches it (OWNER DECISION, 2026-10-18).
const GUEST_OS = "ubuntu 26.04";
// evals:test uses tarfile's extraction filters, which Python 3.12 is the first minor to ship.
const MIN_PYTHON_MINOR = 12;
const ALLOWED_ENV = new Set(["CONTAINMENT_MARKERS"]);
const CREDENTIAL = /TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|^GH_|^GITHUB_|ANTHROPIC|CLAUDE_CODE/i;
// Docker itself mounts proc, sys, dev and these three files into every container.
const DOCKER_FILES = new Set(["/", "/etc/hosts", "/etc/hostname", "/etc/resolv.conf"]);
const OPENING_FLAGS = ["-v", "--volume", "--mount", "--volumes-from", "--privileged", "--device", "--device-cgroup-rule", "--cap-add",
  "--env-file", "-p", "--publish", "--publish-all", "-P", "--add-host", "--group-add", "--runtime", "--gpus", "--sysctl", "--cgroup-parent", "--link"];
// --cgroupns=private because cgroup v1 hosts default to the host's cgroup namespace.
const REQUIRED_FLAGS = ["--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private"];
const RESULT_LIMIT_BYTES = 1 << 20;
const NAMESPACE_FLAGS = ["--network", "--net", "--pid", "--ipc", "--uts", "--userns", "--cgroupns"];

// The guest starts from a fresh repository made of the host's tracked files: no host git
// metadata, hooks or config cross the boundary.
const GUEST_SCRIPT = [
  "set -eu", 'mkdir -p "$HOME/checkout"', 'tar -x -f /tmp/checkout.tar -C "$HOME/checkout"', 'cd "$HOME/checkout"',
  "git init --quiet --initial-branch=main", "git add --all",
  "git -c user.name=Containment -c user.email=containment@example.invalid commit --quiet -m checkout",
  "npm ci --no-audit --no-fund", "node scripts/sandcastle/containment-smoke-guest.ts run",
].join("\n");

export function createArgs(name: string, image: string, markerDir: string): string[] {
  return ["create", "--name", name, "--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", "--env", `CONTAINMENT_MARKERS=${markerDir}`,
    "--entrypoint", "sh", image, "-c", GUEST_SCRIPT];
}

function flagValue(args: readonly string[], index: number): [string, string | undefined] {
  const arg = args[index] ?? "";
  // Docker also takes a short option's value attached: -v/srv:/srv, -p8080:80, -eNAME=value.
  const short = /^-([vpe])(.+)$/.exec(arg);
  if (short !== null) return [`-${short[1] ?? ""}`, short[2]];
  const equals = arg.indexOf("=");
  return equals > 0 && arg.startsWith("-") ? [arg.slice(0, equals), arg.slice(equals + 1)] : [arg, args[index + 1]];
}

/** Launch settings that would open the boundary: host paths, sockets, privilege, host namespaces or credentials. */
export function launchRefusals(args: readonly string[]): string[] {
  const refusals: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const [flag, value] = flagValue(args, i);
    if (OPENING_FLAGS.includes(flag)) refusals.push(`launch flag ${flag} would open the boundary`);
    const written = (args[i] ?? "").includes("=") ? args[i] ?? "" : `${flag} ${value ?? ""}`;
    if (NAMESPACE_FLAGS.includes(flag) && (value === "host" || (value ?? "").startsWith("container:"))) refusals.push(`launch flag ${written} shares a host namespace`);
    if ((flag === "--env" || flag === "-e") && !ALLOWED_ENV.has((value ?? "").split("=")[0] ?? "")) refusals.push(`launch environment ${(value ?? "").split("=")[0] ?? ""} is not allowed`);
    if (flag === "--security-opt" && value !== "no-new-privileges") refusals.push(`launch flag ${written} changes the security profile`);
    if ((args[i] ?? "").includes("docker.sock")) refusals.push("a launch argument names the Docker socket");
    // -itv/srv:/srv or -dP hide a flag behind another letter, so clustered short options are refused.
    if (/^-[A-Za-z]{2,}/.test(args[i] ?? "") && !/^-[vpe]/.test(args[i] ?? "")) refusals.push(`launch argument ${args[i] ?? ""} uses combined short options`);
  }
  for (const required of REQUIRED_FLAGS) if (!args.includes(required)) refusals.push(`the launch lacks ${required}`);
  return refusals;
}

const empty = (value: unknown): boolean => value === null || value === undefined || (Array.isArray(value) && value.length === 0);

/** What `docker inspect` shows the created container would have; nothing in it is assumed. */
export function inspectRefusals(value: unknown): string[] {
  const container: unknown = Array.isArray(value) && value.length === 1 ? value[0] : undefined;
  if (!isRecord(container) || !isRecord(container.HostConfig) || !isRecord(container.Config)) return ["the docker inspect output is not one container record"];
  const { Mounts: mounts, HostConfig: hostConfig, Config: config } = container;
  const refusals: string[] = [];
  if (!empty(mounts)) refusals.push(`the container has mounts: ${JSON.stringify(mounts)}`);
  if (!empty(hostConfig.Binds)) refusals.push("the container has bind mounts");
  if (hostConfig.Privileged !== false) refusals.push("the container is privileged");
  for (const mode of ["NetworkMode", "PidMode", "IpcMode", "UTSMode", "UsernsMode", "CgroupnsMode"]) {
    const setting = typeof hostConfig[mode] === "string" ? hostConfig[mode] : "";
    if (setting === "host" || setting.startsWith("container:")) refusals.push(`HostConfig.${mode} is ${setting}`);
  }
  if (!empty(hostConfig.CapAdd)) refusals.push("the container adds capabilities");
  if (!(Array.isArray(hostConfig.CapDrop) && hostConfig.CapDrop.includes("ALL"))) refusals.push("the container does not drop every capability");
  if (!empty(hostConfig.Devices) || !empty(hostConfig.DeviceRequests)) refusals.push("the container has host devices");
  if (!(hostConfig.Runtime === undefined || hostConfig.Runtime === "runc")) refusals.push(`HostConfig.Runtime is ${JSON.stringify(hostConfig.Runtime)}, not runc`);
  if (!(Array.isArray(hostConfig.MaskedPaths) && hostConfig.MaskedPaths.length > 0 && Array.isArray(hostConfig.ReadonlyPaths) && hostConfig.ReadonlyPaths.length > 0)) {
    refusals.push("the container's system paths are not masked and read-only");
  }
  if (!empty(hostConfig.DeviceCgroupRules)) refusals.push("the container has device rules");
  if (!empty(hostConfig.ExtraHosts)) refusals.push("the container has extra hosts");
  const ports = isRecord(hostConfig.PortBindings) ? Object.keys(hostConfig.PortBindings).length > 0 : !empty(hostConfig.PortBindings);
  if (ports || hostConfig.PublishAllPorts === true) refusals.push("the container has published ports");
  const securityOpt = Array.isArray(hostConfig.SecurityOpt) ? hostConfig.SecurityOpt.map(String) : [];
  if (securityOpt.length !== 1 || !/^no-new-privileges(:true)?$/.test(securityOpt[0] ?? "")) refusals.push(`HostConfig.SecurityOpt is ${JSON.stringify(hostConfig.SecurityOpt)}, not exactly no-new-privileges`);
  const env = Array.isArray(config.Env) ? config.Env.map(String) : [];
  for (const name of env.map((entry) => entry.split("=")[0] ?? "").filter((name) => CREDENTIAL.test(name))) refusals.push(`the container environment holds ${name}`);
  return refusals;
}

type Expected = { nodeMajor: string; sdk: string; markerDir: string };

function probeRefusals(probe: unknown, markerDir: string): string[] {
  if (!isRecord(probe)) return ["the guest result has no probe"];
  const refusals: string[] = [];
  if (typeof probe.commits !== "number" || probe.commits < 1) refusals.push("the fake agent's commit was not collected");
  if (!Array.isArray(probe.duringClose) || !probe.duringClose.includes("fsmonitor")) refusals.push("the planted fsmonitor did not fire inside the guest during close(), so the probe proved nothing");
  if (probe.markerDir !== markerDir) refusals.push(`the probe used marker directory ${String(probe.markerDir)}, not ${markerDir}`);
  return refusals;
}

/** The guest's report, read as untrusted data: each control must be present and in its expected state. */
export function resultRefusals(result: unknown, expected: Expected): string[] {
  if (!isRecord(result)) return ["the guest result is not an object"];
  const refusals: string[] = [];
  const node = String(result.node);
  if (node.match(/^v(\d+)\./)?.[1] !== expected.nodeMajor) refusals.push(`the guest runs Node ${node}, not ${expected.nodeMajor} from .nvmrc`);
  if (result.os !== GUEST_OS) refusals.push(`the guest runs ${typeof result.os === "string" ? result.os : String(JSON.stringify(result.os))}, not ${GUEST_OS}`);
  const pythonMinor = Number(/^Python 3\.(\d+)/.exec(String(result.python))?.[1]);
  if (!(pythonMinor >= MIN_PYTHON_MINOR)) refusals.push(`the guest has no Python 3.${String(MIN_PYTHON_MINOR)} or later (${String(result.python)})`);
  if (result.sdk !== expected.sdk) refusals.push(`the guest has SDK ${String(result.sdk)}, not ${expected.sdk}`);
  const checks = Array.isArray(result.checks) ? result.checks.filter(isRecord) : [];
  for (const script of CHECKS) {
    const exit = checks.find((check) => check.script === script)?.exit;
    if (exit !== 0) refusals.push(`the guest check ${script} exited ${String(exit)}`);
  }
  refusals.push(...probeRefusals(result.probe, expected.markerDir));
  for (const socket of Array.isArray(result.sockets) ? result.sockets.map(String) : ["(unreported)"]) refusals.push(`a runtime-control socket is reachable in the guest: ${socket}`);
  const mounts = Array.isArray(result.mountPoints) ? result.mountPoints.map(String) : [];
  if (mounts.length === 0) refusals.push("the guest reported no mount points");
  for (const mount of mounts.filter((path) => !DOCKER_FILES.has(path) && !/^\/(proc|sys|dev)(\/|$)/.test(path))) refusals.push(`unexpected mount in the guest: ${mount}`);
  return refusals;
}

function must(run: Run, args: readonly string[], inherit = false): string {
  const result = run("docker", args, { inherit });
  if (result.status !== 0) throw new Error(`docker ${args[0] ?? ""} failed (exit ${String(result.status)})`);
  return result.stdout.trim();
}

function dockerVersion(run: Run): string | null {
  try {
    const result = run("docker", ["version", "--format", "{{.Server.Version}}"]);
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

// docker cp copies a link as a link, so the guest could point its result at a host file.
function readResult(path: string): { result: unknown } | { refusal: string } {
  if (!existsSync(path)) return { result: null };
  const info = lstatSync(path);
  if (!info.isFile() || info.size > RESULT_LIMIT_BYTES) return { refusal: "the guest result is not a regular file under 1 MiB" };
  const result: unknown = JSON.parse(readFileSync(path, "utf8"));
  return { result };
}

type Prepared = { run: Run; cwd: string; scratch: string; markerDir: string; expected: Expected; output: Output };

// Inspects, starts and reads back one created container; the caller removes it.
function exercise({ run, cwd, scratch, markerDir, expected, output }: Prepared, id: string): string[] {
  const inspected: unknown = JSON.parse(must(run, ["inspect", id]));
  const unsafe = inspectRefusals(inspected);
  if (unsafe.length > 0) return unsafe;
  must(run, ["cp", join(scratch, "checkout.tar"), `${id}:/tmp/checkout.tar`]);
  const before = readState(gitOptionsAt(cwd));
  const start = run("docker", ["start", "--attach", id], { inherit: true }).status;
  const changes = stateChanges(before, readState(gitOptionsAt(cwd)));
  run("docker", ["cp", `${id}:${RESULT_PATH}`, join(scratch, "result.json")]);
  const read = readResult(join(scratch, "result.json"));
  if ("refusal" in read) return [read.refusal];
  const { result } = read;
  if (isRecord(result)) output.write(`containment-smoke: guest reports ${["os", "node", "python", "git", "claude", "sdk"].map((key) => `${key} ${String(result[key])}`).join(", ")}`);
  return [
    ...(start === 0 ? [] : [`the guest exited ${String(start)}`]),
    ...resultRefusals(result, expected),
    ...(existsSync(markerDir) ? [`a sentinel marker directory appeared on the host: ${markerDir}`] : []),
    ...changes.map((change) => `host git state changed: ${change}`),
  ];
}

function smoke(run: Run, cwd: string, markerRoot: string, output: Output): number {
  // The image is built from the working tree and the guest gets HEAD, so both must be the same tree.
  const status = run("git", ["status", "--porcelain"]);
  if (status.status !== 0) return refuse(["git status failed, so the checkout cannot be shown to be clean"], output);
  if (status.stdout.trim() !== "") return refuse(["the checkout has uncommitted changes, so the image and the copied files could differ; commit or stash them first"], output);
  must(run, ["build", "--tag", IMAGE, "--file", ".sandcastle/Dockerfile", ".sandcastle"], true);
  const image = must(run, ["image", "inspect", "--format", "{{.Id}}", IMAGE]);
  const scratch = mkdtempSync(join(tmpdir(), "containment-smoke-"));
  const markerDir = join(markerRoot, `containment-${randomBytes(8).toString("hex")}`);
  const prepared: Prepared = { run, cwd, scratch, markerDir, expected: { nodeMajor: readFileSync(join(cwd, ".nvmrc"), "utf8").trim(), sdk: installedSdkVersion(join(import.meta.dirname, "..", "..")), markerDir }, output };
  try {
    if (run("git", ["archive", "--format=tar", "--output", join(scratch, "checkout.tar"), "HEAD"]).status !== 0) throw new Error("git archive HEAD failed");
    const args = createArgs(`containment-smoke-${randomBytes(4).toString("hex")}`, IMAGE, markerDir);
    const unsafe = launchRefusals(args);
    if (unsafe.length > 0) return refuse(unsafe, output);
    const id = must(run, args);
    try {
      const refusals = exercise(prepared, id);
      if (refusals.length > 0) return refuse(refusals, output);
    } finally {
      run("docker", ["rm", "--force", id]);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  output.write(`containment-smoke: contained. Image ${image || IMAGE}, SDK ${prepared.expected.sdk}; docker inspect showed no mounts, privilege or credential; the guest reports the planted fsmonitor fired during close(); no marker appeared on the host and the host checkout is unchanged.`);
  return EXIT_OK;
}

function refuse(refusals: readonly string[], output: Output): number {
  for (const refusal of refusals) output.warn(`containment-smoke: ${refusal}`);
  output.warn("containment-smoke: the boundary is not proven; keep Sandcastle automation refused.");
  return EXIT_REFUSED;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (args.length > 0) {
    output.warn("containment-smoke: takes no arguments. See --help.");
    return EXIT_ERROR;
  }
  const cwd = options.cwd ?? process.cwd();
  const run = options.run ?? spawnRunner(cwd);
  if (dockerVersion(run) === null) {
    output.warn("containment-smoke: blocked: Docker is not available here, so the boundary was not exercised. This is not a pass; run it where Docker is (the required CI check does).");
    return EXIT_REFUSED;
  }
  return smoke(run, cwd, options.markerRoot ?? "/tmp", output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
