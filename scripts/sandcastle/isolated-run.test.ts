import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { isRecord } from "../lib/record.ts";
import { REPOSITORY, createTarget } from "../test-support/isolated-run-fixture.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import type { Docker, DockerResult } from "./container-runtime.ts";
import { GUEST_DIR, createArgs, callRefusals, dockerExec, guardCalls, guardedDeps, prepareRun, type AsyncDocker, type Ended, type Request } from "./isolated-run.ts";

// The host launcher against a scripted Docker. The guest's export is produced by the real
// guest-runner.ts export step on temporary repositories, so the host reads genuine artifacts; only
// the container itself is simulated. npm run sandbox:smoke runs the same launcher in real Docker.
const GUEST = join(import.meta.dirname, "guest-runner.ts");
const TASK = "fixture-run";
const REF = `refs/heads/sandcastle/run-${TASK}`;

const SAFE_INSPECT = {
  Mounts: [], Config: { Env: ["PATH=/usr/bin"] },
  HostConfig: {
    Binds: null, Privileged: false, NetworkMode: "bridge", PidMode: "", IpcMode: "private", UTSMode: "", UsernsMode: "", CgroupnsMode: "private",
    CapAdd: null, CapDrop: ["ALL"], Devices: [], DeviceRequests: null, Runtime: "runc", MaskedPaths: ["/proc/kcore"], ReadonlyPaths: ["/proc/sys"],
    DeviceCgroupRules: null, ExtraHosts: null, PortBindings: {}, PublishAllPorts: false, SecurityOpt: ["no-new-privileges"],
    Memory: 4 * 1024 ** 3, NanoCpus: 2e9, PidsLimit: 1024,
  },
};

type Guest = { commit: boolean; tamper?: (manifest: Record<string, unknown>) => void; drop?: string[] };
type Script = { created?: string; version?: number; inspect?: unknown; setup?: number; run?: { status: number | null; ended: Ended }; export?: DockerResult; collect?: (name: string) => DockerResult | undefined };
type Made = { target: RepoFixture; tooling: RepoFixture; base: string; out: string; scratch: string; calls: string[][]; guestDir: string };

