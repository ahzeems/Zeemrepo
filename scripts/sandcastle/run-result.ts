import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED } from "../lib/cli.ts";
import type { PlannedIssue } from "./already-done.ts";

// What a Sandcastle run established for each issue, and what the run as a whole may claim.
// The owner's partial-failure policy (2026-10-16): checked and reviewed issues may proceed,
// failed or unreviewed ones stay unintegrated, and a run with either reports incomplete with a
// nonzero exit naming them. An issue the planner declared blocked is never worked; a run left
// with only such issues is blocked, also nonzero. Nothing here authorizes publication; the AFK
// wrapper and npm run pr judge the branch for themselves.

export type Phase = "sandbox" | "implementer" | "reviewer";
export type IssueOutcome =
  | { readonly kind: "no-work" }
  | { readonly kind: "blocked"; readonly blockedBy: readonly string[] }
  | { readonly kind: "failed"; readonly phase: Phase; readonly reason: string }
  | { readonly kind: "held"; readonly sha: string; readonly reason: string }
  | { readonly kind: "eligible"; readonly sha: string }
  | { readonly kind: "integrated"; readonly sha: string }
  | { readonly kind: "not-integrated"; readonly sha: string; readonly reason: string };
export type IssueResult = { readonly issue: PlannedIssue; readonly outcome: IssueOutcome };
export type RunStatus = "complete" | "blocked" | "incomplete" | "failed" | "refused";
export type RunResult = { readonly status: RunStatus; readonly reason: string | undefined; readonly issues: readonly IssueResult[] };
export type Verdict = { readonly verdict: "pass" | "fail"; readonly sha: string; readonly reason: string };
export type ReviewRun = { readonly stdout: string; readonly commits: number; readonly tipAfter: string | undefined };
export type Stop = { readonly kind: "drained" } | { readonly kind: "exhausted"; readonly rounds: number } | { readonly kind: "failed"; readonly reason: string };

const FULL_SHA = /^[0-9a-f]{40}$/;
const REVIEW_BLOCK = /<review>([\s\S]*?)<\/review>/g;
const SETTLED: ReadonlySet<IssueOutcome["kind"]> = new Set(["no-work", "integrated"]);
const EDITED = "the reviewer changed the candidate; the changed branch needs a new independent review";

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// The keys of a valid JSON object's own top level, decoded, duplicates kept: JSON.parse keeps only
// the last of two equal keys, so `{"verdict":"fail","verdict":"pass"}` would read as a pass.
function topLevelKeys(json: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let previous = "";
  for (const [token] of json.matchAll(/"(?:[^"\\]|\\.)*"|[{}[\]:]/g)) {
    if (token === ":" && depth === 1) {
      const key: unknown = JSON.parse(previous);
      if (typeof key === "string") keys.push(key);
    }
    if (token === "{" || token === "[") depth++;
    if (token === "}" || token === "]") depth--;
    previous = token;
  }
  return keys;
}

/**
 * The verdict in the reviewer's last <review> block. An earlier block may be an echo of the
 * prompt, so only the last one counts. It must name the full SHA it reviewed.
 */
export function parseVerdict(stdout: string): Verdict | { readonly malformed: string } {
  const last = [...stdout.matchAll(REVIEW_BLOCK)].at(-1);
  const body = last?.[1];
  if (last === undefined || body === undefined) return { malformed: "the reviewer gave no <review> verdict" };
  if (stdout.includes("<review>", last.index + last[0].length)) return { malformed: "the reviewer's last <review> block is not closed" };
  const value = parsed(body);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { malformed: "the <review> verdict is not JSON" };
  const keys = topLevelKeys(body);
  if (new Set(keys).size !== keys.length) return { malformed: "the <review> verdict repeats a key" };
  const { verdict, sha, reason }: Record<string, unknown> = { ...value };
  if ((verdict !== "pass" && verdict !== "fail") || typeof sha !== "string" || !FULL_SHA.test(sha)) {
    return { malformed: "the <review> verdict needs verdict pass or fail and the full SHA it reviewed" };
  }
  return { verdict, sha, reason: typeof reason === "string" ? reason : "" };
}

/** Eligible only when the reviewer left `candidate` as it was and passed that exact commit. */
export function judgeReview(candidate: string, review: ReviewRun): IssueOutcome {
  const held = (reason: string): IssueOutcome => ({ kind: "held", sha: candidate, reason });
  if (review.commits > 0 || review.tipAfter !== candidate) return held(EDITED);
  const verdict = parseVerdict(review.stdout);
  if ("malformed" in verdict) return held(verdict.malformed);
  if (verdict.sha !== candidate) return held(`the verdict names ${verdict.sha}, not the candidate ${candidate}`);
  if (verdict.verdict === "fail") return held(`the review failed: ${verdict.reason}`);
  return { kind: "eligible", sha: candidate };
}

/** Each issue's most recent outcome, in the order the issues were first seen. */
export function latest(earlier: readonly IssueResult[], later: readonly IssueResult[]): IssueResult[] {
  const replaced = earlier.map((entry) => later.find((next) => next.issue.id === entry.issue.id) ?? entry);
  return [...replaced, ...later.filter((next) => !earlier.some((entry) => entry.issue.id === next.issue.id))];
}

export const outstanding = (issues: readonly IssueResult[]): IssueResult[] => issues.filter(({ outcome }) => !SETTLED.has(outcome.kind));

const issueList = (ids: readonly string[]): string => `issue ${ids.join(", issue ")} ${ids.length === 1 ? "is" : "are"}`;

/**
 * The run's status: complete only when the queue drained and no issue is left failed, held,
 * unmerged or blocked. Blocked issues were never worked, so they make the run blocked, not failed;
 * beside any other outstanding issue the run is incomplete.
 */
export function finish(issues: readonly IssueResult[], stop: Stop): RunResult {
  if (stop.kind === "failed") return { status: "failed", reason: stop.reason, issues };
  if (stop.kind === "exhausted") return { status: "incomplete", reason: `stopped after ${String(stop.rounds)} rounds with work still planned`, issues };
  const left = outstanding(issues);
  const blocked = left.filter(({ outcome }) => outcome.kind === "blocked").map(({ issue }) => issue.id);
  const unintegrated = left.filter(({ outcome }) => outcome.kind !== "blocked").map(({ issue }) => issue.id);
  const blockedReason = `${issueList(blocked)} blocked by an open issue and was not worked`;
  if (unintegrated.length > 0) {
    const reason = `${issueList(unintegrated)} not integrated`;
    return { status: "incomplete", reason: blocked.length > 0 ? `${reason}; ${blockedReason}` : reason, issues };
  }
  if (blocked.length > 0) return { status: "blocked", reason: blockedReason, issues };
  return { status: "complete", reason: undefined, issues };
}

export function exitCode(result: RunResult): number {
  if (result.status === "complete") return EXIT_OK;
  return result.status === "refused" ? EXIT_REFUSED : EXIT_ERROR;
}

/** One line for an outcome that is not settled, for the run's log. */
export function describeOutcome(outcome: IssueOutcome): string {
  switch (outcome.kind) {
    case "failed": return `failed in the ${outcome.phase}: ${outcome.reason}`;
    case "held": return `held at ${outcome.sha}: ${outcome.reason}`;
    case "not-integrated": return `not integrated at ${outcome.sha}: ${outcome.reason}`;
    case "eligible": return `reviewed at ${outcome.sha} but never merged`;
    case "integrated": return `integrated at ${outcome.sha}`;
    case "no-work": return "no work";
    case "blocked": return `blocked by issue ${outcome.blockedBy.join(", issue ")}`;
  }
}
