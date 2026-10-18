import { aheadIssues, pendingIssues, type PlannedIssue } from "./already-done.ts";
import { branchRefusal } from "./branch-guard.ts";
import { planSchema, type Plan } from "./plan-schema.ts";

// The Sandcastle loop: plan, then per issue implement and review in one sandbox, then merge.
// It repeats up to MAX_ITERATIONS times so issues unblocked by a merge are picked up next round.
// The SDK is passed in (`sandcastle`), so importing this module starts nothing; .sandcastle/main.ts
// passes the real one.

type Commits = { readonly commits: readonly { readonly sha: string }[] };
type Hooks = { readonly sandbox: { readonly onSandboxReady: { readonly command: string }[] } };
type AgentRun<Agent> = {
  name: string; maxIterations: number; agent: Agent; promptFile: string; promptArgs?: Record<string, string>;
};
type HostRun<Agent, Provider> = AgentRun<Agent> & { hooks: Hooks; sandbox: Provider };
type SandboxHandle<Agent> = { run(options: AgentRun<Agent>): Promise<Commits>; close(): Promise<unknown> };

/** The part of @ai-hero/sandcastle (plus its docker provider) the coordinator calls. */
export type Sandcastle<Agent, Provider, PlanOutput> = {
  claudeCode(model: string): Agent;
  docker(): Provider;
  Output: { object(definition: { tag: string; schema: typeof planSchema }): PlanOutput };
  run(options: HostRun<Agent, Provider> & { output: PlanOutput }): Promise<{ readonly output: Plan }>;
  run(options: HostRun<Agent, Provider>): Promise<unknown>;
  createSandbox(options: { branch: string; sandbox: Provider; hooks: Hooks; copyToWorktree: string[] }): Promise<SandboxHandle<Agent>>;
};

export type Coordinator<Agent, Provider, PlanOutput> = {
  cwd: string;
  sandcastle: Sandcastle<Agent, Provider, PlanOutput>;
  log(line: string): void;
  error(line: string): void;
};

// Lower it for a quick smoke-test run, raise it for a large backlog.
const MAX_ITERATIONS = 10;
const MODEL = "claude-opus-4-8";
// Copying node_modules saves a full install; the hook adds platform binaries and new packages.
const HOOKS: Hooks = { sandbox: { onSandboxReady: [{ command: "npm install" }] } };
const COPY_TO_WORKTREE = ["node_modules"];

async function plan<A, P, O>(deps: Coordinator<A, P, O>): Promise<PlannedIssue[]> {
  const { sandcastle } = deps;
  // Output.object rejects a missing tag, malformed JSON or a plan planSchema refuses, which
  // aborts the loop. Structured output requires maxIterations: 1.
  const planned = await sandcastle.run({
    hooks: HOOKS,
    sandbox: sandcastle.docker(),
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/plan-prompt.md",
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });
  // An issue whose branch is already merged into the current branch is not planned again.
  const issues = pendingIssues(planned.output.issues, deps.cwd);
  for (const issue of planned.output.issues) {
    if (!issues.some((pending) => pending.id === issue.id)) {
      deps.log(`  skipped ${issue.id}: ${issue.branch} is already merged into the current branch`);
    }
  }
  return issues;
}

// The implementer and reviewer share one sandbox per branch; the reviewer runs only when the
// implementer committed. Each run returns only its own commits, so both are combined.
async function execute<A, P, O>(deps: Coordinator<A, P, O>, issue: PlannedIssue): Promise<Commits> {
  const { sandcastle } = deps;
  const sandbox = await sandcastle.createSandbox({
    branch: issue.branch, sandbox: sandcastle.docker(), hooks: HOOKS, copyToWorktree: COPY_TO_WORKTREE,
  });
  try {
    const implement = await sandbox.run({
      name: "implementer",
      maxIterations: 100,
      agent: sandcastle.claudeCode(MODEL),
      promptFile: "./.sandcastle/implement-prompt.md",
      promptArgs: { TASK_ID: issue.id, ISSUE_TITLE: issue.title, BRANCH: issue.branch },
    });
    if (implement.commits.length === 0) return implement;
    const review = await sandbox.run({
      name: "reviewer",
      maxIterations: 1,
      agent: sandcastle.claudeCode(MODEL),
      promptFile: "./.sandcastle/review-prompt.md",
      promptArgs: { BRANCH: issue.branch },
    });
    return { ...review, commits: [...implement.commits, ...review.commits] };
  } finally {
    await sandbox.close();
  }
}

// A rejected pipeline is logged and does not cancel the others. A branch that produced commits
// is merged, and so is one that still holds commits HEAD lacks (a reviewer that threw, a merge
// that was aborted) even when the implementer added nothing this round.
function completed<A, P, O>(deps: Coordinator<A, P, O>, issues: readonly PlannedIssue[], settled: readonly PromiseSettledResult<Commits>[]): PlannedIssue[] {
  const outcomes = issues.map((issue, index) => ({ issue, outcome: settled[index] }));
  for (const { issue, outcome } of outcomes) {
    if (outcome?.status === "rejected") deps.error(`  ✗ ${issue.id} (${issue.branch}) failed: ${String(outcome.reason)}`);
  }
  const produced = outcomes
    .filter(({ outcome }) => outcome?.status === "fulfilled" && outcome.value.commits.length > 0)
    .map(({ issue }) => issue);
  const leftOver = aheadIssues(issues, deps.cwd).filter((issue) => !produced.some((done) => done.id === issue.id));
  return [...produced, ...leftOver];
}

async function merge<A, P, O>(deps: Coordinator<A, P, O>, issues: readonly PlannedIssue[]): Promise<void> {
  const { sandcastle } = deps;
  await sandcastle.run({
    hooks: HOOKS,
    sandbox: sandcastle.docker(),
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: issues.map((issue) => `- ${issue.branch}`).join("\n"),
      ISSUES: issues.map((issue) => `- ${issue.id}: ${issue.title}`).join("\n"),
    },
  });
  deps.log("\nBranches merged.");
}

async function round<A, P, O>(deps: Coordinator<A, P, O>): Promise<"stop" | "next"> {
  const issues = await plan(deps);
  if (issues.length === 0) {
    deps.log("No unblocked issues to work on. Exiting.");
    return "stop";
  }
  deps.log(`Planning complete. ${issues.length} issue(s) to work in parallel:`);
  for (const issue of issues) deps.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  const settled = await Promise.allSettled(issues.map((issue) => execute(deps, issue)));
  const merged = completed(deps, issues, settled);
  deps.log(`\nExecution complete. ${merged.length} branch(es) with commits:`);
  for (const issue of merged) deps.log(`  ${issue.branch}`);
  if (merged.length === 0) {
    deps.log("No commits produced. Nothing to merge.");
    return "next";
  }
  await merge(deps, merged);
  return "next";
}

/**
 * Runs the loop in `deps.cwd` and returns the exit status: 1 when the checkout is on main or a
 * detached HEAD (the merger commits into the checked-out branch), otherwise 0. An agent or
 * planner failure outside the per-issue pipelines rejects.
 */
export async function coordinate<A, P, O>(deps: Coordinator<A, P, O>): Promise<number> {
  const refusal = branchRefusal(deps.cwd);
  if (refusal !== undefined) {
    deps.error(refusal);
    return 1;
  }
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    deps.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);
    if (await round(deps) === "stop") break;
  }
  deps.log("\nAll done.");
  return 0;
}
