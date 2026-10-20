import assert from "node:assert/strict";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import type { Docker } from "./container-runtime.ts";
import { BOUNDS, type Prepared } from "./isolated-run.ts";
import { hangRefusals, isolatedRunControl, main, positiveRefusals, type Observed } from "./isolated-run-smoke.ts";

// The judgments of the real-container control, on observations built here. The control itself runs
// only where Docker is: npm run sandbox:smoke in the required CI check.
const BASE = "a".repeat(40);
const CANDIDATE = "b".repeat(40);
const pinned = { base: BASE, tooling: "c".repeat(40), image: "sha256:image", launch: ["create", "--security-opt=no-new-privileges", "--cap-drop=ALL", "--cgroupns=private", ...BOUNDS, "img"] };
const accepted = {
  accepted: true as const, quarantine: "/q", gitDir: "/q/repo.git", base: BASE, kind: "incremental" as const, prerequisites: [BASE],
  candidate: { ref: "refs/quarantine/candidate", sha: CANDIDATE }, recovery: null, builderClaims: { merge: "succeeded" as const },
};
const recovery = JSON.stringify({ version: 1, status: "interrupted", tip: BASE, branches: [{ ref: "refs/heads/sandcastle/issue-1", sha: CANDIDATE, patch: "diff --git a/work.txt b/work.txt" }], uncommitted: [] });

function prepared(extra: Partial<Prepared>): Prepared {
  return { status: "candidate", run: "completed", verified: false, published: false, pinned, candidate: accepted, recovery: "/out/artifacts/recovery.data", refusals: [], ...extra };
}

const positive = (extra: Partial<Prepared> = {}, observed: Partial<Observed> = {}): string[] =>
  positiveRefusals({ prepared: prepared(extra), base: BASE, markerOnHost: false, hostChanges: [], fired: "fsmonitor\n", recovery: null, ...observed });

await test("a contained positive run passes only with every observation in place", () => {
  assert.deepEqual(positive(), []);
  const cases: [string, string[], RegExp][] = [
    ["no candidate", positive({ status: "no-candidate", candidate: null }), /not a quarantined candidate/],
    ["a failed run", positive({ run: "failed" }), /run ended failed/],
    ["another base", positive({ candidate: { ...accepted, base: "d".repeat(40) } }), /base/],
    ["no launch limits", positive({ pinned: { ...pinned, launch: ["create", "img"] } }), /--memory=4g/],
    ["the marker on the host", positive({}, { markerOnHost: true }), /host/],
    ["a changed host repository", positive({}, { hostChanges: ["HEAD moved"] }), /HEAD moved/],
    ["a silent fsmonitor", positive({}, { fired: "" }), /did not fire/],
  ];
  for (const [name, refusals, pattern] of cases) assert.match(refusals.join("\n"), pattern, name);
});

await test("a timed-out run passes only when it claims nothing and keeps the committed issue branch", () => {
  const hang = (extra: Partial<Prepared>, observed: Partial<Observed> = {}): string[] =>
    hangRefusals({ prepared: prepared({ status: "no-candidate", run: "timed-out", candidate: null, ...extra }), base: BASE, markerOnHost: false, hostChanges: [], fired: "", recovery, ...observed });
  assert.deepEqual(hang({}), []);
  assert.match(hang({ run: "completed" }).join("\n"), /timed-out/);
  assert.match(hang({ status: "candidate", candidate: accepted }).join("\n"), /claims/);
  assert.match(hang({}, { recovery: null }).join("\n"), /recovery/);
  assert.match(hang({}, { recovery: JSON.stringify({ branches: [] }) }).join("\n"), /issue-1/);
  assert.match(hang({}, { markerOnHost: true }).join("\n"), /host/);
});

await test("without Docker the control is blocked, never a pass", async () => {
  const missing: Docker = () => { throw Object.assign(new Error("spawnSync docker ENOENT"), { code: "ENOENT" }); };
  assert.match((await isolatedRunControl("img", { docker: missing, exec: () => Promise.reject(new Error("unused")) })).join("\n"), /blocked/);
});

await test("the entry point takes one image and reports through its exit code", async () => {
  const out: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => out.push(line) };
  assert.equal(await main([], { output }), EXIT_ERROR);
  const missing: Docker = () => ({ status: 1, stdout: "", stderr: "no daemon" });
  assert.equal(await main(["img"], { output, deps: { docker: missing, exec: () => Promise.reject(new Error("unused")) } }), EXIT_REFUSED);
  assert.match(out.join("\n"), /blocked/);
});
