import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { Run } from "../git/pr-ready.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { createArgs, inspectRefusals, launchRefusals, main, resultRefusals } from "./containment-smoke.ts";
import { installedSdkVersion } from "./containment-smoke-guest.ts";

const SDK_VERSION = installedSdkVersion(join(import.meta.dirname, "..", ".."));
const CLEAN_INSPECT = [{
  Mounts: [],
  HostConfig: {
    Binds: null, Privileged: false, NetworkMode: "bridge", PidMode: "", IpcMode: "private", UTSMode: "", UsernsMode: "", CgroupnsMode: "private",
    CapAdd: null, CapDrop: ["ALL"], Devices: [], DeviceCgroupRules: null, DeviceRequests: null, ExtraHosts: null, PortBindings: {}, PublishAllPorts: false,
    SecurityOpt: ["no-new-privileges"], Runtime: "runc", MaskedPaths: ["/proc/kcore"], ReadonlyPaths: ["/proc/sys"],
  },
  Config: { Env: ["PATH=/usr/local/bin:/usr/bin", "NODE_VERSION=24.11.0", "CONTAINMENT_MARKERS=/tmp/containment-x"] },
}];

function guestResult(markerDir: string): Record<string, unknown> {
  return {
    os: "ubuntu 26.04", node: "v24.11.0", python: "Python 3.14.4", git: "git version 2.39.5", claude: "2.1.289 (Claude Code)", sdk: SDK_VERSION,
    checks: ["lint", "typecheck", "test", "evals:test"].map((script) => ({ script, exit: 0 })),
    probe: { commits: 1, duringClose: ["fsmonitor"], markerDir },
    sockets: [], mountPoints: ["/", "/proc", "/proc/sys", "/dev", "/dev/shm", "/sys", "/etc/hosts", "/etc/hostname", "/etc/resolv.conf"],
  };
}

type Fake = { inspect?: unknown; start?: number; result?: (markerDir: string) => unknown; dockerMissing?: boolean; duringStart?: (markerDir: string) => void };

function fakeDocker(fake: Fake = {}): { run: Run; calls: string[][] } {
  const calls: string[][] = [];
  let markerDir = "";
  const run: Run = (command, args) => {
    calls.push([command, ...args]);
    if (command === "docker" && fake.dockerMissing === true) throw Object.assign(new Error("spawnSync docker ENOENT"), { code: "ENOENT" });
    const [sub] = args;
    if (command === "git") return { status: 0, stdout: "" };
    if (sub === "create") {
      markerDir = (args.find((arg) => arg.startsWith("CONTAINMENT_MARKERS=")) ?? "").slice("CONTAINMENT_MARKERS=".length);
      return { status: 0, stdout: "cid\n" };
    }
    if (sub === "inspect") return { status: 0, stdout: JSON.stringify(fake.inspect ?? CLEAN_INSPECT) };
    if (sub === "start") {
      fake.duringStart?.(markerDir);
      return { status: fake.start ?? 0, stdout: "" };
    }
    if (sub === "cp" && (args[1] ?? "").startsWith("cid:")) {
      writeFileSync(args[2] ?? "", JSON.stringify((fake.result ?? guestResult)(markerDir)));
    }
    return { status: 0, stdout: "" };
  };
  return { run, calls };
}

function host(t: TestContext): RepoFixture & { markers: string } {
  const repo = createRepo("containment-host-");
  const markers = mkdtempSync(join(tmpdir(), "containment-markers-"));
  t.after(() => { repo.cleanup(); rmSync(markers, { recursive: true, force: true }); });
  repo.write(".nvmrc", "24\n");
  repo.commit("base");
  return { ...repo, markers };
}

function go(repo: RepoFixture & { markers: string }, run: Run, args: string[] = []): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd: repo.dir, output, run, markerRoot: repo.markers }), out: out.join("\n"), err: err.join("\n") };
}

await test("a contained run builds the image, launches a clean container without mounts and passes", (t) => {
  const repo = host(t);
  const { run, calls } = fakeDocker();
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /contained/);
  assert.match(result.out, /guest reports os ubuntu 26\.04, node v24\.11\.0, python Python 3\.14\.4, git git version 2\.39\.5, claude 2\.1\.289 \(Claude Code\), sdk /);
  const order = calls.map((call) => call.slice(0, 2).join(" "));
  for (const step of ["docker version", "docker build", "git archive", "docker create", "docker inspect", "docker cp", "docker start", "docker rm"]) {
    assert.ok(order.includes(step), step);
  }
  assert.ok(order.indexOf("docker inspect") < order.indexOf("docker start"), "the container is inspected before it runs");
  assert.equal(order.filter((step) => step.startsWith("docker ")).at(-1), "docker rm", "the container is removed last");
});

