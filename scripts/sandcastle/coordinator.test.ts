import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED } from "../lib/cli.ts";
import { issueBranch, mergeInto } from "../test-support/afk-harness.ts";
import * as fake from "../test-support/coordinator-fake-sdk.ts";
import { commitOn, mergeListed, tip, verdict } from "../test-support/coordinator-repo.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { coordinate, runSandcastle } from "./coordinator.ts";
import { exitCode, type IssueOutcome, type RunResult } from "./run-result.ts";

// The coordinator called directly, with the fake SDK as its boundary and a real Git fixture: the
// fake agents commit, review and merge there. The entry-point tests (coordinator-entry.test.ts)
// characterize the whole sequence through .sandcastle/main.ts.

function repoOn(t: TestContext, branch: string): RepoFixture {
  const repo = createRepo("coordinator-direct-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  if (branch !== "main") repo.git(["switch", "--quiet", "-c", branch]);
  return repo;
}

type Lines = { out: string[]; err: string[] };
const sink = (): Lines & { log(line: string): void; error(line: string): void } => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (line) => out.push(line), error: (line) => err.push(line) };
};

async function call(cwd: string): Promise<{ code: number } & Lines> {
  const lines = sink();
  const code = await coordinate({ cwd, sandcastle: fake, ...lines });
  return { code, out: lines.out, err: lines.err };
}

async function runIn(cwd: string): Promise<{ result: RunResult } & Lines> {
  const lines = sink();
  const result = await runSandcastle({ cwd, sandcastle: fake, ...lines });
  return { result, out: lines.out, err: lines.err };
}

type Reply = readonly { sha: string }[] | { commits?: { sha: string }[]; stdout?: string };
type Role = (call: fake.AgentCall) => Reply | Promise<Reply>;
const planned = (id: number): { id: string; title: string; branch: string } => ({ id: String(id), title: `Issue ${id}`, branch: `sandcastle/issue-${id}` });
const branchOf = (agentCall: fake.AgentCall): string => agentCall.branch ?? "";

// Honest agents by default: the implementer commits on its branch, the reviewer passes the tip it
// was handed, the merger merges what it was handed. A test overrides one role to break it.
function crew(repo: RepoFixture, roles: { implementer?: Role; reviewer?: Role; merger?: Role } = {}): (agentCall: fake.AgentCall) => Reply | Promise<Reply> {
  const implementer: Role = roles.implementer ?? ((agentCall) => [{ sha: commitOn(repo, branchOf(agentCall)) }]);
  const reviewer: Role = roles.reviewer ?? ((agentCall) => ({ stdout: verdict(tip(repo, branchOf(agentCall))) }));
  const merger: Role = roles.merger ?? ((agentCall) => { mergeListed(repo, agentCall.promptArgs?.BRANCHES); return []; });
  const byName: Record<string, Role> = { implementer, reviewer, merger };
  return (agentCall) => {
    const role = byName[agentCall.name];
    if (role === undefined) throw new Error(`no fake for ${agentCall.name}`);
    return role(agentCall);
  };
}

const outcomes = (result: RunResult): Record<string, IssueOutcome["kind"]> =>
  Object.fromEntries(result.issues.map(({ issue, outcome }) => [issue.id, outcome.kind]));
const named = (name: string): fake.Event[] => fake.journal.filter((event) => event.name === name);
const mergerArgs = (): unknown[] => named("merger").map((event) =>
  (typeof event.options === "object" && event.options !== null && "promptArgs" in event.options ? event.options.promptArgs : undefined));
const inHead = (repo: RepoFixture, sha: string): boolean => {
  try {
    repo.git(["merge-base", "--is-ancestor", sha, "HEAD"]);
    return true;
  } catch {
    return false;
  }
};

await test("coordinate returns 1 and starts nothing in a checkout on main", async (t) => {
  fake.script({ plans: [{ issues: [planned(1)] }] });
  const result = await call(repoOn(t, "main").dir);
  assert.equal(result.code, EXIT_REFUSED);
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
  assert.equal(result.code, EXIT_OK);
  assert.deepEqual(result.err, []);
  assert.deepEqual(fake.journal.map((event) => event.call), ["run"]);
  assert.deepEqual(result.out.slice(-1), ["\nAll done."]);
});