function step(args: readonly string[]): void {
  const result = spawnSync(process.execPath, [GUEST, ...args], { env: cleanGitEnv, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr);
}

// What the guest would leave in its artifact directory: genuine guest-runner output, optionally tampered.
function guestArtifacts(made: Made, guest: Guest): void {
  writeFileSync(join(made.scratch, "spec.json"), JSON.stringify({ repository: REPOSITORY, task: TASK, base: made.base, ref: REF, baseRef: "refs/heads/main" }));
  made.target.git(["bundle", "create", "--quiet", join(made.scratch, "base.bundle"), "refs/heads/main"]);
  step(["init", made.guestDir, join(made.scratch, "spec.json"), join(made.scratch, "base.bundle")]);
  const run = join(made.guestDir, "run");
  if (guest.commit) {
    writeFileSync(join(run, "work.txt"), "work\n");
    spawnSync("git", ["add", "work.txt"], { cwd: run, env: cleanGitEnv });
    spawnSync("git", ["-c", "user.name=G", "-c", "user.email=g@example.invalid", "commit", "--quiet", "-m", "work"], { cwd: run, env: cleanGitEnv });
  }
  step(["export", made.guestDir]);
  const manifestPath = join(made.guestDir, "artifacts", "candidate.json");
  if (guest.tamper !== undefined && existsSync(manifestPath)) {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.ok(isRecord(manifest));
    guest.tamper(manifest);
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }
  for (const name of guest.drop ?? []) rmSync(join(made.guestDir, "artifacts", name), { force: true });
}

const ok = (stdout = ""): DockerResult => ({ status: 0, stdout, stderr: "" });

function fakeDocker(made: Made, script: Script): Docker {
  return (args) => {
    made.calls.push([...args]);
    const [command, ...rest] = args;
    if (command === "version") return script.version === undefined ? ok("27.0.0") : { status: script.version, stdout: "", stderr: "no daemon" };
    if (command === "image") return ok("sha256:fixture-image");
    if (command === "create") return ok(script.created ?? "container-1");
    if (command === "inspect") return ok(JSON.stringify([script.inspect ?? SAFE_INSPECT]));
    if (command !== "exec") return ok();
    const program = rest.slice(rest.indexOf("container-1") + 1);
    if (program[0] === "base64") {
      const name = (program.at(-1) ?? "").slice(`${GUEST_DIR}/artifacts/`.length);
      const scripted = script.collect?.(name);
      if (scripted !== undefined) return scripted;
      const path = join(made.guestDir, "artifacts", name);
      return existsSync(path) ? ok(readFileSync(path).toString("base64")) : { status: 1, stdout: "", stderr: "No such file" };
    }
    if (program.includes("export")) return script.export ?? ok();
    if (program[0] === "sh" && (program[2] ?? "").includes("npm ci")) return script.setup === undefined ? ok() : { status: script.setup, stdout: "", stderr: "setup failed" };
    return ok();
  };
}

function fakeExec(made: Made, script: Script): AsyncDocker {
  return (args, options) => {
    made.calls.push(["(async)", ...args]);
    if (options.signal?.aborted === true) return Promise.resolve({ status: null, ended: "interrupted" });
    return Promise.resolve(script.run ?? { status: 0, ended: "exited" });
  };
}

function setup(t: TestContext): Made {
  const scratch = mkdtempSync(join(tmpdir(), "isolated-run-"));
  const target = createTarget({ marker: join(scratch, "marker"), implementer: "commit" });
  const tooling = createRepo("isolated-run-tooling-");
  tooling.write("README.md", "tooling\n");
  tooling.commit("tooling");
  t.after(() => {
    target.cleanup();
    tooling.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  });
  return { target, tooling, base: target.git(["rev-parse", "HEAD"]), out: join(scratch, "out"), scratch, calls: [], guestDir: join(scratch, "guest") };
}

const request = (made: Made, extra: Partial<Request> = {}): Request => ({
  source: made.target.dir, baseRef: "refs/heads/main", repository: REPOSITORY, task: TASK, tooling: made.tooling.dir, image: "zeemrepo-sandbox:test", out: made.out, ...extra,
});

async function prepare(made: Made, guest: Guest | null, script: Script = {}, extra: Partial<Request> = {}): ReturnType<typeof prepareRun> {
  if (guest !== null) guestArtifacts(made, guest);
  return prepareRun(request(made, extra), { docker: fakeDocker(made, script), exec: fakeExec(made, script) });
}

const commands = (made: Made): string[] => made.calls.map((call) => (call[0] === "exec" || call[0] === "(async)" ? call.slice(0, 1).concat(call.slice(-2)).join(" ") : call[0] ?? ""));

await test("a contained run returns a quarantined candidate on the pinned base, never verified or published", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true });
  assert.equal(prepared.status, "candidate", prepared.refusals.join("; "));
  assert.equal(prepared.run, "completed");
  assert.equal(prepared.verified, false);
  assert.equal(prepared.published, false);
  assert.equal(prepared.candidate?.base, made.base);
  assert.equal(prepared.candidate?.candidate.sha, spawnSync("git", ["rev-parse", REF], { cwd: join(made.guestDir, "run"), env: cleanGitEnv, encoding: "utf8" }).stdout.trim());
  assert.deepEqual(prepared.candidate?.builderClaims, { merge: "interrupted" }, "the guest's own label is carried as data only");
  assert.equal(prepared.pinned.base, made.base);
  assert.equal(prepared.pinned.tooling, made.tooling.git(["rev-parse", "HEAD"]));
  assert.equal(prepared.pinned.image, "sha256:fixture-image");
  for (const flag of ["--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", "--memory=4g", "--pids-limit=1024", "--cpus=2"]) assert.ok(prepared.pinned.launch.includes(flag), flag);
  const order = made.calls.map((call) => call[0]);
  assert.equal(order.at(-1), "rm", "the container is removed last, after collection");
  assert.ok(order.indexOf("start") > order.indexOf("inspect"));
  // Inside the S12 smoke's guest the test user's home is exactly the container's own home.
  const home = homedir();
  const forbidden = [made.target.dir, made.tooling.dir, made.out, "docker.sock", ...(home === dirname(GUEST_DIR) ? [] : [home])];
  const named = made.calls.flat().filter((arg) => forbidden.some((path) => arg.includes(path)));
  assert.deepEqual(named, [], "no Docker argument names the host checkout, home or a control socket");
  const environment = made.calls.filter((call) => call.some((arg) => /^(--env|--env-file)(=|$)|^-[A-Za-z]*e/.test(arg)));
  assert.deepEqual(environment, [], "no Docker call hands the guest an environment variable");
  assert.ok(existsSync(join(made.out, "artifacts", "candidate.bundle")));
});

await test("missing Docker or image is blocked before anything is created", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, null, { version: 1 });
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.run, "not-started");
  assert.ok(!made.calls.some((call) => call[0] === "create"));
  assert.match(prepared.refusals.join(" "), /not a pass/);
});