await test("after containment passes, the verifier and isolated-run controls run on the same image and either failure refuses", (t) => {
  const repo = host(t);
  const { run, calls } = fakeDocker();
  assert.equal(go(repo, run).code, EXIT_OK);
  const control = calls.filter((call) => call[0] === "node");
  assert.equal(control.length, 2);
  assert.match(control[0]?.[1] ?? "", /verifier-driver-smoke\.ts$/);
  assert.match(control[1]?.[1] ?? "", /isolated-run-smoke\.ts$/);
  assert.deepEqual(control.map((call) => call[2]), ["zeemrepo-sandbox:containment-smoke", "zeemrepo-sandbox:containment-smoke"]);
  const order = calls.map((call) => call.slice(0, 2).join(" "));
  assert.ok(order.lastIndexOf("docker rm") < order.findIndex((step) => step.startsWith("node ")), "the probe container is gone first");
  for (const [script, pattern] of [["verifier-driver-smoke", /verifier control exited 1/], ["isolated-run-smoke", /isolated-run control exited 1/]] as const) {
    const failing: Run = (command, args, options) => (command === "node" && (args[0] ?? "").includes(script) ? { status: 1, stdout: "" } : run(command, args, options));
    const refused = go(repo, failing);
    assert.equal(refused.code, EXIT_REFUSED);
    assert.match(refused.err, pattern);
  }
});

await test("missing Docker is a blocked result, never a pass", (t) => {
  const repo = host(t);
  const result = go(repo, fakeDocker({ dockerMissing: true }).run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /blocked: Docker is not available/);
  assert.match(result.err, /not a pass/);
});

await test("a container the inspection finds unsafe is never started", async (t) => {
  const unsafe: [string, Record<string, unknown>, RegExp][] = [
    ["a mount", { Mounts: [{ Source: "/srv/host/work", Destination: "/home/agent/workspace" }] }, /mounts/],
    ["privileged", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, Privileged: true } }, /privileged/],
    ["host network", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, NetworkMode: "host" } }, /NetworkMode/],
    ["a credential in the environment", { Config: { Env: ["GH_TOKEN=x"] } }, /GH_TOKEN/],
    ["bind mounts", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, Binds: ["/srv:/srv"] } }, /bind mounts/],
    ["added capabilities", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, CapAdd: ["SYS_ADMIN"] } }, /adds capabilities/],
    ["capabilities not dropped", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, CapDrop: null } }, /does not drop every capability/],
    ["an unconfined seccomp profile", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, SecurityOpt: ["no-new-privileges", "seccomp=unconfined"] } }, /SecurityOpt/],
    ["the host cgroup namespace", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, CgroupnsMode: "host" } }, /CgroupnsMode/],
    ["a device rule", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, DeviceCgroupRules: ["c 1:3 mr"] } }, /device rules/],
    ["an extra host", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, ExtraHosts: ["h:host-gateway"] } }, /extra hosts/],
    ["a published port", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, PortBindings: { "80/tcp": [{ HostPort: "8080" }] } } }, /published ports/],
    ["every port published", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, PublishAllPorts: true } }, /published ports/],
    ["a host device", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, Devices: [{ PathOnHost: "/dev/sda" }] } }, /host devices/],
    ["a GPU request", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, DeviceRequests: [{ Driver: "nvidia" }] } }, /host devices/],
    ["another container's network", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, NetworkMode: "container:other" } }, /NetworkMode is container:other/],
    ["another runtime", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, Runtime: "sysbox-runc" } }, /Runtime/],
    ["unmasked system paths", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, MaskedPaths: [] } }, /system paths/],
    ["writable system paths", { HostConfig: { ...CLEAN_INSPECT[0]?.HostConfig, ReadonlyPaths: [] } }, /system paths/],
  ];
  for (const [name, change, named] of unsafe) {
    await t.test(name, (t) => {
      const repo = host(t);
      const { run, calls } = fakeDocker({ inspect: [{ ...CLEAN_INSPECT[0], ...change }] });
      const result = go(repo, run);
      assert.equal(result.code, EXIT_REFUSED);
      assert.match(result.err, named);
      assert.ok(!calls.some((call) => call[1] === "start"), "the container never starts");
      assert.equal(calls.at(-1)?.slice(0, 2).join(" "), "docker rm", "the created container is still removed");
    });
  }
});