await test("a candidate reviewed at its own SHA is merged and the run completes with exit 0", async (t) => {
  const repo = repoOn(t, "feat/work");
  const base = repo.git(["rev-parse", "HEAD"]);
  fake.script({ plans: [{ issues: [planned(1)] }, { issues: [] }], agent: crew(repo) });
  const { result, err } = await runIn(repo.dir);
  const sha = tip(repo, "sandcastle/issue-1");
  assert.deepEqual(err, []);
  assert.deepEqual(result, { status: "complete", reason: undefined, issues: [{ issue: planned(1), outcome: { kind: "integrated", sha } }] });
  assert.equal(exitCode(result), EXIT_OK);
  assert.ok(inHead(repo, sha));
  const review = named("reviewer")[0]?.options;
  assert.deepEqual(typeof review === "object" && review !== null && "promptArgs" in review ? review.promptArgs : undefined, { BRANCH: "sandcastle/issue-1", BASE: base, CANDIDATE: sha });
});

await test("every rejected sandbox creation ends incomplete after the round limit, exit 2, never All done", async (t) => {
  const repo = repoOn(t, "feat/work");
  fake.script({
    plans: Array.from({ length: 11 }, () => ({ issues: [planned(1), planned(2)] })),
    sandbox: () => { throw new Error("docker refused"); },
  });
  const { result, out, err } = await runIn(repo.dir);
  assert.equal(result.status, "incomplete");
  assert.match(result.reason ?? "", /10 rounds/);
  assert.deepEqual(result.issues.map(({ outcome }) => outcome), [1, 2].map(() => ({ kind: "failed", phase: "sandbox", reason: "Error: docker refused" })));
  assert.equal(exitCode(result), EXIT_ERROR);
  assert.equal(named("merger").length, 0);
  assert.equal(out.includes("\nAll done."), false);
  assert.ok(err.some((line) => /incomplete/.test(line)));
});

await test("an implementer that throws closes its sandbox, is reported, and fails the run's issue", async (t) => {
  const repo = repoOn(t, "feat/work");
  fake.script({ plans: [{ issues: [planned(2)] }], agent: () => { throw new Error("sandbox crash"); } });
  const { result, err } = await runIn(repo.dir);
  assert.deepEqual(fake.journal.filter((event) => event.branch === "sandcastle/issue-2").map((event) => event.call), ["createSandbox", "sandbox.run", "close"]);
  assert.equal(err[0], "  ✗ 2 (sandcastle/issue-2) failed: Error: sandbox crash");
  assert.deepEqual(result.issues[0]?.outcome, { kind: "failed", phase: "implementer", reason: "Error: sandbox crash" });
  assert.equal(exitCode(result), EXIT_ERROR);
});

for (const [name, reviewer, reason] of [
  ["a missing verdict", (): Reply => [], /no <review> verdict/],
  ["a malformed verdict", (): Reply => ({ stdout: "<review>{not json</review>" }), /not JSON/],
  ["a failed verdict", (agentCall: fake.AgentCall): Reply => ({ stdout: verdict(agentCall.promptArgs?.CANDIDATE ?? "", "fail", "no tests") }), /review failed: no tests/],
  ["a crashed reviewer", (): Reply => { throw new Error("review crashed"); }, /review crashed/],
] as const) {
  await test(`${name} holds the issue out of the merger; the run is incomplete, exit 2`, async (t) => {
    const repo = repoOn(t, "feat/work");
    fake.script({ plans: [{ issues: [planned(5)] }, { issues: [] }], agent: crew(repo, { reviewer }) });
    const { result, err } = await runIn(repo.dir);
    assert.equal(named("merger").length, 0);
    assert.equal(result.status, "incomplete");
    assert.match(result.reason ?? "", /issue 5\b/);
    assert.match(JSON.stringify(result.issues[0]?.outcome), reason);
    assert.ok(err.some((line) => line.startsWith("  ✗ 5 (sandcastle/issue-5)")));
    assert.equal(exitCode(result), EXIT_ERROR);
    assert.equal(inHead(repo, tip(repo, "sandcastle/issue-5")), false);
  });
}

