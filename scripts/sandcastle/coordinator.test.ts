import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { issueBranch, mergeInto } from "../test-support/afk-harness.ts";
import * as fake from "../test-support/coordinator-fake-sdk.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { coordinate } from "./coordinator.ts";

// The coordinator called directly, with the fake SDK as its boundary. The entry-point tests
// (coordinator-entry.test.ts) characterize the whole sequence through .sandcastle/main.ts.

function repoOn(t: TestContext, branch: string): RepoFixture {
  const repo = createRepo("coordinator-direct-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  if (branch !== "main") repo.git(["switch", "--quiet", "-c", branch]);
  return repo;
}

async function call(cwd: string): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await coordinate({ cwd, sandcastle: fake, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out, err };
}

await test("coordinate returns 1 and starts nothing in a checkout on main", async (t) => {
  fake.script({ plans: [{ issues: [{ id: "1", title: "One", branch: "sandcastle/issue-1" }] }] });
  const result = await call(repoOn(t, "main").dir);
  assert.equal(result.code, 1);
  assert.equal(result.err.length, 1);
  assert.deepEqual(fake.journal, []);
});

await test("coordinate reads the checkout it is given, not the process directory", async (t) => {
  const onMain = repoOn(t, "main");
  const feature = repoOn(t, "feat/work");
  const before = process.cwd();
  process.chdir(onMain.dir);
  t.after(() => process.chdir(before));
  fake.script({ plans: [{ issues: [] }] });
  const result = await call(feature.dir);
  assert.equal(result.code, 0);
  assert.deepEqual(result.err, []);
  assert.deepEqual(fake.journal.map((event) => event.call), ["run"]);
  assert.deepEqual(result.out.slice(-1), ["\nAll done."]);
});

await test("coordinate closes the sandbox when the implementer throws", async (t) => {
  fake.script({
    plans: [{ issues: [{ id: "2", title: "Two", branch: "sandcastle/issue-2" }] }],
    agent: () => { throw new Error("sandbox crash"); },
  });
  const result = await call(repoOn(t, "feat/work").dir);
  assert.equal(result.code, 0);
  assert.deepEqual(fake.journal.filter((event) => event.branch === "sandcastle/issue-2").map((event) => event.call), ["createSandbox", "sandbox.run", "close"]);
  assert.deepEqual(result.err, ["  ✗ 2 (sandcastle/issue-2) failed: Error: sandbox crash"]);
});

const planned = (id: number): { id: string; title: string; branch: string } => ({ id: String(id), title: `Issue ${id}`, branch: `sandcastle/issue-${id}` });
const mergerArgs = (): unknown[] => fake.journal.filter((event) => event.name === "merger").map((event) =>
  (typeof event.options === "object" && event.options !== null && "promptArgs" in event.options ? event.options.promptArgs : undefined));
const OVERLAP_TIMEOUT_MS = 2000;

// Resolves once `started` resolves, or rejects after OVERLAP_TIMEOUT_MS so a test fails rather than hangs.
async function within(started: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("pipelines did not overlap")), OVERLAP_TIMEOUT_MS); });
  try {
    await Promise.race([started, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

await test("coordinate runs the issue pipelines concurrently", async (t) => {
  let markSecondStarted = (): void => undefined;
  const secondStarted = new Promise<void>((resolve) => { markSecondStarted = resolve; });
  fake.script({
    plans: [{ issues: [planned(1), planned(2)] }],
    // Issue 1's implementer finishes only after issue 2's has started.
    agent: async (call) => {
      if (call.name !== "implementer") return [];
      if (call.branch === "sandcastle/issue-2") markSecondStarted();
      else await within(secondStarted);
      return [];
    },
  });
  const result = await call(repoOn(t, "feat/work").dir);
  assert.deepEqual(result.err, []);
  assert.equal(result.code, 0);
});

await test("coordinate hands the merger produced branches before left-over ones, in plan order", async (t) => {
  const repo = repoOn(t, "feat/work");
  issueBranch(repo, "sandcastle/issue-3");
  issueBranch(repo, "sandcastle/issue-5");
  const producing = new Set(["sandcastle/issue-1", "sandcastle/issue-2"]);
  fake.script({
    plans: [{ issues: [planned(5), planned(3), planned(2), planned(1)] }],
    agent: (call) => (call.name === "implementer" && producing.has(call.branch ?? "") ? [{ sha: `c-${call.branch ?? ""}` }] : []),
  });
  await call(repo.dir);
  assert.deepEqual(mergerArgs(), [{
    BRANCHES: "- sandcastle/issue-2\n- sandcastle/issue-1\n- sandcastle/issue-5\n- sandcastle/issue-3",
    ISSUES: "- 2: Issue 2\n- 1: Issue 1\n- 5: Issue 5\n- 3: Issue 3",
  }]);
});

await test("coordinate judges merged and left-over branches in the given checkout, not the process directory", async (t) => {
  const elsewhere = repoOn(t, "feat/elsewhere");
  const repo = repoOn(t, "feat/work");
  issueBranch(repo, "sandcastle/issue-3");
  issueBranch(repo, "sandcastle/issue-4");
  mergeInto(repo, "feat/work", "sandcastle/issue-4");
  const before = process.cwd();
  process.chdir(elsewhere.dir);
  t.after(() => process.chdir(before));
  fake.script({ plans: [{ issues: [planned(3), planned(4)] }] });
  const result = await call(repo.dir);
  assert.ok(result.out.includes("  skipped 4: sandcastle/issue-4 is already merged into the current branch"));
  assert.equal(fake.journal.some((event) => event.branch === "sandcastle/issue-4"), false);
  assert.deepEqual(mergerArgs(), [{ BRANCHES: "- sandcastle/issue-3", ISSUES: "- 3: Issue 3" }]);
});
