// Durable recovery of a Sandcastle issue (S17, finding A10). Each issue moves through three host
// phases after its sandbox exported an artifact: verification (verifier-driver.ts issues a
// receipt), publication (isolated-publication.ts pushes the verified SHA and opens its pull
// request) and notification (notifications.ts comments on the issue). run-state.ts records each
// phase as it completes, so a rerun skips what is done and resumes what is missing. The owner's
// partial-failure policy (2026-10-16) decides the rest:
//   - A phase is reused only for unchanged inputs: the task, the base and the exact artifact. Any
//     change moves the old state aside and starts over, and a new verification resets the phases
//     after it. Recorded state never authorizes publication; publication validates its receipt.
//   - A remote write is recorded as attempted before it starts. Its retry reconciles first: the
//     push repeats the same SHA, an open pull request for exactly that SHA is reused, and a notice
//     already on the issue is found by its marker. Nothing is written twice.
//   - Failed verification holds the issue; failed or unconfirmed phases leave it failed in that
//     phase. Every issue not published keeps the run incomplete with a nonzero exit.
// The artifact directory is only read. Nothing here restores guest files onto the host.
import type { Repository } from "../git/pr-ready.ts";
import type { PlannedIssue } from "./already-done.ts";
import { readArtifacts, sha256, validateArtifacts } from "./artifact.ts";
import type { Request as PublicationRequest } from "./isolated-publication.ts";
import type { Notice, NoticeDelivery } from "./notifications.ts";
import { finish, type IssueOutcome, type IssueResult, type Phase, type RunResult } from "./run-result.ts";
import { loadState, sameInputs, saveState, supersede, type Inputs, type IssueState, type Verified } from "./run-state.ts";
import { prepareStore, readReceipt } from "./verification-receipt.ts";
import type { Verification, VerifyRequest } from "./verifier-driver.ts";

/** One issue's exported artifact and what the trusted caller knows about it. `taskSha256` digests the task text. */
export type IssueRequest = { issue: PlannedIssue; artifacts: string; task: string; taskSha256: string; base: string; ref: string; run: string };
/** The real phase implementations, bound by the caller to their runtime, reviewer and gh. */
export type Steps = {
  verify: (request: VerifyRequest) => Promise<Verification>;
  publish: (request: PublicationRequest) => Promise<{ url: string } | { refusals: string[] }>;
  notify: (notice: Notice) => NoticeDelivery;
};
export type Recovery = {
  repository: Repository; state: string; receipts: string; source: string; steps: Steps;
  root?: string; checks?: readonly string[]; save?: (dir: string, state: IssueState) => void;
};

type Context = { request: IssueRequest; recovery: Recovery; repository: string; save: (state: IssueState) => void };
type Stopped = { outcome: IssueOutcome };

const stop = (phase: Phase, reason: string): Stopped => ({ outcome: { kind: "failed", phase, reason } });
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The inputs every recorded phase is bound to, read from the artifact as it is now. */
function currentInputs({ request, repository }: Context): { inputs: Inputs } | { refusals: string[] } {
  const read = readArtifacts(request.artifacts);
  if ("refusals" in read) return read;
  const checked = validateArtifacts(read.files, { repository, task: request.task, base: request.base, ref: request.ref });
  if ("refusals" in checked) return checked;
  return { inputs: {
    repository, task: request.task, taskSha256: request.taskSha256, base: request.base, ref: request.ref,
    candidate: checked.manifest.candidate.sha, manifestSha256: sha256(read.files.manifest),
  } };
}

/** The state to resume from: the recorded one for unchanged inputs, otherwise a fresh one (the old one kept aside). */
function resume(context: Context): { state: IssueState } | Stopped {
  const { request, recovery, repository } = context;
  const placed = prepareStore(recovery.state, [recovery.source, request.artifacts], "run-state store");
  if (placed.length > 0) return stop("recovery", placed.join("; "));
  const current = currentInputs(context);
  if ("refusals" in current) return stop("import", `${current.refusals.join("; ")}. The artifact directory ${request.artifacts} is kept as it is.`);
  const loaded = loadState(recovery.state, repository, request.task);
  if ("refusals" in loaded) return stop("recovery", loaded.refusals.join("; "));
  const recorded = loaded.state;
  if (recorded !== null && sameInputs(recorded.inputs, current.inputs)) return { state: { ...recorded, artifacts: request.artifacts } };
  if (recorded !== null) supersede(recovery.state, recorded);
  const state: IssueState = { version: 1, inputs: current.inputs, artifacts: request.artifacts, verification: null, publication: null, notification: null };
  context.save(state);
  return { state };
}

/** True when the recorded receipt is still in the store and binds exactly these inputs. */
function receiptStands({ recovery }: Context, inputs: Inputs, verified: Verified): boolean {
  const read = readReceipt(recovery.receipts, verified.receipt);
  if ("refusals" in read) return false;
  const { receipt } = read;
  return receipt.repository === inputs.repository && receipt.task === inputs.task && receipt.base === inputs.base
    && receipt.candidate.ref === inputs.ref && receipt.candidate.sha === inputs.candidate
    && receipt.artifact.manifestSha256 === inputs.manifestSha256 && receipt.run === verified.run && receipt.outcome === verified.outcome;
}