await test("a checkout whose branch lost its commit fails the review phase with a named reason, and no reviewer runs", async (t) => {
  const repo = repoOn(t, "feat/work");
  const implementer: Role = (agentCall) => {
    const sha = commitOn(repo, branchOf(agentCall));
    repo.git(["update-ref", "-d", "refs/heads/feat/work"]);
    return [{ sha }];
  };
  fake.script({ plans: [{ issues: [planned(7)] }], agent: crew(repo, { implementer }) });
  const { result, err } = await runIn(repo.dir);
  assert.deepEqual(result.issues[0]?.outcome, { kind: "failed", phase: "reviewer", reason: "the checked-out branch has no commit to review against" });
  assert.equal(named("reviewer").length, 0);
  assert.equal(named("merger").length, 0);
  assert.ok(err.some((line) => line.startsWith("  ✗ 7 (sandcastle/issue-7) failed:")));
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a branch the implementer leaves at a commit HEAD already holds is no-work and is not reviewed", async (t) => {
  const repo = repoOn(t, "feat/work");
  const implementer: Role = (agentCall) => { repo.git(["branch", branchOf(agentCall), "HEAD"]); return []; };
  fake.script({ plans: [{ issues: [planned(8)] }], agent: crew(repo, { implementer }) });
  const { result } = await runIn(repo.dir);
  assert.deepEqual(result.issues[0]?.outcome, { kind: "no-work" });
  assert.equal(named("reviewer").length, 0);
});

await test("a stale verdict naming another commit holds the issue", async (t) => {
  const repo = repoOn(t, "feat/work");
  const base = repo.git(["rev-parse", "HEAD"]);
  fake.script({ plans: [{ issues: [planned(6)] }], agent: crew(repo, { reviewer: () => ({ stdout: verdict(base) }) }) });
  const { result } = await runIn(repo.dir);
  const sha = tip(repo, "sandcastle/issue-6");
  assert.deepEqual(result.issues[0]?.outcome, { kind: "held", sha, reason: `the verdict names ${base}, not the candidate ${sha}` });
  assert.equal(named("merger").length, 0);
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a reviewer that edits cannot certify its own edit; a fresh review of the new tip can", async (t) => {
  const repo = repoOn(t, "feat/work");
  let reviews = 0;
  const reviewer: Role = (agentCall) => {
    reviews++;
    if (reviews === 1) {
      const edited = commitOn(repo, branchOf(agentCall), "reviewer-fix");
      return { commits: [{ sha: edited }], stdout: verdict(edited) };
    }
    return { stdout: verdict(tip(repo, branchOf(agentCall))) };
  };
  fake.script({ plans: [{ issues: [planned(7)] }, { issues: [planned(7)] }, { issues: [] }], agent: crew(repo, { reviewer, implementer: () => (reviews === 0 ? [{ sha: commitOn(repo, "sandcastle/issue-7") }] : []) }) });
  const { result, err } = await runIn(repo.dir);
  assert.ok(err.some((line) => /7 .*held.*reviewer changed the candidate/.test(line)), err.join("\n"));
  assert.equal(named("merger").length, 1, "nothing merged after the editing review");
  assert.deepEqual(result.issues, [{ issue: planned(7), outcome: { kind: "integrated", sha: tip(repo, "sandcastle/issue-7") } }]);
  assert.equal(result.status, "complete");
});

