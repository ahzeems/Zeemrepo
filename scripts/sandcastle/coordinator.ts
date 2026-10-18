import { isAncestor, tryGit } from "../lib/git.ts";
import { pendingIssues, type PlannedIssue } from "./already-done.ts";
import { branchRefusal } from "./branch-guard.ts";
import { planSchema, type Plan } from "./plan-schema.ts";
import { describeOutcome, exitCode, finish, judgeReview, latest, outstanding, type IssueOutcome, type IssueResult, type Phase, type RunResult, type Stop } from "./run-result.ts";

// The Sandcastle loop: plan, then per issue implement and review in one sandbox, then merge the
// issues whose review passed for their exact candidate commit. It repeats up to MAX_ITERATIONS
// times so issues unblocked by a merge are picked up next round. Each issue's outcome and the
// run's status come from run-result.ts.
// The SDK is passed in (`sandcastle`), so importing this module starts nothing; .sandcastle/main.ts
// passes the real one.

type AgentResult = { readonly commits: readonly { readonly sha: string }[]; readonly stdout: string };
type Hooks = { readonly sandbox: { readonly onSandboxReady: { readonly command: string }[] } };
type AgentRun<Agent> = {
  name: string; maxIterations: number; agent: Agent; promptFile: string; promptArgs?: Record<string, string>;
};
type HostRun<Agent, Provider> = AgentRun<Agent> & { hooks: Hooks; sandbox: Provider };
type SandboxHandle<Agent> = { run(options: AgentRun<Agent>): Promise<AgentResult>; close(): Promise<unknown> };

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