async function verified(context: Context, state: IssueState): Promise<{ state: IssueState; verification: Verified } | Stopped> {
  const { request, recovery, repository } = context;
  if (state.verification !== null && receiptStands(context, state.inputs, state.verification)) return { state, verification: state.verification };
  let result: Verification;
  try {
    result = await recovery.steps.verify({
      artifacts: request.artifacts, source: recovery.source, store: recovery.receipts, run: request.run,
      expected: { repository, task: request.task, base: request.base, ref: request.ref },
      ...(recovery.root === undefined ? {} : { root: recovery.root }), ...(recovery.checks === undefined ? {} : { checks: recovery.checks }),
    });
  } catch (error) {
    return stop("verification", message(error));
  }
  if (result.status === "blocked") return stop("verification", `blocked: ${result.reasons.join("; ")}`);
  if (result.status === "refused") return stop("verification", result.refusals.join("; "));
  if (result.receipt.candidate.sha !== state.inputs.candidate || result.receipt.artifact.manifestSha256 !== state.inputs.manifestSha256) {
    return stop("verification", "the artifact changed while it was verified; rerun to start from the artifact as it is now");
  }
  const verification: Verified = { receipt: result.digest, run: result.receipt.run, outcome: result.status };
  const next: IssueState = { ...state, verification, publication: null, notification: null };
  context.save(next);
  return { state: next, verification };
}

async function published(context: Context, state: IssueState, verification: Verified): Promise<{ state: IssueState; url: string } | Stopped> {
  if (state.publication?.status === "delivered") return { state, url: state.publication.url };
  const { inputs } = state;
  const attempted: IssueState = { ...state, publication: { status: "attempted" } };
  context.save(attempted);
  let result: { url: string } | { refusals: string[] };
  try {
    result = await context.recovery.steps.publish({
      artifacts: context.request.artifacts, receipt: verification.receipt, repository: inputs.repository, task: inputs.task,
      run: verification.run, base: inputs.base, candidate: inputs.candidate, ref: inputs.ref,
    });
  } catch (error) {
    return stop("publication", `${message(error)}. Whether the push or the pull request reached GitHub is unknown; a rerun reconciles the branch and its open pull request before writing again`);
  }
  if ("refusals" in result) return stop("publication", result.refusals.join("; "));
  const next: IssueState = { ...attempted, publication: { status: "delivered", url: result.url } };
  context.save(next);
  return { state: next, url: result.url };
}

function notified(context: Context, state: IssueState, url: string): Stopped | undefined {
  if (state.notification?.status === "delivered") return undefined;
  const { inputs } = state;
  const attempted: IssueState = { ...state, notification: { status: "attempted" } };
  context.save(attempted);
  const delivery = context.recovery.steps.notify({
    repository: context.recovery.repository, issue: context.request.issue.id,
    key: sha256(Buffer.from(JSON.stringify(["notice", inputs.repository, inputs.task, inputs.candidate]))),
    body: `Sandcastle verified candidate ${inputs.candidate} for this issue and opened ${url} for the owner's review. This issue stays open until the owner merges that pull request.`,
  });
  if (delivery.status === "unconfirmed") return stop("notification", `the pull request ${url} is open, but ${delivery.reason}`);
  context.save({ ...attempted, notification: { status: "delivered", url: delivery.url } });
  return undefined;
}

async function outcomeOf(context: Context): Promise<IssueOutcome> {
  const start = resume(context);
  if ("outcome" in start) return start.outcome;
  const checked = await verified(context, start.state);
  if ("outcome" in checked) return checked.outcome;
  const { candidate } = checked.state.inputs;
  if (checked.verification.outcome === "failed") {
    return { kind: "held", sha: candidate, reason: `verification failed (receipt ${checked.verification.receipt}); the candidate stays unpublished until it changes` };
  }
  const handed = await published(context, checked.state, checked.verification);
  if ("outcome" in handed) return handed.outcome;
  const told = notified(context, handed.state, handed.url);
  return told === undefined ? { kind: "published", sha: candidate, url: handed.url } : told.outcome;
}

/** Resume one issue from its recorded state. A failed state write throws: the host, not the issue, failed. */
export async function recoverIssue(request: IssueRequest, recovery: Recovery): Promise<IssueResult> {
  const save = recovery.save ?? saveState;
  const repository = `${recovery.repository.owner}/${recovery.repository.name}`;
  const context: Context = { request, recovery, repository, save: (state) => { save(recovery.state, state); } };
  return { issue: request.issue, outcome: await outcomeOf(context) };
}

/** Resume each issue in turn; one issue's failure never stops another's, and the run is complete only when all are published. */
export async function recoverRun(requests: readonly IssueRequest[], recovery: Recovery): Promise<RunResult> {
  const results: IssueResult[] = [];
  for (const request of requests) results.push(await recoverIssue(request, recovery));
  return finish(results, { kind: "drained" });
}
