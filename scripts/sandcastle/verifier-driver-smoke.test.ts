import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { BASE_TEST } from "../test-support/verifier-fixture.ts";
import type { Docker, DockerResult } from "./container-runtime.ts";
import { main, verifierControl } from "./verifier-driver-smoke.ts";

const CLEAN_INSPECT = JSON.stringify([{
  Mounts: [], HostConfig: { Privileged: false, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"], Runtime: "runc", MaskedPaths: ["/proc/kcore"], ReadonlyPaths: ["/proc/sys"] },
  Config: { Env: [] },
}]);
const ok = (stdout = ""): DockerResult => ({ status: 0, stdout, stderr: "" });

/** A Docker that runs nothing but answers the base check by reading feature.txt from the tree it was handed. */
function simulated(check: (feature: string) => number = (feature) => (feature === "ok\n" ? 0 : 1)): { docker: Docker; calls: string[][] } {
  const calls: string[][] = [];
  let feature = "";
  const docker: Docker = (args) => {
    calls.push([...args]);
    const [sub] = args;
    if (sub === "image") return ok("sha256:verifier\n");
    if (sub === "create") return ok(`cid-${String(calls.length)}\n`);
    if (sub === "inspect") return ok(CLEAN_INSPECT);
    if (sub === "cp") feature = execFileSync("tar", ["-x", "-O", "-f", args[1] ?? "", "feature.txt"], { encoding: "utf8", env: cleanGitEnv });
    if (sub === "exec" && (args.at(-1) ?? "").includes(BASE_TEST)) return { status: check(feature), stdout: "", stderr: "" };
    return ok("27.0.1\n");
  };
  return { docker, calls };
}

await test("the control passes when the driver issues a valid receipt for the good candidate and fails the no-op rewrite", async () => {
  const { docker, calls } = simulated();
  assert.deepEqual(await verifierControl("img", docker), []);
  assert.equal(calls.filter((call) => call[0] === "create").length, 2, "each candidate gets a fresh container");
  assert.equal(calls.filter((call) => call[0] === "rm").length, 2);
});

await test("the control refuses a runtime that lets the no-op rewrite pass", async () => {
  assert.match((await verifierControl("img", simulated(() => 0).docker)).join("\n"), /no-op was not failed/);
});

await test("the control refuses when the good candidate does not receive a valid receipt", async () => {
  assert.match((await verifierControl("img", simulated(() => 1).docker)).join("\n"), /good candidate/);
});

await test("without Docker or the image the control is blocked, never a pass", async () => {
  const missing: Docker = () => { throw Object.assign(new Error("spawnSync docker ENOENT"), { code: "ENOENT" }); };
  assert.match((await verifierControl("img", missing)).join("\n"), /blocked/);
});

await test("the entry point takes one image and reports through its exit code", async () => {
  const out: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => out.push(line) };
  assert.equal(await main([], { output }), EXIT_ERROR);
  assert.equal(await main(["img"], { output, docker: simulated().docker }), EXIT_OK);
  assert.equal(await main(["img"], { output, docker: simulated(() => 0).docker }), EXIT_REFUSED);
  assert.match(out.join("\n"), /receipt/);
});