await test("a guest result that misses a control, or a trace on the host, is refused", async (t) => {
  const cases: [string, Fake, RegExp][] = [
    ["the guest exits non-zero", { start: 1 }, /guest exited 1/],
    ["the cleanup sentinel never fired", { result: (m) => ({ ...guestResult(m), probe: { commits: 1, duringClose: [], markerDir: m } }) }, /fsmonitor/],
    ["a failed check", { result: (m) => ({ ...guestResult(m), checks: [{ script: "lint", exit: 0 }, { script: "typecheck", exit: 1 }] }) }, /typecheck/],
    ["the wrong Node", { result: (m) => ({ ...guestResult(m), node: "v22.1.0" }) }, /Node v22\.1\.0/],
    ["a mounted host path", { result: (m) => ({ ...guestResult(m), mountPoints: ["/", "/home/agent/workspace"] }) }, /\/home\/agent\/workspace/],
    ["a reachable docker socket", { result: (m) => ({ ...guestResult(m), sockets: ["/var/run/docker.sock"] }) }, /docker\.sock/],
    ["a sentinel that fired on the host", { duringStart: (m) => mkdirSync(m, { recursive: true }) }, /on the host/],
    ["unreadable guest output", { result: () => "not an object" }, /guest result/],
    ["evals:test missing", { result: (m) => ({ ...guestResult(m), checks: ["lint", "typecheck", "test"].map((script) => ({ script, exit: 0 })) }) }, /evals:test exited undefined/],
    ["no Python", { result: (m) => ({ ...guestResult(m), python: "unavailable (python3)" }) }, /no Python 3\.12 or later/],
    ["a Python older than 3.12", { result: (m) => ({ ...guestResult(m), python: "Python 3.11.2" }) }, /no Python 3\.12 or later \(Python 3\.11\.2\)/],
    ["another operating system", { result: (m) => ({ ...guestResult(m), os: "debian 13" }) }, /the guest runs debian 13, not ubuntu 26\.04/],
    ["another Ubuntu release", { result: (m) => ({ ...guestResult(m), os: "ubuntu 24.04" }) }, /the guest runs ubuntu 24\.04, not ubuntu 26\.04/],
    ["no operating system reported", { result: (m) => ({ ...guestResult(m), os: undefined }) }, /the guest runs undefined, not ubuntu 26\.04/],
    ["an operating system that is not a string", { result: (m) => ({ ...guestResult(m), os: ["ubuntu 26.04"] }) }, /not ubuntu 26\.04/],
    ["no commit collected", { result: (m) => ({ ...guestResult(m), probe: { commits: 0, duringClose: ["fsmonitor"], markerDir: m } }) }, /commit was not collected/],
    ["no mount points reported", { result: (m) => ({ ...guestResult(m), mountPoints: [] }) }, /no mount points/],
    ["no probe", { result: (m) => ({ ...guestResult(m), probe: undefined }) }, /has no probe/],
    ["an oversized result", { result: (m) => ({ ...guestResult(m), padding: "x".repeat(1 << 20) }) }, /under 1 MiB/],
    ["sockets unreported", { result: (m) => ({ ...guestResult(m), sockets: undefined }) }, /\(unreported\)/],
  ];
  for (const [name, fake, named] of cases) {
    await t.test(name, (t) => {
      const repo = host(t);
      const result = go(repo, fakeDocker(fake).run);
      assert.equal(result.code, EXIT_REFUSED);
      assert.match(result.err, named);
    });
  }
});

await test("a guest result that is a link is never followed on the host", (t) => {
  const repo = host(t);
  const elsewhere = join(repo.markers, "host-file.json");
  writeFileSync(elsewhere, JSON.stringify(guestResult("/tmp/x")));
  const base = fakeDocker();
  const run: Run = (command, args, options) => {
    if (command === "docker" && args[0] === "cp" && (args[1] ?? "").startsWith("cid:")) {
      symlinkSync(elsewhere, args[2] ?? "");
      return { status: 0, stdout: "" };
    }
    return base.run(command, args, options);
  };
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /not a regular file/);
});

await test("the launch gate stops an unsafe launch before any container is created", (t) => {
  const repo = host(t);
  const { run, calls } = fakeDocker();
  const out: string[] = [];
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: (line) => out.push(line), warn: (line) => err.push(line) }, run, markerRoot: join(repo.markers, "docker.sock.d") });
  assert.equal(code, EXIT_REFUSED);
  assert.match(err.join("\n"), /names the Docker socket/);
  assert.ok(!calls.some((call) => call[1] === "create"), "nothing is created");
});

await test("a checkout git cannot read is refused rather than read as clean", (t) => {
  const repo = host(t);
  const base = fakeDocker();
  const run: Run = (command, args, options) => command === "git" && args[0] === "status"
    ? { status: 128, stdout: "" } : base.run(command, args, options);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /git status failed/);
});

await test("a dirty checkout is refused, so the image and the copied files come from the same tree", (t) => {
  const repo = host(t);
  repo.write("dirty.md", "x\n");
  const base = fakeDocker();
  const run: Run = (command, args, options) => command === "git" && args[0] === "status"
    ? { status: 0, stdout: "?? dirty.md\n" } : base.run(command, args, options);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /uncommitted changes/);
  assert.ok(!base.calls.some((call) => call[1] === "build"), "nothing is built");
});

