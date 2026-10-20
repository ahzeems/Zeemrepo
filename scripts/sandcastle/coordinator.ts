import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { git, isAncestor, tryGit } from "../lib/git.ts";
import { pendingIssues, type PlannedIssue } from "./already-done.ts";
import { branchRefusal } from "./branch-guard.ts";
import { planSchema, type Plan } from "./plan-schema.ts";
import { reviewInputs } from "./review-input.ts";
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

// The branches this run handed the merger, written in the git directory (outside the tree) when the
// run ends. npm run sandcastle:afk lands only these and refuses when the record is missing.
export const HANDED_RECORD = "sandcastle-handed.json";
export const handedRecordPath = (cwd: string): string => resolve(cwd, git(["rev-parse", "--git-path", HANDED_RECORD], { cwd }));
export function writeHanded(cwd: string, branches: readonly string[]): void {
  writeFileSync(handedRecordPath(cwd), `${JSON.stringify({ handed: branches })}\n`);
}

// Lower it for a quick smoke-test run, raise it for a large backlog.
const MAX_ITERATIONS = 10;
const MODEL = "claude-opus-4-8";
// Copying node_modules saves a full install; the hook adds platform binaries and new packages.
const HOOKS: Hooks = { sandbox: { onSandboxReady: [{ command: "npm install" }] } };
const COPY_TO_WORKTREE = ["node_modules"];

