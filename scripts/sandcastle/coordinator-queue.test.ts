import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK } from "../lib/cli.ts";
import * as fake from "../test-support/coordinator-fake-sdk.ts";
import { commitOn, mergeListed, tip, verdict } from "../test-support/coordinator-repo.ts";
import { createRepo } from "../test-support/repo-fixture.ts";
import { runSandcastle } from "./coordinator.ts";
import { exitCode, type IssueOutcome, type RunResult } from "./run-result.ts";

// How the coordinator treats the planner's queue: empty, wholly blocked, partly blocked or
// contradictory. The fake planner returns raw plans, so these tests check what the coordinator
// does with declared dependency metadata. Whether a real model reads issue text correctly when it
// declares an issue blocked is not tested here and cannot be by a fake planner.

type Lines = { out: string[]; err: string[] };

async function runOn(t: TestContext, scenario: fake.Scenario, failReviewOnce: readonly string[] = [], merges = true): Promise<{ result: RunResult; repo: ReturnType<typeof createRepo> } & Lines> {
  const repo = createRepo("coordinator-queue-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  repo.git(["switch", "--quiet", "-c", "feat/work"]);
  fake.script(typeof scenario.agent === "function" ? scenario : { ...scenario, agent: honest(repo, failReviewOnce, merges) });
  const out: string[] = [];
  const err: string[] = [];
  const result = await runSandcastle({ cwd: repo.dir, sandcastle: fake, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { result, repo, out, err };
}

// The implementer commits, the reviewer passes the tip (failing each branch in `failOnce` the first
// time), the merger merges what it was handed unless `merges` is false.
function honest(repo: ReturnType<typeof createRepo>, failOnce: readonly string[] = [], merges = true): NonNullable<fake.Scenario["agent"]> {
  const failing = new Set(failOnce);
  return (agentCall) => {
    const branch = agentCall.branch ?? "";
    if (agentCall.name === "implementer") return [{ sha: commitOn(repo, branch) }];
    if (agentCall.name === "reviewer") {
      const fails = failing.delete(branch);
      return { stdout: verdict(tip(repo, branch), fails ? "fail" : "pass", "broken") };
    }
    if (merges) mergeListed(repo, agentCall.promptArgs?.BRANCHES);
    return [];
  };
}

const selected = (id: number): { id: string; title: string; branch: string } => ({ id: String(id), title: `Issue ${id}`, branch: `sandcastle/issue-${id}` });
const held = (id: number, ...blockedBy: number[]): { id: string; title: string; blockedBy: string[] } => ({ id: String(id), title: `Issue ${id}`, blockedBy: blockedBy.map(String) });
const workers = (): (string | undefined)[] => fake.journal.filter((event) => event.call === "createSandbox").map((event) => event.branch);
const calls = (): string[] => fake.journal.map((event) => `${event.call}:${event.name ?? event.branch ?? ""}`);
const outcomes = (result: RunResult): Record<string, IssueOutcome> =>
  Object.fromEntries(result.issues.map(({ issue, outcome }) => [issue.id, outcome]));

await test("an empty queue starts no worker and completes with exit 0, distinct from a failed run", async (t) => {
  const { result, out, err } = await runOn(t, { plans: [{ issues: [], blocked: [] }] });
  assert.deepEqual(calls(), ["run:planner"]);
  assert.deepEqual(result, { status: "complete", reason: undefined, issues: [] });
  assert.equal(exitCode(result), EXIT_OK);
  assert.deepEqual(err, []);
  assert.ok(out.includes("No unblocked issues to work on. Exiting."));
});

await test("a wholly blocked queue starts no worker and reports each blocked issue without claiming completion", async (t) => {
  const { result, out, err } = await runOn(t, { plans: [{ issues: [], blocked: [held(2, 1), held(3, 1, 2)] }] });
  assert.deepEqual(calls(), ["run:planner"]);
  assert.equal(result.status, "blocked");
  assert.deepEqual(outcomes(result), { 2: { kind: "blocked", blockedBy: ["1"] }, 3: { kind: "blocked", blockedBy: ["1", "2"] } });
  assert.equal(exitCode(result), EXIT_ERROR);
  assert.equal(out.includes("\nAll done."), false);
  assert.ok(out.includes("No unblocked issues to work on: 2 blocked. Exiting."), out.join("\n"));
  assert.ok(err.includes("  3 (sandcastle/issue-3): blocked by issue 1, issue 2"), err.join("\n"));
  assert.ok(err.some((line) => /Run blocked/.test(line)));
});

await test("declared blocked issues are never scheduled while eligible ones in the same plan run and merge", async (t) => {
  const { result, repo } = await runOn(t, { plans: [{ issues: [selected(1)], blocked: [held(2, 1)] }, { issues: [], blocked: [held(2, 1)] }] });
  assert.deepEqual(workers(), ["sandcastle/issue-1"]);
  assert.deepEqual(outcomes(result), { 1: { kind: "integrated", sha: tip(repo, "sandcastle/issue-1") }, 2: { kind: "blocked", blockedBy: ["1"] } });
  assert.equal(result.status, "blocked");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("an issue unblocked by a merge runs in the next round and the run completes", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [selected(1)], blocked: [held(2, 1)] }, { issues: [selected(2)], blocked: [] }, { issues: [], blocked: [] }] });
  assert.deepEqual(workers(), ["sandcastle/issue-1", "sandcastle/issue-2"]);
  assert.deepEqual(Object.values(outcomes(result)).map((outcome) => outcome.kind), ["integrated", "integrated"]);
  assert.equal(result.status, "complete");
});

