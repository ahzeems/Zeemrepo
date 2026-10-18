import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { launchRefusals } from "./containment-smoke.ts";
import { dockerRuntime, prepareScript, stepScript, verifierCreateArgs, type Docker, type DockerResult, type RuntimeResult } from "./container-runtime.ts";

const CLEAN_INSPECT = [{
  Mounts: [],
  HostConfig: {
    Binds: null, Privileged: false, NetworkMode: "bridge", PidMode: "", IpcMode: "private", UTSMode: "", UsernsMode: "", CgroupnsMode: "private",
    CapAdd: null, CapDrop: ["ALL"], Devices: [], DeviceCgroupRules: null, DeviceRequests: null, ExtraHosts: null, PortBindings: {}, PublishAllPorts: false,
    SecurityOpt: ["no-new-privileges"], Runtime: "runc", MaskedPaths: ["/proc/kcore"], ReadonlyPaths: ["/proc/sys"],
  },
  Config: { Env: ["PATH=/usr/local/bin:/usr/bin"] },
}];

type Fake = { version?: DockerResult; image?: DockerResult; inspect?: unknown; exec?: (script: string) => DockerResult };

function fakeDocker(fake: Fake = {}): { docker: Docker; calls: string[][] } {
  const calls: string[][] = [];
  const ok = (stdout = ""): DockerResult => ({ status: 0, stdout, stderr: "" });
  const docker: Docker = (args) => {
    calls.push([...args]);
    const [sub] = args;
    if (sub === "version") return fake.version ?? ok("27.0.1\n");
    if (sub === "image") return fake.image ?? ok("sha256:abc\n");
    if (sub === "create") return ok("cid\n");
    if (sub === "inspect") return ok(JSON.stringify(fake.inspect ?? CLEAN_INSPECT));
    if (sub === "exec") return (fake.exec ?? (() => ok("fine\n")))(args.at(-1) ?? "");
    return ok();
  };
  return { docker, calls };
}

const STEPS = [{ name: "install", command: "npm ci" }, { name: "test", command: "node --test" }];
const resultsOf = (result: RuntimeResult): { name: string; exit: number | null; outputBytes: number }[] => {
  assert.ok("results" in result, JSON.stringify(result));
  return result.results.map(({ name, exit, outputBytes }) => ({ name, exit, outputBytes }));
};

await test("the verifier container launches with the containment flags, no mounts, no environment and no host path", () => {
  const args = verifierCreateArgs("verifier-1", "zeemrepo-sandbox:verifier");
  assert.deepEqual(launchRefusals(args), []);
  assert.ok(!args.some((arg) => arg.startsWith("-v") || arg.startsWith("--mount") || arg.startsWith("--env") || arg.startsWith("-e")));
});

await test("identity names the image Docker reports, and is null without Docker or the image", () => {
  assert.deepEqual(dockerRuntime(fakeDocker().docker, "img").identity(), { runtime: "docker", image: "sha256:abc" });
  assert.equal(dockerRuntime(fakeDocker({ version: { status: 1, stdout: "", stderr: "no daemon" } }).docker, "img").identity(), null);
  assert.equal(dockerRuntime(fakeDocker({ image: { status: 1, stdout: "", stderr: "no such image" } }).docker, "img").identity(), null);
  const missing: Docker = () => { throw Object.assign(new Error("spawnSync docker ENOENT"), { code: "ENOENT" }); };
  assert.equal(dockerRuntime(missing, "img").identity(), null);
});

await test("each step's exit and output digest come from Docker on the host, and the container is always removed", () => {
  const { docker, calls } = fakeDocker({ exec: (script) => (script.includes("node --test") ? { status: 3, stdout: "boom\n", stderr: "" } : { status: 0, stdout: "ok\n", stderr: "" }) });
  const result = dockerRuntime(docker, "img").run("/q/candidate.tar", STEPS);
  assert.deepEqual(resultsOf(result), [{ name: "install", exit: 0, outputBytes: 3 }, { name: "test", exit: 3, outputBytes: 5 }]);
  const order = calls.map((call) => call[0]);
  assert.ok(order.indexOf("inspect") < order.indexOf("start"), "inspected before it runs");
  assert.ok(order.indexOf("cp") < order.indexOf("start"), "the tree is copied in before anything runs");
  assert.equal(order.at(-1), "rm");
  const cp = calls.find((call) => call[0] === "cp") ?? [];
  assert.deepEqual(cp.slice(1), ["/q/candidate.tar", "cid:/tmp/candidate.tar"]);
});

