import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { issueBranch, mergeInto } from "../test-support/afk-harness.ts";
import { journal, script, type AgentCall, type Event, type Scenario } from "../test-support/coordinator-fake-sdk.ts";
import { FAKE_SDK, redirectSandcastle } from "../test-support/coordinator-hooks.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { planSchema } from "./plan-schema.ts";

// Runs the real entry point, .sandcastle/main.ts, in this process with the Sandcastle SDK
// resolved to a fake, so the actual plan, execute, review and merge sequencing is observed
// against disposable Git fixtures without a model, a container or the network.
const redirect = redirectSandcastle();
const MAIN = new URL("../../.sandcastle/main.ts", import.meta.url).href;
const COORDINATOR = new URL("./coordinator.ts", import.meta.url).href;
const EXIT = new Error("process.exit");

const HOOKS = { sandbox: { onSandboxReady: [{ command: "npm install" }] } };
const AGENT = { model: "claude-opus-4-8" };
const SANDBOX = { provider: "docker" };
const PLANNER = { hooks: HOOKS, sandbox: SANDBOX, name: "planner", maxIterations: 1, agent: AGENT, promptFile: "./.sandcastle/plan-prompt.md", output: { tag: "plan", schema: planSchema } };

type Outcome = { status: number; out: string[]; err: string[]; error: unknown };
let runs = 0;