await test("a host checkout whose git state changes during the run is refused", (t) => {
  const repo = host(t);
  const result = go(repo, fakeDocker({ duringStart: () => repo.git(["config", "core.fsmonitor", "planted"]) }).run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /host git state changed: local git config changed: core\.fsmonitor/);
});

await test("launch settings that would open the boundary are refused before anything is created", () => {
  const safe = createArgs("name", "image", "/tmp/containment-x");
  assert.deepEqual(launchRefusals(safe), [], "the launcher's own arguments are safe");
  const unsafe: [string[], RegExp][] = [
    [["-v", "/home:/home"], /-v/],
    [["--volume=/home:/home"], /--volume/],
    [["--mount", "type=bind,src=/,dst=/h"], /--mount/],
    [["--privileged"], /--privileged/],
    [["--network", "host"], /--network host/],
    [["--pid=host"], /--pid=host/],
    [["--cap-add", "SYS_ADMIN"], /--cap-add/],
    [["--device", "/dev/sda"], /--device/],
    [["--env", "GH_TOKEN=x"], /GH_TOKEN/],
    [["--env-file", ".sandcastle/.env"], /--env-file/],
    [["--volumes-from", "other"], /--volumes-from/],
    [["--security-opt", "seccomp=unconfined"], /--security-opt seccomp=unconfined/],
    [["--security-opt=apparmor=unconfined"], /apparmor=unconfined/],
    [["-p", "8080:80"], /-p/],
    [["--publish=8080:80"], /--publish/],
    [["--add-host", "h:host-gateway"], /--add-host/],
    [["--device-cgroup-rule", "c 1:3 mr"], /--device-cgroup-rule/],
    [["--group-add", "docker"], /--group-add/],
    [["-v/srv:/srv"], /-v/],
    [["-p8080:80"], /-p/],
    [["--runtime", "sysbox-runc"], /--runtime/],
    [["--gpus", "all"], /--gpus/],
    [["--sysctl", "net.ipv4.ip_forward=1"], /--sysctl/],
    [["--cgroup-parent", "/host"], /--cgroup-parent/],
    [["--link", "other"], /--link/],
    [["--mount=type=bind,src=/var/run/docker.sock,dst=/s"], /Docker socket/],
    [["--network", "container:other"], /--network container:other/],
    [["-eGH_TOKEN=x"], /GH_TOKEN/],
    [["-itv/srv:/srv"], /combined short options/],
    [["-dP"], /combined short options/],
  ];
  for (const [extra, named] of unsafe) {
    const args = [...safe.slice(0, -1), ...extra, safe.at(-1) ?? ""];
    assert.match(launchRefusals(args).join("\n"), named, extra.join(" "));
  }
  assert.match(launchRefusals(safe.filter((arg) => arg !== "--security-opt=no-new-privileges")).join(), /no-new-privileges/);
  assert.match(launchRefusals(safe.filter((arg) => arg !== "--cap-drop=ALL")).join(), /--cap-drop=ALL/);
  assert.match(launchRefusals(safe.filter((arg) => arg !== "--cgroupns=private")).join(), /--cgroupns=private/);
});

await test("inspection and results are judged as untrusted data", () => {
  assert.match(inspectRefusals("nope").join(), /inspect output/);
  assert.match(inspectRefusals([]).join(), /inspect output/);
  assert.match(resultRefusals(null, { nodeMajor: "24", sdk: SDK_VERSION, markerDir: "/tmp/x" }).join(), /guest result/);
  assert.match(resultRefusals({ ...guestResult("/tmp/x"), sdk: "0.0.1" }, { nodeMajor: "24", sdk: SDK_VERSION, markerDir: "/tmp/x" }).join(), /SDK 0\.0\.1/);
  assert.match(resultRefusals(guestResult("/tmp/other"), { nodeMajor: "24", sdk: SDK_VERSION, markerDir: "/tmp/x" }).join(), /marker directory/);
});

await test("Python 3.12.0 is the oldest guest Python accepted", () => {
  const expected = { nodeMajor: "24", sdk: SDK_VERSION, markerDir: "/tmp/x" };
  assert.deepEqual(resultRefusals({ ...guestResult("/tmp/x"), python: "Python 3.12.0" }, expected), []);
  assert.match(resultRefusals({ ...guestResult("/tmp/x"), python: "Python 3.11.14" }, expected).join(), /no Python 3\.12 or later \(Python 3\.11\.14\)/);
});

await test("arguments", (t) => {
  const repo = host(t);
  assert.equal(go(repo, fakeDocker().run, ["--bogus"]).code, EXIT_ERROR);
  assert.match(go(repo, fakeDocker().run, ["--help"]).out, /Usage/);
});
