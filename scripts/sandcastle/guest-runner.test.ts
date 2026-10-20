import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { isRecord } from "../lib/record.ts";
import { REF, REPOSITORY, TASK, createTarget, type Behaviour } from "../test-support/isolated-run-fixture.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { checkArtifacts } from "./artifact.ts";
import { guestSandcastle, recoveryData } from "./guest-runner.ts";

// The guest steps run as the container runs them, in child processes on temporary repositories,
// with the real SDK and coordinator and the scripted fixture agents. No model, container or network.
const FIXTURE_GUEST = join(import.meta.dirname, "..", "test-support", "isolated-run-fixture.ts");
const GUEST = join(import.meta.dirname, "guest-runner.ts");
const STEP_TIMEOUT_MS = 90_000;

type Setup = { target: RepoFixture; base: string; dir: string; marker: string; scratch: string };

function setup(t: TestContext, implementer: Behaviour["implementer"] = "commit"): Setup {
  const scratch = mkdtempSync(join(tmpdir(), "guest-runner-"));
  const marker = join(scratch, "marker");
  const target = createTarget({ marker, implementer });
  t.after(() => {
    target.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  });
  const base = target.git(["rev-parse", "HEAD"]);
  target.git(["bundle", "create", "--quiet", join(scratch, "base.bundle"), "refs/heads/main"]);
  writeFileSync(join(scratch, "spec.json"), JSON.stringify({ repository: REPOSITORY, task: TASK, base, ref: REF, baseRef: "refs/heads/main" }));
  return { target, base, dir: join(scratch, "guest"), marker, scratch };
}

function step(script: string, args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [script, ...args], { env: cleanGitEnv, encoding: "utf8", timeout: STEP_TIMEOUT_MS });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function init(made: Setup): void {
  const result = step(GUEST, ["init", made.dir, join(made.scratch, "spec.json"), join(made.scratch, "base.bundle")]);
  assert.equal(result.status, 0, result.stderr);
}

const runGit = (dir: string, args: readonly string[]): string => spawnSync("git", args, { cwd: dir, env: cleanGitEnv, encoding: "utf8" }).stdout.trim();
const expected = (made: Setup): { repository: string; task: string; base: string; ref: string } => ({ repository: REPOSITORY, task: TASK, base: made.base, ref: REF });

await test("the actual coordinator runs on the bundled base with noSandbox agents and exports an S13 candidate", (t) => {
  const made = setup(t);
  init(made);
  const ran = step(FIXTURE_GUEST, ["run", made.dir]);
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /All done\./);
  const exported = step(GUEST, ["export", made.dir]);
  assert.equal(exported.status, 0, exported.stderr);
  const checked = checkArtifacts(join(made.dir, "artifacts"), expected(made));
  assert.ok(!("refusals" in checked), JSON.stringify(checked));
  assert.equal(checked.manifest.base, made.base, "the pinned base SHA survives the transfer");
  assert.deepEqual(checked.manifest.bundle.prerequisites, [made.base]);
  assert.deepEqual(checked.manifest.claims, { merge: "succeeded" });
  const run = join(made.dir, "run");
  assert.equal(runGit(run, ["rev-parse", REF]), checked.manifest.candidate.sha);
  assert.match(runGit(run, ["show", `${checked.manifest.candidate.sha}:fired.txt`]), /fsmonitor/, "the planted fsmonitor fired where the coordinator ran");
  assert.deepEqual(readdirSync(made.marker).sort(), ["fsmonitor.sh", "log"]);
});

