import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED } from "../lib/cli.ts";
import { exitCode, finish, judgeReview, latest, parseVerdict, type IssueOutcome, type IssueResult } from "./run-result.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const tagged = (body: string): string => `notes\n<review>${body}</review>\n`;
const pass = (sha: string): string => tagged(JSON.stringify({ verdict: "pass", sha, reason: "ok" }));
const result = (id: number, outcome: IssueOutcome): IssueResult => ({ issue: { id: String(id), title: `Issue ${id}`, branch: `sandcastle/issue-${id}` }, outcome });

await test("parseVerdict reads the last <review> block", () => {
  assert.deepEqual(parseVerdict(`${pass(B)}${tagged(JSON.stringify({ verdict: "fail", sha: A, reason: "no tests" }))}`), { verdict: "fail", sha: A, reason: "no tests" });
  assert.deepEqual(parseVerdict(tagged(JSON.stringify({ verdict: "pass", sha: A }))), { verdict: "pass", sha: A, reason: "" });
});

await test("parseVerdict refuses an absent, non-JSON or incomplete verdict", () => {
  for (const stdout of ["", "<promise>COMPLETE</promise>", tagged("pass"), tagged("null"), tagged("[]"),
    tagged(JSON.stringify({ verdict: "approve", sha: A })), tagged(JSON.stringify({ verdict: "pass", sha: "abc123" })),
    tagged(JSON.stringify({ verdict: "pass", sha: A.toUpperCase() })), tagged(JSON.stringify({ verdict: "pass" }))]) {
    const parsed = parseVerdict(stdout);
    assert.ok("malformed" in parsed, `accepted ${stdout}`);
  }
});

await test("parseVerdict refuses a trailing unclosed <review> block after a closed pass, such as truncated output", () => {
  const truncated = `${pass(A)}\n<review>{"verdict": "fail", "sha": "${A}", "reason": "brea`;
  assert.ok("malformed" in parseVerdict(truncated));
  assert.ok("malformed" in parseVerdict(`${pass(A)}<review>`));
});

await test("parseVerdict refuses a verdict with a duplicate key, which JSON.parse would resolve to the last", () => {
  for (const body of [
    `{"verdict": "fail", "sha": "${A}", "reason": "x", "verdict": "pass"}`,
    `{"verdict": "pass", "sha": "${B}", "sha": "${A}"}`,
    `{"verdict": "pass", "sha": "${A}", "reason": "a", "reason": "b"}`,
    `{"verdict": "pass", "sha": "${A}", "ver\\u0064ict": "pass"}`,
  ]) {
    assert.ok("malformed" in parseVerdict(tagged(body)), body);
  }
  assert.deepEqual(parseVerdict(tagged(`{"verdict": "pass", "sha": "${A}", "note": {"sha": "x"}}`)), { verdict: "pass", sha: A, reason: "" });
});

await test("the review prompt's example block, copied after a real verdict, cannot pass the candidate", () => {
  const prompt = readFileSync(new URL("../../.sandcastle/review-prompt.md", import.meta.url), "utf8").replaceAll("{{CANDIDATE}}", A);
  const example = [...prompt.matchAll(/<review>[\s\S]*?<\/review>/g)].map(([block]) => block);
  assert.equal(example.length, 1);
  assert.ok("malformed" in parseVerdict(`${pass(A)}\n${example.join("")}`));
});

await test("judgeReview makes only an untouched candidate with a passing verdict for its own SHA eligible", () => {
  assert.deepEqual(judgeReview(A, { stdout: pass(A), commits: 0, tipAfter: A }), { kind: "eligible", sha: A });
});

await test("judgeReview holds a failed, absent, malformed or stale verdict", () => {
  const held = (stdout: string): IssueOutcome => judgeReview(A, { stdout, commits: 0, tipAfter: A });
  assert.deepEqual(held(tagged(JSON.stringify({ verdict: "fail", sha: A, reason: "breaks the build" }))), { kind: "held", sha: A, reason: "the review failed: breaks the build" });
  assert.deepEqual(held(""), { kind: "held", sha: A, reason: "the reviewer gave no <review> verdict" });
  assert.equal(held(tagged("{")).kind, "held");
  assert.deepEqual(held(pass(B)), { kind: "held", sha: A, reason: `the verdict names ${B}, not the candidate ${A}` });
});

await test("judgeReview holds a candidate the reviewer changed, even with a passing verdict for the new tip", () => {
  const reason = "the reviewer changed the candidate; the changed branch needs a new independent review";
  assert.deepEqual(judgeReview(A, { stdout: pass(B), commits: 1, tipAfter: B }), { kind: "held", sha: A, reason });
  assert.deepEqual(judgeReview(A, { stdout: pass(A), commits: 1, tipAfter: A }), { kind: "held", sha: A, reason });
  assert.deepEqual(judgeReview(A, { stdout: pass(A), commits: 0, tipAfter: B }), { kind: "held", sha: A, reason });
  assert.deepEqual(judgeReview(A, { stdout: pass(A), commits: 0, tipAfter: undefined }), { kind: "held", sha: A, reason });
});

await test("latest keeps each issue's most recent outcome in first-seen order", () => {
  const earlier = [result(1, { kind: "failed", phase: "sandbox", reason: "x" }), result(2, { kind: "integrated", sha: A })];
  const later = [result(3, { kind: "no-work" }), result(1, { kind: "integrated", sha: B })];
  assert.deepEqual(latest(earlier, later), [result(1, { kind: "integrated", sha: B }), result(2, { kind: "integrated", sha: A }), result(3, { kind: "no-work" })]);
});

await test("finish: a drained queue with only integrated or no-work issues is complete and exits 0", () => {
  const done = finish([result(1, { kind: "integrated", sha: A }), result(2, { kind: "no-work" })], { kind: "drained" });
  assert.equal(done.status, "complete");
  assert.equal(done.reason, undefined);
  assert.equal(exitCode(done), EXIT_OK);
  assert.equal(exitCode(finish([], { kind: "drained" })), EXIT_OK);
});

await test("finish: any held, failed, eligible or not-integrated issue makes a drained run incomplete, exit 2, naming it", () => {
  for (const outcome of [
    { kind: "held", sha: A, reason: "r" }, { kind: "failed", phase: "reviewer", reason: "r" },
    { kind: "eligible", sha: A }, { kind: "not-integrated", sha: A, reason: "r" },
  ] satisfies IssueOutcome[]) {
    const run = finish([result(1, { kind: "integrated", sha: B }), result(2, outcome)], { kind: "drained" });
    assert.equal(run.status, "incomplete", outcome.kind);
    assert.equal(exitCode(run), EXIT_ERROR);
    assert.match(run.reason ?? "", /issue 2\b/);
  }
});

await test("finish: exhausted rounds are incomplete and a failed phase is failed, both exit 2", () => {
  const exhausted = finish([result(1, { kind: "integrated", sha: A })], { kind: "exhausted", rounds: 10 });
  assert.equal(exhausted.status, "incomplete");
  assert.match(exhausted.reason ?? "", /10 rounds/);
  assert.equal(exitCode(exhausted), EXIT_ERROR);
  const failed = finish([result(1, { kind: "integrated", sha: A })], { kind: "failed", reason: "the planner failed: boom" });
  assert.deepEqual([failed.status, failed.reason, exitCode(failed)], ["failed", "the planner failed: boom", EXIT_ERROR]);
});

await test("exitCode maps a refused run to 1", () => {
  assert.equal(exitCode({ status: "refused", reason: "on main", issues: [] }), EXIT_REFUSED);
});