await test("a failed install stops before the checks run", () => {
  const { docker, calls } = fakeDocker({ exec: (script) => ({ status: script.includes("npm ci") ? 1 : 0, stdout: "", stderr: "" }) });
  assert.deepEqual(resultsOf(dockerRuntime(docker, "img").run("/q/c.tar", STEPS)).map((step) => step.name), ["install"]);
  assert.ok(!calls.some((call) => call.at(-1)?.includes("node --test")));
});

await test("a step that overruns its output or time limit has no exit code", () => {
  const { docker } = fakeDocker({ exec: (script) => (script.includes("node --test") ? { status: null, stdout: "", stderr: "", error: "ENOBUFS" } : { status: 0, stdout: "", stderr: "" }) });
  assert.deepEqual(resultsOf(dockerRuntime(docker, "img").run("/q/c.tar", STEPS)).map((step) => step.exit), [0, null]);
});

await test("a container the inspection finds unsafe is refused, never started, and removed", () => {
  const { docker, calls } = fakeDocker({ inspect: [{ ...CLEAN_INSPECT[0], Mounts: [{ Source: "/srv/receipts" }] }] });
  const result = dockerRuntime(docker, "img").run("/q/c.tar", STEPS);
  assert.ok("refusals" in result);
  assert.match(result.refusals.join("\n"), /mounts/);
  assert.ok(!calls.some((call) => call[0] === "start" || call[0] === "exec"));
  assert.equal(calls.at(-1)?.[0], "rm");
});

await test("a forbidden host path such as the receipt store never reaches a Docker argument", () => {
  const { docker, calls } = fakeDocker();
  const result = dockerRuntime(docker, "img", ["/q"]).run("/q/c.tar", STEPS);
  assert.ok("refusals" in result);
  assert.match(result.refusals.join("\n"), /forbidden host path/);
  assert.deepEqual(calls, []);
});

await test("a Docker control step that fails is a tool error, and the container is still removed", () => {
  const base = fakeDocker();
  const calls: string[][] = [];
  const docker: Docker = (args) => {
    calls.push([...args]);
    return args[0] === "cp" ? { status: 1, stdout: "", stderr: "no space" } : base.docker(args);
  };
  assert.throws(() => dockerRuntime(docker, "img").run("/q/c.tar", STEPS), /docker cp failed/);
  assert.equal(calls.at(-1)?.[0], "rm");
});

function scratch(t: TestContext, files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "verifier-step-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

await test("the step environment keeps a candidate's unittest package from shadowing Python's own", (t) => {
  const dir = scratch(t, {
    "unittest/__init__.py": "", "unittest/__main__.py": "import sys\nsys.exit(0)\n",
    "tests/test_fail.py": "import unittest\n\nclass T(unittest.TestCase):\n    def test_fails(self):\n        self.fail('real failure')\n",
  });
  const command = "python3 -m unittest discover --start-directory tests";
  assert.equal(spawnSync("sh", ["-c", command], { cwd: dir, env: { ...cleanGitEnv, PYTHONPATH: dir } }).status, 0, "control: unprotected, the shadowing package turns the failure into exit 0");
  const guarded = spawnSync("sh", ["-c", stepScript(command)], { cwd: dir, env: { ...cleanGitEnv, PYTHONPATH: dir }, encoding: "utf8" });
  assert.notEqual(guarded.status, 0, guarded.stdout);
  assert.match(guarded.stdout, /real failure/);
});

await test("the prepared candidate repository tracks every archived file, even one its .gitignore covers", (t) => {
  const tree = scratch(t, { ".gitignore": "wiki/secret.md\n", "wiki/secret.md": "tracked by force\n", "README.md": "x\n" });
  const work = mkdtempSync(join(tmpdir(), "verifier-prepare-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const tar = join(work, "candidate.tar");
  spawnSync("tar", ["-c", "-f", tar, "-C", tree, "."], { env: cleanGitEnv });
  const prepared = spawnSync("sh", ["-c", prepareScript(join(work, "candidate"), tar)], { env: cleanGitEnv, encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  const files = spawnSync("git", ["-C", join(work, "candidate"), "ls-files"], { env: cleanGitEnv, encoding: "utf8" }).stdout.split("\n");
  assert.ok(files.includes("wiki/secret.md"), files.join(", "));
});
