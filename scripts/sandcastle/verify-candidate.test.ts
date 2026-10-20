import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createVerifierCandidate, fakeReviewer, type VerifierFixture } from "../test-support/verifier-fixture.ts";
import type { Docker, DockerResult } from "./container-runtime.ts";
import { main, type Options } from "./verify-candidate.ts";

function fixture(t: TestContext): VerifierFixture {
  const made = createVerifierCandidate();
  t.after(() => made.cleanup());
  return made;
}

const argsFor = (made: VerifierFixture): string[] => [
  "--artifacts", made.artifacts, "--source", made.host.dir, "--repository", made.expected.repository,
  "--task", made.expected.task, "--base", made.base, "--ref", made.expected.ref, "--run", made.run,
];

async function go(args: readonly string[], options: Omit<Options, "output"> = {}): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: await main(args, { ...options, output }), out: out.join("\n"), err: err.join("\n") };
}

const ok = (stdout = ""): DockerResult => ({ status: 0, stdout, stderr: "" });
const CLEAN_INSPECT = JSON.stringify([{
  Mounts: [], HostConfig: { Privileged: false, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"], Runtime: "runc", MaskedPaths: ["/proc/kcore"], ReadonlyPaths: ["/proc/sys"] },
  Config: { Env: [] },
}]);

function fakeDocker(calls: string[][]): Docker {
  return (args) => {
    calls.push([...args]);
    if (args[0] === "image") return ok("sha256:verifier\n");
    if (args[0] === "create") return ok("cid\n");
    if (args[0] === "inspect") return ok(CLEAN_INSPECT);
    return ok("27.0.1\n");
  };
}

await test("--help prints usage and wrong arguments are a usage error", async () => {
  assert.equal((await go(["--help"])).code, EXIT_OK);
  assert.equal((await go(["--artifacts"])).code, EXIT_ERROR);
  assert.equal((await go(["--artifacts", "a"])).code, EXIT_ERROR);
  const bad = await go(["--artifacts", "a", "--source", "s", "--repository", "r", "--task", "t", "--base", "nope", "--ref", "main", "--run", "../x"]);
  assert.equal(bad.code, EXIT_ERROR);
  assert.match(bad.err, /--base/);
});

await test("without an authorised reviewer the real command is blocked, never a pass, and issues no receipt", async (t) => {
  const made = fixture(t);
  const calls: string[][] = [];
  const result = await go(argsFor(made), { docker: fakeDocker(calls), store: made.store });
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /blocked: no reviewer/);
  assert.match(result.err, /not a pass/);
  assert.deepEqual(calls, [], "Docker was not touched");
  assert.deepEqual(readdirSync(made.store), []);
});

await test("without Docker the command is blocked, never a pass", async (t) => {
  const made = fixture(t);
  const missing: Docker = () => { throw Object.assign(new Error("spawnSync docker ENOENT"), { code: "ENOENT" }); };
  const result = await go(argsFor(made), { docker: missing, reviewer: fakeReviewer(), store: made.store });
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /blocked: .*Docker/);
});

await test("with a reviewer and Docker it builds the verifier image, verifies and reports the receipt", async (t) => {
  const made = fixture(t);
  const calls: string[][] = [];
  const result = await go(argsFor(made), { docker: fakeDocker(calls), reviewer: fakeReviewer(), store: made.store, checks: ["test"], root: made.root });
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /passed: receipt [0-9a-f]{64}/);
  assert.ok(calls.some((call) => call[0] === "build"), "the image is built from the control checkout");
  assert.equal(readdirSync(made.store).length, 1);
});

await test("a refused candidate exits 1 and names why", async (t) => {
  const made = fixture(t);
  const args = argsFor(made);
  args[args.indexOf("--task") + 1] = "issue-99";
  const result = await go(args, { docker: fakeDocker([]), reviewer: fakeReviewer(), store: made.store, checks: ["test"], root: made.root });
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /task/);
});