const tipOf = (branch: string, cwd: string): string | undefined =>
  tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`], { cwd }) ?? undefined;

type Queue = { pending: PlannedIssue[]; merged: IssueResult[]; blocked: IssueResult[] };

async function plan<A, P, O>(deps: Coordinator<A, P, O>): Promise<Queue> {
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
  // A declared blocked issue gets no sandbox, branch or agent; it stays pending for a later run.
  const blocked = planned.output.blocked.map(({ id, title, blockedBy }): IssueResult => ({
    issue: { id, title, branch: `sandcastle/issue-${id}` }, outcome: { kind: "blocked", blockedBy },
  }));
  for (const { issue, outcome } of blocked) deps.log(`  blocked ${issue.id}: ${describeOutcome(outcome)}`);
  return { pending, merged: merged.map((issue) => ({ issue, outcome: { kind: "integrated", sha: tipOf(issue.branch, deps.cwd) ?? "" } })), blocked };
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
  if (candidate === undefined) return { kind: "no-work" };
  const inputs = reviewInputs(cwd, issue.branch, candidate);
  if ("refusal" in inputs) return { kind: "failed", phase: "reviewer", reason: inputs.refusal };
  if (isAncestor(candidate, inputs.promptArgs.BASE, { cwd })) return { kind: "no-work" };
  const reviewed = await attempt("reviewer", () => sandbox.run({
    name: "reviewer",
    maxIterations: 1,
    agent: sandcastle.claudeCode(MODEL),
    promptFile: "./.sandcastle/review-prompt.md",
    promptArgs: inputs.promptArgs,
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

// `planned` is false when the planner failed, so the round has no view of the queue. `handed` names
// the branches this round gave the merger.
type Round = { results: IssueResult[]; stop?: Stop; planned: boolean; handed?: string[] };

async function executeAll<A, P, O>(deps: Coordinator<A, P, O>, issues: readonly PlannedIssue[]): Promise<IssueResult[]> {
  const settled = await Promise.allSettled(issues.map((issue) => execute(deps, issue)));
  const results = issues.map((issue, index) => ({ issue, outcome: settle(settled[index]) }));
  for (const { issue, outcome } of outstanding(results)) {
    if (outcome.kind !== "eligible") deps.error(`  ✗ ${issue.id} (${issue.branch}) ${line(outcome)}`);
  }
  return results;
}

async function planned<A, P, O>(deps: Coordinator<A, P, O>): Promise<Queue | Round> {
  try {
    return await plan(deps);
  } catch (error) {
    return { results: [], stop: { kind: "failed", reason: `the planner failed: ${String(error)}` }, planned: false };
  }
}

async function round<A, P, O>(deps: Coordinator<A, P, O>): Promise<Round> {
  const queue = await planned(deps);
  if ("results" in queue) return queue;
  const { pending, blocked } = queue;
  // Issues this round records without starting a worker: already merged, or declared blocked.
  const known = [...queue.merged, ...blocked];
  if (pending.length === 0) {
    deps.log(blocked.length === 0 ? "No unblocked issues to work on. Exiting." : `No unblocked issues to work on: ${String(blocked.length)} blocked. Exiting.`);
    return { results: known, stop: { kind: "drained" }, planned: true };
  }
  deps.log(`Planning complete. ${pending.length} issue(s) to work in parallel:`);
  for (const issue of pending) deps.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  const executed = await executeAll(deps, pending);
  const eligible = executed.filter(({ outcome }) => outcome.kind === "eligible");
  deps.log(`\nExecution complete. ${eligible.length} reviewed branch(es) to merge:`);
  for (const { issue } of eligible) deps.log(`  ${issue.branch}`);
  if (eligible.length === 0) {
    deps.log("No reviewed work to merge.");
    return { results: [...known, ...executed], planned: true };
  }
  let stop: Stop | undefined;
  try {
    await merge(deps, eligible.map(({ issue }) => issue));
  } catch (error) {
    stop = { kind: "failed", reason: `the merger failed: ${String(error)}` };
  }
  const integrated = integration(deps.cwd, eligible);
  for (const { issue, outcome } of outstanding(integrated)) deps.error(`  ✗ ${issue.id} (${issue.branch}) ${line(outcome)}`);
  const handed = eligible.map(({ issue }) => issue.branch);
  return { results: latest([...known, ...executed], integrated), planned: true, handed, ...(stop === undefined ? {} : { stop }) };
}

// A blocked outcome is only the latest plan's view: a plan that no longer lists the issue clears
// it, and it replaces nothing but an earlier blocked outcome. An issue already worked keeps its
// outcome (failed, held, eligible, not integrated or integrated), so a blocked declaration can
// never hide work the partial-failure policy must report.
function record(issues: readonly IssueResult[], done: Round): IssueResult[] {
  const worked = (id: string): boolean => issues.some((entry) => entry.issue.id === id && entry.outcome.kind !== "blocked");
  const fresh = done.results.filter(({ issue, outcome }) => outcome.kind !== "blocked" || !worked(issue.id));
  const kept = done.planned ? issues.filter(({ outcome }) => outcome.kind !== "blocked") : issues;
  return latest(kept, fresh);
}

type Ran = { result: RunResult; handed: string[] };

async function rounds<A, P, O>(deps: Coordinator<A, P, O>): Promise<Ran> {
  let issues: IssueResult[] = [];
  let handed: string[] = [];
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    deps.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);
    let done: Round;
    try {
      done = await round(deps);
    } catch (error) {
      return { result: finish(issues, { kind: "failed", reason: `round ${String(iteration)} failed: ${String(error)}` }), handed };
    }
    issues = record(issues, done);
    handed = [...new Set([...handed, ...(done.handed ?? [])])];
    if (done.stop !== undefined) return { result: finish(issues, done.stop), handed };
  }
  return { result: finish(issues, { kind: "exhausted", rounds: MAX_ITERATIONS }), handed };
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
  return (await runLoop(deps)).result;
}

async function runLoop<A, P, O>(deps: Coordinator<A, P, O>): Promise<Ran> {
  const refusal = branchRefusal(deps.cwd);
  if (refusal !== undefined) {
    deps.error(refusal);
    return { result: { status: "refused", reason: refusal, issues: [] }, handed: [] };
  }
  const ran = await rounds(deps);
  report(deps, ran.result);
  return ran;
}

/**
 * The loop's exit status: 0 complete, 1 refused before any agent ran, 2 blocked, incomplete or
 * failed. It records the branches handed the merger for npm run sandcastle:afk (HANDED_RECORD).
 */
export async function coordinate<A, P, O>(deps: Coordinator<A, P, O>): Promise<number> {
  const { result, handed } = await runLoop(deps);
  writeHanded(deps.cwd, handed);
  return exitCode(result);
}