await test("a container with a mount or without resource bounds refuses before it starts, and is removed", async (t) => {
  const unbounded = (key: string, value: unknown): unknown => ({ ...SAFE_INSPECT, HostConfig: { ...SAFE_INSPECT.HostConfig, [key]: value } });
  const cases: [unknown, RegExp][] = [
    [{ ...SAFE_INSPECT, Mounts: [{ Source: "/srv" }] }, /mounts/], [unbounded("Memory", 0), /Memory/], [unbounded("PidsLimit", null), /PidsLimit/], [unbounded("NanoCpus", 0), /NanoCpus/],
  ];
  for (const [inspect, pattern] of cases) {
    const made = setup(t);
    const prepared = await prepare(made, null, { inspect });
    assert.equal(prepared.status, "refused");
    assert.match(prepared.refusals.join("\n"), pattern);
    assert.ok(!made.calls.some((call) => call[0] === "start"), "nothing started");
    assert.equal(made.calls.at(-1)?.[0], "rm");
  }
});

await test("only the Docker calls the launcher makes pass the guard; anything else fails closed", () => {
  const refused: string[][] = [
    ["exec", "--env", "GH_TOKEN", "cid", "node"], ["exec", "-e", "GH_TOKEN", "cid", "node"], ["exec", "--env-file", "f", "cid", "node"],
    ["exec", "--env=GH_TOKEN", "cid", "node"], ["exec", "-eGH_TOKEN", "cid", "node"],
    ["exec", "-ie", "GH_TOKEN", "cid", "node"], ["exec", "-ieGH_TOKEN", "cid", "node"], ["exec", "-de", "X", "cid", "node"],
    ["exec", "--detach-keys", "ctrl-p", "-e", "X", "cid", "node"], ["--log-level", "info", "exec", "-e", "X", "cid", "node"],
    ["exec", "--privileged", "cid", "node"], ["run", "img"], ["create", "--volume", "/:/host", "img"], ["image", "rm", "img"], [],
    ["rm", "--force", "cid", "-v"], ["start", "cid", "--attach"], ["inspect", "cid", "--size"], ["cp", "/tmp/x", "cid:/tmp/x", "-a"],
    [...createArgs("n", "img"), "--privileged"], ["image", "inspect", "img", "--format", "x"],
  ];
  for (const args of refused) assert.notDeepEqual(callRefusals(args), [], args.join(" "));
  const made: string[][] = [
    ["version", "--format", "{{.Server.Version}}"], ["image", "inspect", "--format", "{{.Id}}", "img"], createArgs("isolated-run-x", "img"),
    ["inspect", "cid"], ["cp", "/tmp/x/spec.json", "cid:/tmp/spec.json"], ["start", "cid"], ["exec", "cid", "sh", "-c", "set -eu"],
    ["exec", "--workdir", "/home/agent/tooling", "cid", "node", "x.ts", "--env", "-e"], ["rm", "--force", "cid"],
  ];
  for (const args of made) assert.deepEqual(callRefusals(args), [], args.join(" "));
  const docker = guardCalls((args) => ({ status: 0, stdout: args.join(" "), stderr: "" }));
  assert.throws(() => docker(["exec", "-ie", "GH_TOKEN", "cid", "true"]), /not allowed/);
});

await test("prepareRun puts every Docker call behind the guard", async (t) => {
  const made = setup(t);
  // A container id is Docker's output; one that reads as an option must not reach the next call.
  await assert.rejects(prepare(made, null, { created: "-v" }), /not allowed/);
  assert.deepEqual(made.calls.filter((call) => call[0] !== "create" && call.includes("-v")), [], "no call carrying it reached Docker");
});

await test("the async exec path refuses a call the launcher does not make, before Docker sees it", async () => {
  const reached: string[][] = [];
  const deps = guardedDeps({ docker: () => ({ status: 0, stdout: "", stderr: "" }), exec: (args) => { reached.push([...args]); return Promise.resolve({ status: 0, ended: "exited" }); } });
  await assert.rejects(deps.exec(["exec", "-ie", "GH_TOKEN", "cid", "node"], { timeoutMs: 1000 }), /not allowed/);
  assert.deepEqual(reached, []);
  await deps.exec(["exec", "--workdir", "/home/agent/tooling", "cid", "node"], { timeoutMs: 1000 });
  assert.equal(reached.length, 1);
});

await test("an image name that reads as an option is refused as input, before Docker is touched", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, null, {}, { image: "-eGH_TOKEN" });
  assert.equal(prepared.status, "refused");
  assert.match(prepared.refusals.join("\n"), /image/);
  assert.equal(made.calls.length, 0);
});

await test("unsafe launch arguments refuse before a container exists", () => {
  assert.deepEqual(createArgs("n", "img").filter((arg) => arg.startsWith("-v") || arg.includes("docker.sock")), []);
});