const tipOf = (branch: string, cwd: string): string | undefined =>
  tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`], { cwd }) ?? undefined;

async function plan<A, P, O>(deps: Coordinator<A, P, O>): Promise<{ pending: PlannedIssue[]; merged: IssueResult[] }> {
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
  const pending = pendingIssues(planned.output.issues, deps.cwd);
  const merged = planned.output.issues.filter((issue) => !pending.some((open) => open.id === issue.id));
  for (const issue of merged) deps.log(`  skipped ${issue.id}: ${issue.branch} is already merged into the current branch`);
  return { pending, merged: merged.map((issue) => ({ issue, outcome: { kind: "integrated", sha: tipOf(issue.branch, deps.cwd) ?? "" } })) };
}

async function attempt<T>(phase: Phase, step: () => Promise<T>): Promise<{ value: T } | { failed: IssueOutcome }> {
  try {
    return { value: await step() };
  } catch (error) {
    return { failed: { kind: "failed", phase, reason: String(error) } };
  }
}

// The implementer and reviewer share one sandbox per branch. The candidate is the branch tip the
// implementer leaves, including work an earlier round left unmerged; a branch with nothing HEAD
// lacks is not reviewed. The reviewer is read-only: a review that moves the tip certifies nothing.
async function execute<A, P, O>(deps: Coordinator<A, P, O>, issue: PlannedIssue): Promise<IssueOutcome> {
  const { sandcastle } = deps;
  const created = await attempt("sandbox", () => sandcastle.createSandbox({
    branch: issue.branch, sandbox: sandcastle.docker(), hooks: HOOKS, copyToWorktree: COPY_TO_WORKTREE,
  }));
  if ("failed" in created) return created.failed;
  const sandbox = created.value;
  try {
    return await implementAndReview(deps, issue, sandbox);
  } finally {
    await sandbox.close();
  }
}

async function implementAndReview<A, P, O>(deps: Coordinator<A, P, O>, issue: PlannedIssue, sandbox: SandboxHandle<A>): Promise<IssueOutcome> {
  const { sandcastle, cwd } = deps;
  const implemented = await attempt("implementer", () => sandbox.run({
    name: "implementer",
    maxIterations: 100,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/implement-prompt.md",
    promptArgs: { TASK_ID: issue.id, ISSUE_TITLE: issue.title, BRANCH: issue.branch },
  }));
  if ("failed" in implemented) return implemented.failed;
  const candidate = tipOf(issue.branch, cwd);
  if (candidate === undefined || isAncestor(candidate, "HEAD", { cwd })) return { kind: "no-work" };
  const reviewed = await attempt("reviewer", () => sandbox.run({
    name: "reviewer",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/review-prompt.md",
    promptArgs: { BRANCH: issue.branch, CANDIDATE: candidate },
  }));
  if ("failed" in reviewed) return reviewed.failed;
  return judgeReview(candidate, { stdout: reviewed.value.stdout, commits: reviewed.value.commits.length, tipAfter: tipOf(issue.branch, cwd) });
}

function settle(settled: PromiseSettledResult<IssueOutcome> | undefined): IssueOutcome {
  if (settled?.status === "fulfilled") return settled.value;
  return { kind: "failed", phase: "sandbox", reason: String(settled?.reason) };
}

const line = (outcome: IssueOutcome): string => (outcome.kind === "failed" ? `failed: ${outcome.reason}` : describeOutcome(outcome));

// A reviewed issue is integrated only when HEAD holds its reviewed commit and its branch still
// points there: a branch that moved after review would have brought unreviewed commits with it.
function integration(cwd: string, eligible: readonly IssueResult[]): IssueResult[] {
  return eligible.map(({ issue, outcome }) => {
    const sha = "sha" in outcome ? outcome.sha : "";
    const notIntegrated = (reason: string): IssueResult => ({ issue, outcome: { kind: "not-integrated", sha, reason } });
    if (tipOf(issue.branch, cwd) !== sha) return notIntegrated("the branch moved after its review, so its tip is unreviewed");
    if (!isAncestor(sha, "HEAD", { cwd })) return notIntegrated("the merger did not merge the reviewed commit");
    return { issue, outcome: { kind: "integrated", sha } };
  });
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
  deps.log("\nMerger finished.");
}

type Round = { results: IssueResult[]; stop?: Stop };

async function executeAll<A, P, O>(deps: Coordinator<A, P, O>, issues: readonly PlannedIssue[]): Promise<IssueResult[]> {
  const settled = await Promise.allSettled(issues.map((issue) => execute(deps, issue)));
  const results = issues.map((issue, index) => ({ issue, outcome: settle(settled[index]) }));
  for (const { issue, outcome } of outstanding(results)) {
    if (outcome.kind !== "eligible") deps.error(`  ✗ ${issue.id} (${issue.branch}) ${line(outcome)}`);
  }
  return results;
}

async function planned<A, P, O>(deps: Coordinator<A, P, O>): Promise<Awaited<ReturnType<typeof plan>> | Round> {
  try {
    return await plan(deps);
  } catch (error) {
    return { results: [], stop: { kind: "failed", reason: `the planner failed: ${String(error)}` } };
  }
}

async function round<A, P, O>(deps: Coordinator<A, P, O>): Promise<Round> {
  const queue = await planned(deps);
  if ("results" in queue) return queue;
  const { pending, merged } = queue;
  if (pending.length === 0) {
    deps.log("No unblocked issues to work on. Exiting.");
    return { results: merged, stop: { kind: "drained" } };
  }
  deps.log(`Planning complete. ${pending.length} issue(s) to work in parallel:`);
  for (const issue of pending) deps.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  const executed = await executeAll(deps, pending);
  const eligible = executed.filter(({ outcome }) => outcome.kind === "eligible");
  deps.log(`\nExecution complete. ${eligible.length} reviewed branch(es) to merge:`);
  for (const { issue } of eligible) deps.log(`  ${issue.branch}`);
  if (eligible.length === 0) {
    deps.log("No reviewed work to merge.");
    return { results: [...merged, ...executed] };
  }
  let stop: Stop | undefined;
  try {
    await merge(deps, eligible.map(({ issue }) => issue));
  } catch (error) {
    stop = { kind: "failed", reason: `the merger failed: ${String(error)}` };
  }
  const integrated = integration(deps.cwd, eligible);
  for (const { issue, outcome } of outstanding(integrated)) deps.error(`  ✗ ${issue.id} (${issue.branch}) ${line(outcome)}`);
  return { results: latest([...merged, ...executed], integrated), ...(stop === undefined ? {} : { stop }) };
}

async function rounds<A, P, O>(deps: Coordinator<A, P, O>): Promise<RunResult> {
  let issues: IssueResult[] = [];
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    deps.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);
    let done: Round;
    try {
      done = await round(deps);
    } catch (error) {
      return finish(issues, { kind: "failed", reason: `round ${String(iteration)} failed: ${String(error)}` });
    }
    issues = latest(issues, done.results);
    if (done.stop !== undefined) return finish(issues, done.stop);
  }
  return finish(issues, { kind: "exhausted", rounds: MAX_ITERATIONS });
}

function report<A, P, O>(deps: Coordinator<A, P, O>, result: RunResult): void {
  if (result.status === "complete") {
    deps.log("\nAll done.");
    return;
  }
  deps.error(`\nRun ${result.status}: ${result.reason ?? ""}.`);
  for (const { issue, outcome } of outstanding(result.issues)) deps.error(`  ${issue.id} (${issue.branch}): ${describeOutcome(outcome)}`);
}

/**
 * Runs the loop in `deps.cwd` and returns what it established. Refused when the checkout is on
 * main or a detached HEAD (the merger commits into the checked-out branch). An agent, planner or
 * merger failure is recorded in the result, never thrown.
 */
export async function runSandcastle<A, P, O>(deps: Coordinator<A, P, O>): Promise<RunResult> {
  const refusal = branchRefusal(deps.cwd);
  if (refusal !== undefined) {
    deps.error(refusal);
    return { status: "refused", reason: refusal, issues: [] };
  }
  const result = await rounds(deps);
  report(deps, result);
  return result;
}

/** The loop's exit status: 0 complete, 1 refused before any agent ran, 2 incomplete or failed. */
export async function coordinate<A, P, O>(deps: Coordinator<A, P, O>): Promise<number> {
  return exitCode(await runSandcastle(deps));
}