await test("an independent passing issue stays eligible and merges while a failing one is held and named", async (t) => {
  const repo = repoOn(t, "feat/work");
  const reviewer: Role = (agentCall) => ({ stdout: verdict(tip(repo, branchOf(agentCall)), branchOf(agentCall) === "sandcastle/issue-2" ? "fail" : "pass", "broken") });
  fake.script({ plans: [{ issues: [planned(1), planned(2)] }, { issues: [planned(2)] }], agent: crew(repo, { reviewer }) });
  const { result } = await runIn(repo.dir);
  assert.deepEqual(mergerArgs()[0], { BRANCHES: "- sandcastle/issue-1", ISSUES: "- 1: Issue 1" });
  assert.deepEqual(outcomes(result), { 1: "integrated", 2: "held" });
  assert.ok(inHead(repo, tip(repo, "sandcastle/issue-1")));
  assert.equal(result.status, "incomplete");
  assert.match(result.reason ?? "", /issue 2\b/);
  assert.doesNotMatch(result.reason ?? "", /issue 1\b/);
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a merger that leaves a reviewed branch unmerged makes the issue not integrated", async (t) => {
  const repo = repoOn(t, "feat/work");
  fake.script({ plans: [{ issues: [planned(8)] }], agent: crew(repo, { merger: () => [] }) });
  const { result } = await runIn(repo.dir);
  assert.deepEqual(result.issues[0]?.outcome, { kind: "not-integrated", sha: tip(repo, "sandcastle/issue-8"), reason: "the merger did not merge the reviewed commit" });
  assert.equal(result.status, "incomplete");
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a branch that moved after its review is not integrated, even when merged", async (t) => {
  const repo = repoOn(t, "feat/work");
  const merger: Role = (agentCall) => {
    commitOn(repo, "sandcastle/issue-9", "late");
    mergeListed(repo, agentCall.promptArgs?.BRANCHES);
    return [];
  };
  fake.script({ plans: [{ issues: [planned(9)] }], agent: crew(repo, { merger }) });
  const { result } = await runIn(repo.dir);
  assert.equal(result.issues[0]?.outcome.kind, "not-integrated");
  assert.match(JSON.stringify(result.issues[0]?.outcome), /moved after its review/);
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a merger that throws fails the run with exit 2 before another round, keeping the issue outcomes", async (t) => {
  const repo = repoOn(t, "feat/work");
  fake.script({ plans: [{ issues: [planned(3)] }, { issues: [] }], agent: crew(repo, { merger: () => { throw new Error("merge failed"); } }) });
  const { result, err } = await runIn(repo.dir);
  assert.equal(result.status, "failed");
  assert.match(result.reason ?? "", /merger failed: Error: merge failed/);
  assert.deepEqual(outcomes(result), { 3: "not-integrated" });
  assert.equal(fake.journal.filter((event) => event.name === "planner").length, 1);
  assert.ok(err.some((line) => /merge failed/.test(line)));
  assert.equal(exitCode(result), EXIT_ERROR);
});

await test("a planner failure fails the run with exit 2 instead of rejecting", async (t) => {
  const repo = repoOn(t, "feat/work");
  const bad = { plans: [{ issues: [{ id: "x", title: "Bad", branch: "sandcastle/issue-x" }] }] };
  fake.script(bad);
  const { result } = await runIn(repo.dir);
  assert.equal(result.status, "failed");
  assert.match(result.reason ?? "", /planner failed: .*fake StructuredOutputError/);
  assert.equal(exitCode(result), EXIT_ERROR);
  fake.script(bad);
  assert.equal((await call(repo.dir)).code, EXIT_ERROR);
});

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
    agent: async (agentCall) => {
      if (agentCall.name !== "implementer") return [];
      if (agentCall.branch === "sandcastle/issue-2") markSecondStarted();
      else await within(secondStarted);
      return [];
    },
  });
  const result = await call(repoOn(t, "feat/work").dir);
  assert.deepEqual(result.err, []);
  assert.equal(result.code, EXIT_OK);
});

await test("a branch left ahead by an earlier round is reviewed again and merged in plan order", async (t) => {
  const repo = repoOn(t, "feat/work");
  issueBranch(repo, "sandcastle/issue-3");
  issueBranch(repo, "sandcastle/issue-5");
  const producing = new Set(["sandcastle/issue-1", "sandcastle/issue-2"]);
  fake.script({
    plans: [{ issues: [planned(5), planned(3), planned(2), planned(1)] }],
    agent: crew(repo, { implementer: (agentCall) => (producing.has(branchOf(agentCall)) ? [{ sha: commitOn(repo, branchOf(agentCall)) }] : []) }),
  });
  await runIn(repo.dir);
  assert.equal(named("reviewer").length, 4);
  assert.deepEqual(mergerArgs(), [{
    BRANCHES: "- sandcastle/issue-5\n- sandcastle/issue-3\n- sandcastle/issue-2\n- sandcastle/issue-1",
    ISSUES: "- 5: Issue 5\n- 3: Issue 3\n- 2: Issue 2\n- 1: Issue 1",
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
  fake.script({ plans: [{ issues: [planned(3), planned(4)] }], agent: crew(repo, { implementer: () => [] }) });
  const { result, out } = await runIn(repo.dir);
  assert.ok(out.includes("  skipped 4: sandcastle/issue-4 is already merged into the current branch"));
  assert.equal(fake.journal.some((event) => event.branch === "sandcastle/issue-4"), false);
  assert.deepEqual(mergerArgs(), [{ BRANCHES: "- sandcastle/issue-3", ISSUES: "- 3: Issue 3" }]);
  assert.deepEqual(outcomes(result), { 3: "integrated", 4: "integrated" });
});
