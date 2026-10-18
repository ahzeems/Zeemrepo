// Runs inside the disposable container that npm run sandbox:smoke launches (S12). It reports
// observations; the host launcher decides the verdict and trusts none of it as a claim.
//   run:   check the toolchain on the copied checkout, probe the SDK's cleanup, write the report
//   probe: only the SDK probe, in <root>, with sentinels writing under <markerDir>
// The probe drives the real SDK createSandbox/run/close with noSandbox() and a fake agent that
// commits and plants a core.fsmonitor command and hooks. close() runs git on the repository the
// agent controlled, so the planted command fires there: inside this container it is the
// expected positive control, and on the host it would be finding A01.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSandbox, type AgentProvider } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { EXIT_ERROR, consoleOutput, isEntryPoint, runCli } from "../lib/cli.ts";
import { git } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";

const USAGE = `Usage: node scripts/sandcastle/containment-smoke-guest.ts run
       node scripts/sandcastle/containment-smoke-guest.ts probe <root> <markerDir>
Runs inside the containment smoke container. Exit: 0 reported, 1 a step failed, 2 called wrongly.`;

export const RESULT_PATH = "/tmp/containment-result.json";
const CHECKS = ["lint", "typecheck", "test", "evals:test"];
const SOCKETS = ["/var/run/docker.sock", "/run/docker.sock", "/run/containerd/containerd.sock", "/run/podman/podman.sock"];

/** The version in an installed @ai-hero/sandcastle package.json under `root`. */
export function installedSdkVersion(root: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(root, "node_modules/@ai-hero/sandcastle/package.json"), "utf8"));
  if (!isRecord(manifest) || typeof manifest.version !== "string") throw new Error("containment-guest: the installed SDK has no version");
  return manifest.version;
}

/** Mount points from /proc/self/mountinfo, field 5, with the kernel's octal escapes decoded. */
export function mountPoints(mountinfo: string): string[] {
  return mountinfo.split("\n").filter((line) => line.trim() !== "")
    .map((line) => (line.split(" ")[4] ?? "").replace(/\\([0-7]{3})/g, (_, code: string) => String.fromCharCode(parseInt(code, 8))));
}

/** Runtime-control sockets that exist in this environment. */
export function socketPaths(exists: (path: string) => boolean = existsSync): string[] {
  return SOCKETS.filter((path) => exists(path));
}

// Every sentinel appends its name to one log, so the order shows which fired during close().
function plantingCommand(markers: string): string {
  const log = join(markers, "log");
  const sentinel = (name: string): string => `printf '#!/bin/sh\\necho ${name} >> ${log}\\n'`;
  const hooks = ["pre-commit", "post-commit", "post-checkout", "reference-transaction"];
  return [
    `${sentinel("fsmonitor")} > ${join(markers, "fsmonitor.sh")}`, `chmod +x ${join(markers, "fsmonitor.sh")}`,
    `git config core.fsmonitor ${join(markers, "fsmonitor.sh")}`,
    `hooks="$(git rev-parse --git-common-dir)/hooks"`, `mkdir -p "$hooks"`,
    ...hooks.map((hook) => `${sentinel(hook)} > "$hooks/${hook}" && chmod +x "$hooks/${hook}"`),
    "echo work > work.txt", "git add work.txt", "git -c user.name=Probe -c user.email=probe@example.invalid commit --quiet -m work",
  ].join(" && ");
}

const fakeAgent = (markers: string): AgentProvider => ({
  name: "containment-probe", env: {}, captureSessions: false,
  buildPrintCommand: () => ({ command: plantingCommand(markers) }),
  parseStreamLine: (line) => [{ type: "text", text: line }],
});

type Probe = { commits: number; duringClose: string[]; markerDir: string };

export async function probeCleanup(root: string, markerDir: string): Promise<Probe> {
  if (existsSync(markerDir)) throw new Error(`containment-guest: marker directory ${markerDir} already exists`);
  mkdirSync(markerDir, { recursive: true });
  const repo = join(root, "repo");
  mkdirSync(repo, { recursive: true });
  git(["init", "--quiet", "--initial-branch=main"], { cwd: repo });
  git(["-c", "user.name=Probe", "-c", "user.email=probe@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "base"], { cwd: repo });
  // createSandbox runs `git config --global --add safe.directory`, so the probe gives the SDK a
  // global config of its own instead of whichever one the environment names.
  const globalConfig = join(root, "gitconfig");
  writeFileSync(globalConfig, "");
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
  const log = join(markerDir, "log");
  appendFileSync(log, "creating\n");
  const sandbox = await createSandbox({ branch: "containment/probe", sandbox: noSandbox(), cwd: repo });
  const run = await sandbox.run({ agent: fakeAgent(markerDir), prompt: "containment probe", maxIterations: 1, logging: { type: "file", path: join(root, "agent.log") } });
  appendFileSync(log, "closing\n");
  await sandbox.close();
  appendFileSync(log, "closed\n");
  const lines = readFileSync(log, "utf8").split("\n");
  return { commits: run.commits.length, duringClose: lines.slice(lines.indexOf("closing") + 1, lines.indexOf("closed")), markerDir };
}

function version(command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? `${result.stdout}${result.stderr}`.trim().split("\n")[0] ?? "" : `unavailable (${command})`;
}

// The checkout is a fresh repository made from the host's tracked files, so the repository's
// own checks run on known-good content without any host git metadata.
function runChecks(checkout: string): { script: string; exit: number | null }[] {
  return CHECKS.map((script) => ({ script, exit: spawnSync("npm", ["run", "--silent", script], { cwd: checkout, stdio: "inherit" }).status }));
}

async function report(checkout: string, markerDir: string): Promise<number> {
  const result = {
    node: process.version, python: version("python3", ["--version"]), git: version("git", ["--version"]),
    claude: version("claude", ["--version"]), sdk: installedSdkVersion(checkout), checks: runChecks(checkout),
    probe: await probeCleanup(join(checkout, "..", "probe"), markerDir),
    sockets: socketPaths(), mountPoints: mountPoints(readFileSync("/proc/self/mountinfo", "utf8")),
  };
  writeFileSync(RESULT_PATH, `${JSON.stringify(result)}\n`);
  consoleOutput.write(`containment-guest: report written to ${RESULT_PATH}`);
  return 0;
}

export async function main(args: readonly string[]): Promise<number> {
  const [mode, ...rest] = args;
  if (mode === "probe" && rest.length === 2) {
    consoleOutput.write(JSON.stringify(await probeCleanup(rest[0] ?? "", rest[1] ?? "")));
    return 0;
  }
  const markers = process.env.CONTAINMENT_MARKERS;
  if (mode === "run" && rest.length === 0 && markers !== undefined && markers !== "") return report(process.cwd(), markers);
  consoleOutput.warn(USAGE);
  return EXIT_ERROR;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