await test("an interrupted run leaves no candidate, and its recovery data keeps the committed issue branch", async (t) => {
  const made = setup(t, "hang");
  init(made);
  const child = spawn(process.execPath, [FIXTURE_GUEST, "run", made.dir], { env: cleanGitEnv, detached: true, stdio: "ignore" });
  const run = join(made.dir, "run");
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  while (Date.now() < deadline && spawnSync("git", ["rev-parse", "--verify", "--quiet", "sandcastle/issue-1~1"], { cwd: run, env: cleanGitEnv }).status !== 0) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  process.kill(-(child.pid ?? 0), "SIGKILL");
  const exported = step(GUEST, ["export", made.dir]);
  assert.equal(exported.status, 0, exported.stderr);
  assert.deepEqual(readdirSync(join(made.dir, "artifacts")), ["recovery.data"], "no candidate claims the unfinished run");
  const recovery: unknown = JSON.parse(readFileSync(join(made.dir, "artifacts", "recovery.data"), "utf8"));
  assert.ok(isRecord(recovery) && Array.isArray(recovery.branches));
  assert.equal(recovery.status, "interrupted");
  const branches: unknown[] = recovery.branches;
  const issue = branches.find((branch) => isRecord(branch) && branch.ref === "refs/heads/sandcastle/issue-1");
  assert.ok(isRecord(issue) && typeof issue.patch === "string" && issue.patch.includes("work.txt"), "the issue branch's commit is kept as a patch");
});

await test("the export's own Git ignores a fsmonitor, hook, external diff or textconv the agents planted", (t) => {
  const made = setup(t);
  init(made);
  const run = join(made.dir, "run");
  const log = join(made.marker, "log");
  mkdirSync(made.marker, { recursive: true });
  for (const name of ["fsmonitor", "post-index-change", "ext-diff", "textconv"]) writeFileSync(join(made.scratch, name), `#!/bin/sh\necho ${name} >> ${log}\n`, { mode: 0o755 });
  runGit(run, ["config", "core.fsmonitor", join(made.scratch, "fsmonitor")]);
  runGit(run, ["config", "core.hooksPath", made.scratch]);
  runGit(run, ["config", "diff.external", join(made.scratch, "ext-diff")]);
  runGit(run, ["config", "diff.planted.textconv", join(made.scratch, "textconv")]);
  writeFileSync(join(run, ".git", "info", "attributes"), "* diff=planted\n");
  // A stat-only change makes status rewrite the index (post-index-change); a content change gives diff something to show.
  utimesSync(join(run, "package.json"), new Date(), new Date(Date.now() + 60_000));
  writeFileSync(join(run, "fixture.json"), "{}\n");
  const exported = step(GUEST, ["export", made.dir]);
  assert.equal(exported.status, 0, exported.stderr);
  assert.equal(existsSync(log) ? readFileSync(log, "utf8") : "", "", "no planted command ran during export");
  assert.deepEqual(readdirSync(join(made.dir, "artifacts")), ["recovery.data"], "the base alone is not a candidate");
});

await test("init refuses a bundle whose head is not the spec's base", (t) => {
  const made = setup(t);
  made.target.write("later.txt", "later\n");
  made.target.commit("later");
  made.target.git(["bundle", "create", "--quiet", join(made.scratch, "base.bundle"), "refs/heads/main"]);
  const result = step(GUEST, ["init", made.dir, join(made.scratch, "spec.json"), join(made.scratch, "base.bundle")]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not the spec's base/);
});

await test("the guest hands the coordinator the SDK's noSandbox provider in place of docker", () => {
  const sandcastle = guestSandcastle(() => { throw new Error("no agent in this test"); });
  const provider: unknown = sandcastle.docker();
  assert.ok(isRecord(provider) && provider.tag === "none" && provider.name === "no-sandbox");
});

await test("recovery data over S13's limit keeps branch tips and statuses only", (t) => {
  const repo = createRepo("guest-recovery-");
  t.after(() => repo.cleanup());
  repo.write("a.txt", "base\n");
  const base = repo.commit("base");
  for (const n of [1, 2, 3, 4, 5]) {
    repo.git(["checkout", "--quiet", "-b", `sandcastle/issue-${String(n)}`, base]);
    repo.write(`big-${String(n)}.txt`, `${"x".repeat(300 * 1024)}\n`);
    repo.commit(`big ${String(n)}`);
  }
  const data: unknown = JSON.parse(recoveryData(repo.dir, base, "failed").toString("utf8"));
  assert.ok(isRecord(data) && Array.isArray(data.branches));
  assert.equal(data.truncated, true);
  assert.equal(data.branches.length, 5);
  assert.ok(data.branches.every((branch) => isRecord(branch) && !("patch" in branch)));
});

await test("the guest refuses an unknown mode", () => {
  const result = step(GUEST, ["publish", "/nowhere"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});