for (const [name, plan] of [
  ["an issue both selected and declared blocked", { issues: [selected(1), selected(2)], blocked: [held(2, 1)] }],
  ["a selected issue that declares blockers", { issues: [{ ...selected(1), blockedBy: ["3"] }], blocked: [] }],
  ["a plan that does not say which issues are blocked", { issues: [selected(1)] }],
  ["an issue blocked by itself", { issues: [], blocked: [held(2, 2)] }],
  ["the same issue selected twice", { issues: [selected(1), selected(1)], blocked: [] }],
  ["an unsafe branch", { issues: [{ id: "1", title: "t", branch: "sandcastle/issue-1/../main" }], blocked: [] }],
  ["an invalid id", { issues: [{ id: "1; rm", title: "t", branch: "sandcastle/issue-1" }], blocked: [] }],
] as const) {
  await test(`${name} is refused before any worker starts; the run fails with exit 2`, async (t) => {
    const { result } = await runOn(t, { plans: [plan] });
    assert.deepEqual(calls(), ["run:planner"]);
    assert.equal(result.status, "failed");
    assert.match(result.reason ?? "", /planner failed: .*fake StructuredOutputError/);
    assert.equal(exitCode(result), EXIT_ERROR);
  });
}

// The limit of mechanical validation: an issue the plan selects runs even when its title says it
// is blocked, because only the declared blockedBy metadata is checked.
await test("a selected issue whose text mentions a blocker still runs; only declared metadata blocks", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [{ id: "4", title: "Blocked by #3", branch: "sandcastle/issue-4" }], blocked: [] }, { issues: [], blocked: [] }] });
  assert.deepEqual(workers(), ["sandcastle/issue-4"]);
  assert.equal(result.status, "complete");
});

// A blocked outcome is the planner's view in the round that declared it, not work left behind:
// a later plan that no longer lists the issue (closed, relabelled) clears it. A failed or held
// outcome stays, because its branch may hold unreviewed or unmerged work.
await test("a blocked issue that a later plan no longer lists is cleared and the run completes", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [selected(1)], blocked: [held(2, 1)] }, { issues: [], blocked: [] }] });
  assert.deepEqual(Object.keys(outcomes(result)), ["1"]);
  assert.equal(result.status, "complete");
  assert.equal(exitCode(result), EXIT_OK);
});

await test("a failed issue that a later plan no longer lists still leaves the run incomplete", async (t) => {
  const { result } = await runOn(t, {
    plans: [{ issues: [selected(1)], blocked: [] }, { issues: [], blocked: [] }],
    sandbox: () => { throw new Error("docker refused"); },
  });
  assert.equal(outcomes(result)["1"]?.kind, "failed");
  assert.equal(result.status, "incomplete");
});

await test("a planner failure after a blocked round keeps the blocked issues in the failed run's report", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [selected(1)], blocked: [held(2, 1)] }, { issues: "broken" }] });
  assert.equal(result.status, "failed");
  assert.deepEqual(outcomes(result)["2"], { kind: "blocked", blockedBy: ["1"] });
});

// A blocked declaration replaces nothing but an earlier blocked result: an issue held, failed or
// left unmerged keeps that outcome, so the partial-failure policy still reports it.
await test("a held issue later declared blocked stays held after a plan omits it; the run is incomplete", async (t) => {
  const { result, repo } = await runOn(t, {
    plans: [{ issues: [selected(2)], blocked: [] }, { issues: [selected(3)], blocked: [held(2, 5)] }, { issues: [], blocked: [] }],
  }, ["sandcastle/issue-2"]);
  assert.equal(outcomes(result)["2"]?.kind, "held");
  assert.deepEqual(outcomes(result)["3"], { kind: "integrated", sha: tip(repo, "sandcastle/issue-3") });
  assert.equal(result.status, "incomplete");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a held issue declared blocked in a plan that drains is reported incomplete, not blocked", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [selected(2)], blocked: [] }, { issues: [], blocked: [held(2, 5)] }] }, ["sandcastle/issue-2"]);
  assert.equal(outcomes(result)["2"]?.kind, "held");
  assert.equal(result.status, "incomplete");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a failed issue declared blocked in a plan that drains stays failed; the run is incomplete, exit 2", async (t) => {
  const { result } = await runOn(t, {
    plans: [{ issues: [selected(2)], blocked: [] }, { issues: [], blocked: [held(2, 5)] }],
    sandbox: (branch) => { if (branch === "sandcastle/issue-2") throw new Error("docker refused"); },
  });
  assert.equal(outcomes(result)["2"]?.kind, "failed");
  assert.equal(result.status, "incomplete");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a not-integrated issue declared blocked in a plan that drains stays not integrated; the run is incomplete", async (t) => {
  const { result } = await runOn(t, { plans: [{ issues: [selected(2)], blocked: [] }, { issues: [], blocked: [held(2, 5)] }] }, [], false);
  assert.equal(outcomes(result)["2"]?.kind, "not-integrated");
  assert.equal(result.status, "incomplete");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("an integrated issue a later plan declares blocked stays integrated; the run completes, exit 0", async (t) => {
  const { result, repo } = await runOn(t, { plans: [{ issues: [selected(1)], blocked: [] }, { issues: [], blocked: [held(1, 5)] }] });
  assert.deepEqual(outcomes(result)["1"], { kind: "integrated", sha: tip(repo, "sandcastle/issue-1") });
  assert.equal(result.status, "complete");
  assert.equal(exitCode(result), EXIT_OK);
});