await test("guest phase labels cannot claim verification or publication", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true, tamper: (manifest) => { manifest.claims = { verify: "succeeded", publish: "succeeded" }; } });
  assert.equal(prepared.status, "refused");
  assert.equal(prepared.candidate, null);
  assert.match(prepared.refusals.join("\n"), /claims\.verify is not a builder phase/);
  assert.equal(prepared.verified, false);
  assert.equal(prepared.published, false);
  assert.ok(prepared.recovery !== null && existsSync(prepared.recovery), "recovery data is kept");
});

await test("a timed-out run is stopped inside the container, then exported and collected", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true }, { run: { status: null, ended: "timed-out" } });
  assert.equal(prepared.run, "timed-out");
  const sequence = commands(made);
  const stop = sequence.findIndex((line) => line.includes("kill -KILL -1"));
  const exported = sequence.findIndex((line) => line.includes(`export ${GUEST_DIR}`));
  assert.ok(stop > 0 && exported > stop, sequence.join("\n"));
  assert.equal(prepared.status, "candidate", "committed work comes back, still only a candidate");
});

await test("an interrupted run keeps recovery data and claims no candidate when nothing was merged", async (t) => {
  const made = setup(t);
  const controller = new AbortController();
  controller.abort();
  const prepared = await prepare(made, { commit: false }, {}, { signal: controller.signal });
  assert.equal(prepared.run, "interrupted");
  assert.equal(prepared.status, "no-candidate");
  assert.ok(prepared.recovery !== null && readFileSync(prepared.recovery, "utf8").includes("\"status\""));
  assert.equal(made.calls.at(-1)?.[0], "rm");
});

await test("a crashed guest still has its work exported and collected", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true }, { run: { status: 1, ended: "exited" } });
  assert.equal(prepared.run, "failed");
  assert.equal(prepared.status, "candidate");
});

await test("an interrupted export keeps what reached the host and accepts nothing incomplete", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true, drop: ["candidate.bundle"] }, { export: { status: null, stdout: "", stderr: "", error: "timed out" } });
  assert.equal(prepared.status, "refused");
  assert.match(prepared.refusals.join("\n"), /export/);
  assert.ok(prepared.recovery !== null && existsSync(prepared.recovery));
});

await test("an oversized artifact is refused, not truncated", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, { commit: true }, { collect: (name) => (name === "candidate.bundle" ? { status: null, stdout: "", stderr: "", error: "maxBuffer exceeded" } : undefined) });
  assert.equal(prepared.status, "refused");
  assert.match(prepared.refusals.join("\n"), /candidate\.bundle could not be collected within its \d+-byte limit/);
});

await test("a failed guest setup removes the container and starts no coordinator", async (t) => {
  const made = setup(t);
  const prepared = await prepare(made, null, { setup: 1 });
  assert.equal(prepared.status, "failed");
  assert.equal(prepared.run, "not-started");
  assert.ok(!made.calls.some((call) => call[0] === "(async)"));
  assert.equal(made.calls.at(-1)?.[0], "rm");
});

await test("unsafe inputs are refused together before Docker is touched", async (t) => {
  const made = setup(t);
  made.tooling.write("README.md", "uncommitted\n");
  writeFileSync(join(made.scratch, "out"), "");
  const prepared = await prepare(made, null, {}, { task: "../escape", baseRef: "refs/heads/missing" });
  assert.equal(prepared.status, "refused");
  assert.equal(made.calls.length, 0);
  const text = prepared.refusals.join("\n");
  for (const pattern of [/task/, /uncommitted/, /already exists/, /refs\/heads\/missing/]) assert.match(text, pattern);
});

await test("the async exec reports exit, timeout and interruption, and caps the log it keeps", async (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "isolated-exec-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const script = join(scratch, "fake-docker.mjs");
  writeFileSync(script, "const [mode] = process.argv.slice(2); if (mode === 'loud') { process.stdout.write('x'.repeat(4096)); process.exit(3); } setTimeout(() => {}, 60000);\n");
  const exec = dockerExec(process.execPath, 1024);
  const log = join(scratch, "guest.log");
  assert.deepEqual(await exec([script, "loud"], { timeoutMs: 10_000, log }), { status: 3, ended: "exited" });
  assert.ok(readFileSync(log).length <= 1024 + 200, "the log stops at its cap");
  assert.deepEqual(await exec([script, "hang"], { timeoutMs: 200, log }), { status: null, ended: "timed-out" });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);
  assert.deepEqual(await exec([script, "hang"], { timeoutMs: 10_000, signal: controller.signal, log }), { status: null, ended: "interrupted" });
});