function repoOn(t: TestContext, branch = "feat/work"): RepoFixture {
  const repo = createRepo("coordinator-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  if (branch !== "main") repo.git(["switch", "--quiet", "-c", branch]);
  return repo;
}

async function runEntry(t: TestContext, repo: RepoFixture, scenario: Scenario): Promise<Outcome> {
  script(scenario);
  const out: string[] = [];
  const err: string[] = [];
  let exited: number | undefined;
  t.mock.method(console, "log", (line: string) => out.push(line));
  t.mock.method(console, "error", (line: string) => err.push(line));
  t.mock.method(process, "exit", (code?: number) => { exited = code; throw EXIT; });
  const before = process.cwd();
  process.chdir(repo.dir);
  let error: unknown;
  try {
    await import(`${MAIN}?run=${++runs}`);
  } catch (caught) {
    if (caught !== EXIT) error = caught;
  } finally {
    process.chdir(before);
    t.mock.restoreAll();
  }
  const status = exited ?? Number(process.exitCode ?? 0);
  process.exitCode = 0;
  return { status, out, err, error };
}

const issue = (id: number, title: string): { id: string; title: string; branch: string } => ({ id: String(id), title, branch: `sandcastle/issue-${id}` });
const commitsFor = (table: Record<string, string[]>) => (call: AgentCall): { sha: string }[] =>
  (table[`${call.name} ${call.branch ?? ""}`.trim()] ?? []).map((sha) => ({ sha }));
const calls = (events: readonly Event[]): string[] => events.map((event) => [event.call, event.name, event.branch].filter((part) => part !== undefined).join(" "));
const forBranch = (events: readonly Event[], branch: string): string[] => calls(events.filter((event) => event.branch === branch));
const optionsOf = (call: string): unknown[] => journal.filter((event) => calls([event])[0] === call).map((event) => event.options);
const promptArgsOf = (call: string): unknown[] => optionsOf(call).map((options) =>
  (typeof options === "object" && options !== null && "promptArgs" in options ? options.promptArgs : undefined));

await test("the resolver hands the entry point the fake SDK", () => {
  assert.equal(import.meta.resolve("@ai-hero/sandcastle"), FAKE_SDK);
  assert.equal(import.meta.resolve("@ai-hero/sandcastle/sandboxes/docker"), FAKE_SDK);
});

await test("importing the coordinator loads no Sandcastle runtime and starts nothing", async (t) => {
  script();
  const out: string[] = [];
  t.mock.method(console, "log", (line: string) => out.push(line));
  t.mock.method(console, "error", (line: string) => out.push(line));
  // The first load of the module, before any entry-point run imports it, so every specifier it
  // resolves is recorded; a second instance under a query string would split its coverage.
  redirect.resolved.length = 0;
  await import(COORDINATOR);
  assert.ok(redirect.resolved.includes("./already-done.ts"), "the coordinator was loaded fresh by this test");
  assert.deepEqual(redirect.resolved.filter((specifier) => specifier.startsWith("@ai-hero/")), []);
  assert.deepEqual(journal, []);
  assert.deepEqual(out, []);
});

await test("on main the entry point refuses before any agent runs", async (t) => {
  const result = await runEntry(t, repoOn(t, "main"), { plans: [{ issues: [issue(1, "One")] }] });
  assert.equal(result.status, 1);
  assert.deepEqual(result.err, ["Sandcastle merges into the checked-out branch: run it on a feature branch, not main or a detached HEAD."]);
  assert.deepEqual(journal, []);
});

await test("an empty plan ends the run after one planner call", async (t) => {
  const result = await runEntry(t, repoOn(t), { plans: [{ issues: [] }] });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.deepEqual(calls(journal), ["run planner"]);
  assert.deepEqual(optionsOf("run planner"), [PLANNER]);
  assert.deepEqual(result.out, ["\n=== Iteration 1/10 ===\n", "No unblocked issues to work on. Exiting.", "\nAll done."]);
});

await test("a round plans, implements, reviews only work with commits, then merges", async (t) => {
  const result = await runEntry(t, repoOn(t), {
    plans: [{ issues: [issue(1, "First"), issue(2, "Second")] }, { issues: [] }],
    agent: commitsFor({ "implementer sandcastle/issue-1": ["a1"], "reviewer sandcastle/issue-1": ["r1"] }),
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.deepEqual(forBranch(journal, "sandcastle/issue-1"), ["createSandbox sandcastle/issue-1", "sandbox.run implementer sandcastle/issue-1", "sandbox.run reviewer sandcastle/issue-1", "close sandcastle/issue-1"]);
  assert.deepEqual(forBranch(journal, "sandcastle/issue-2"), ["createSandbox sandcastle/issue-2", "sandbox.run implementer sandcastle/issue-2", "close sandcastle/issue-2"]);
  const order = calls(journal);
  assert.equal(order[0], "run planner");
  assert.equal(order.indexOf("run merger"), order.length - 2, "the merger runs after every sandbox closed");
  assert.equal(order.at(-1), "run planner");
  assert.deepEqual(optionsOf("createSandbox sandcastle/issue-1"), [{ branch: "sandcastle/issue-1", sandbox: SANDBOX, hooks: HOOKS, copyToWorktree: ["node_modules"] }]);
  assert.deepEqual(optionsOf("sandbox.run implementer sandcastle/issue-1"), [{ name: "implementer", maxIterations: 100, agent: AGENT, promptFile: "./.sandcastle/implement-prompt.md", promptArgs: { TASK_ID: "1", ISSUE_TITLE: "First", BRANCH: "sandcastle/issue-1" } }]);
  assert.deepEqual(optionsOf("sandbox.run reviewer sandcastle/issue-1"), [{ name: "reviewer", maxIterations: 1, agent: AGENT, promptFile: "./.sandcastle/review-prompt.md", promptArgs: { BRANCH: "sandcastle/issue-1" } }]);
  assert.deepEqual(optionsOf("run merger"), [{ hooks: HOOKS, sandbox: SANDBOX, name: "merger", maxIterations: 1, agent: AGENT, promptFile: "./.sandcastle/merge-prompt.md", promptArgs: { BRANCHES: "- sandcastle/issue-1", ISSUES: "- 1: First" } }]);
  assert.deepEqual(result.out, [
    "\n=== Iteration 1/10 ===\n", "Planning complete. 2 issue(s) to work in parallel:", "  1: First → sandcastle/issue-1", "  2: Second → sandcastle/issue-2",
    "\nExecution complete. 1 branch(es) with commits:", "  sandcastle/issue-1", "\nBranches merged.",
    "\n=== Iteration 2/10 ===\n", "No unblocked issues to work on. Exiting.", "\nAll done.",
  ]);
});

await test("a failed implementer is reported, its sandbox closed, and the other branch merged", async (t) => {
  const result = await runEntry(t, repoOn(t), {
    plans: [{ issues: [issue(1, "First"), issue(2, "Second")] }],
    agent: (call) => {
      if (call.branch === "sandcastle/issue-1") throw new Error("boom");
      return call.name === "implementer" ? [{ sha: "b1" }] : [];
    },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.err, ["  ✗ 1 (sandcastle/issue-1) failed: Error: boom"]);
  assert.deepEqual(forBranch(journal, "sandcastle/issue-1"), ["createSandbox sandcastle/issue-1", "sandbox.run implementer sandcastle/issue-1", "close sandcastle/issue-1"]);
  assert.deepEqual(promptArgsOf("run merger"), [{ BRANCHES: "- sandcastle/issue-2", ISSUES: "- 2: Second" }]);
});

await test("a failed reviewer closes its sandbox and, with nothing else produced, the round merges nothing", async (t) => {
  const result = await runEntry(t, repoOn(t), {
    plans: [{ issues: [issue(5, "Fifth")] }],
    agent: (call) => {
      if (call.name === "reviewer") throw new Error("review crashed");
      return [{ sha: "c5" }];
    },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.err, ["  ✗ 5 (sandcastle/issue-5) failed: Error: review crashed"]);
  assert.deepEqual(calls(journal), ["run planner", "createSandbox sandcastle/issue-5", "sandbox.run implementer sandcastle/issue-5", "sandbox.run reviewer sandcastle/issue-5", "close sandcastle/issue-5", "run planner"]);
  assert.ok(result.out.includes("No commits produced. Nothing to merge."));
});

await test("a branch left ahead by an earlier round is merged although the implementer adds nothing", async (t) => {
  const repo = repoOn(t);
  issueBranch(repo, "sandcastle/issue-3");
  const result = await runEntry(t, repo, { plans: [{ issues: [issue(3, "Third")] }] });
  assert.equal(result.error, undefined);
  assert.deepEqual(forBranch(journal, "sandcastle/issue-3"), ["createSandbox sandcastle/issue-3", "sandbox.run implementer sandcastle/issue-3", "close sandcastle/issue-3"]);
  assert.deepEqual(promptArgsOf("run merger"), [{ BRANCHES: "- sandcastle/issue-3", ISSUES: "- 3: Third" }]);
});

await test("an issue whose work is already merged is skipped and not executed", async (t) => {
  const repo = repoOn(t);
  issueBranch(repo, "sandcastle/issue-4");
  mergeInto(repo, "feat/work", "sandcastle/issue-4");
  const result = await runEntry(t, repo, { plans: [{ issues: [issue(4, "Fourth")] }] });
  assert.deepEqual(calls(journal), ["run planner"]);
  assert.deepEqual(result.out, ["\n=== Iteration 1/10 ===\n", "  skipped 4: sandcastle/issue-4 is already merged into the current branch", "No unblocked issues to work on. Exiting.", "\nAll done."]);
});

await test("rounds that produce nothing stop after ten iterations", async (t) => {
  const plans = Array.from({ length: 11 }, () => ({ issues: [issue(6, "Sixth")] }));
  const result = await runEntry(t, repoOn(t), { plans });
  assert.equal(result.error, undefined);
  assert.equal(calls(journal).filter((call) => call === "run planner").length, 10);
  assert.equal(result.out.filter((line) => line === "No commits produced. Nothing to merge.").length, 10);
  assert.deepEqual(result.out.slice(-2), ["No commits produced. Nothing to merge.", "\nAll done."]);
  assert.equal(calls(journal).includes("run merger"), false);
});

await test("an invalid plan aborts the run before any sandbox", async (t) => {
  const result = await runEntry(t, repoOn(t), { plans: [{ issues: [{ id: "x", title: "Bad", branch: "sandcastle/issue-x" }] }] });
  assert.match(String(result.error), /fake StructuredOutputError: id must be an issue number/);
  assert.deepEqual(calls(journal), ["run planner"]);
  assert.equal(result.out.includes("\nAll done."), false);
});

await test("a failed merger aborts the run before another round", async (t) => {
  const result = await runEntry(t, repoOn(t), {
    plans: [{ issues: [issue(7, "Seventh")] }, { issues: [] }],
    agent: (call) => {
      if (call.name === "merger") throw new Error("merge failed");
      return call.name === "implementer" ? [{ sha: "c7" }] : [];
    },
  });
  assert.match(String(result.error), /merge failed/);
  assert.deepEqual(calls(journal).slice(-1), ["run merger"]);
  assert.equal(result.out.includes("\nBranches merged."), false);
});
