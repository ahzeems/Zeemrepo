import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { isRecord } from "../lib/record.ts";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { mountPoints, osIdentity, socketPaths, toolchainIdentity } from "./containment-smoke-guest.ts";

const GUEST = join(import.meta.dirname, "containment-smoke-guest.ts");

function scratch(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), "containment-guest-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// The SDK hands its own git calls the inherited environment, so the probe runs in a child
// process whose environment cannot route git to this repository.
function probe(root: string, markers: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [GUEST, "probe", root, markers], { env: cleanGitEnv, encoding: "utf8", timeout: 120_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

await test("the real SDK's sandbox cleanup runs the fsmonitor a fake agent planted, which is the audited A01 path", (t) => {
  const dir = scratch(t);
  const markers = join(dir, "markers");
  const result = probe(join(dir, "work"), markers);
  assert.equal(result.status, 0, result.stderr);
  // The SDK prints its own progress lines first; the probe's report is the last line.
  const observed: unknown = JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "");
  assert.ok(isRecord(observed));
  assert.deepEqual(Object.keys(observed).sort(), ["commits", "duringClose", "markerDir"]);
  assert.equal(observed.commits, 1, "the fake agent's commit is collected");
  assert.ok(Array.isArray(observed.duringClose) && observed.duringClose.includes("fsmonitor"), `close() ran the planted fsmonitor: ${JSON.stringify(observed.duringClose)}`);
  assert.equal(observed.markerDir, markers);
  const log = readFileSync(join(markers, "log"), "utf8").split("\n");
  assert.deepEqual([log[0], log.at(-2), log.at(-1)], ["creating", "closed", ""], "the log opens and closes with the probe's own phases");
  assert.ok(log.slice(log.indexOf("closing") + 1, log.indexOf("closed")).includes("fsmonitor"), "the raw log shows the fsmonitor between closing and closed");
  assert.deepEqual(observed.duringClose, log.slice(log.indexOf("closing") + 1, log.indexOf("closed")), "the report is the raw log, not a summary");
});

await test("the probe refuses to reuse a marker directory, so an old trace cannot pass for a new one", (t) => {
  const dir = scratch(t);
  const markers = join(dir, "markers");
  assert.equal(probe(join(dir, "one"), markers).status, 0);
  const again = probe(join(dir, "two"), markers);
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /already exists/);
});

await test("mount points are read from mountinfo, octal escapes included", () => {
  const mountinfo = [
    "1 0 0:1 / / rw - overlay overlay rw",
    "2 1 0:2 / /proc rw - proc proc rw",
    "3 1 8:1 /var/lib/docker/containers/x/hosts /etc/hosts rw - ext4 /dev/sda1 rw",
    "4 1 8:1 /srv/host/work /home/agent/with\\040space rw - ext4 /dev/sda1 rw",
  ].join("\n");
  assert.deepEqual(mountPoints(mountinfo), ["/", "/proc", "/etc/hosts", "/home/agent/with space"]);
});

await test("the operating system is its os-release ID and VERSION_ID, quoted or not", () => {
  const ubuntu = ['PRETTY_NAME="Ubuntu 26.04.1 LTS"', 'NAME="Ubuntu"', 'VERSION_ID="26.04"', "VERSION_CODENAME=resolute", "ID=ubuntu", "ID_LIKE=debian"].join("\n");
  assert.equal(osIdentity(ubuntu), "ubuntu 26.04");
  assert.equal(osIdentity("ID=debian\nVERSION_ID='13'\n"), "debian 13");
  assert.equal(osIdentity("NAME=Unknown\n"), "unknown unknown", "missing fields are reported, never guessed");
  assert.equal(osIdentity('ID=\nVERSION_ID=""\n'), "unknown unknown", "empty fields are reported as unknown");
});

await test("the guest's report names the operating system its os-release file gives", (t) => {
  const dir = scratch(t);
  const ubuntu = join(dir, "ubuntu-os-release");
  const debian = join(dir, "debian-os-release");
  const blank = join(dir, "blank-os-release");
  writeFileSync(ubuntu, 'ID=ubuntu\nVERSION_ID="26.04"\n');
  writeFileSync(debian, 'ID=debian\nVERSION_ID="13"\n');
  writeFileSync(blank, 'ID=""\nVERSION_ID=\n');
  const identity = toolchainIdentity(ubuntu);
  assert.equal(identity.os, "ubuntu 26.04");
  assert.equal(identity.node, process.version);
  assert.equal(toolchainIdentity(debian).os, "debian 13", "another os-release gives another report");
  assert.equal(toolchainIdentity(blank).os, "unknown unknown");
});

await test("runtime-control sockets are looked for at every usual path", () => {
  const present = new Set(["/run/docker.sock"]);
  assert.deepEqual(socketPaths((path) => present.has(path)), ["/run/docker.sock"]);
  assert.deepEqual(socketPaths(() => false), []);
});

await test("the guest refuses an unknown mode", () => {
  const result = spawnSync(process.execPath, [GUEST, "bogus"], { env: cleanGitEnv, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});
