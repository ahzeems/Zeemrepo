import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { artifactForTask, createRecoveryFixture, digests, GITHUB, type RecoveryFixture } from "../test-support/recovery-fixture.ts";
import { anotherCandidate, CHECKS, FAIL, fakeReviewer, fakeRuntime, PASS, REF, TASK, type FakeRuntime } from "../test-support/verifier-fixture.ts";
import { checkArtifacts } from "./artifact.ts";
import { publishCandidate } from "./isolated-publication.ts";
import { deliverNotice } from "./notifications.ts";
import { recoverIssue, recoverRun, type IssueRequest, type Recovery } from "./recovery.ts";
import { exitCode, type IssueOutcome } from "./run-result.ts";
import { loadState, saveState, stateKey, type IssueState } from "./run-state.ts";
import { verifyCandidate } from "./verifier-driver.ts";

// Recovery runs the real verifier driver (fake container runtime and reviewer), real isolated
// publication against a local bare remote, and real notification delivery against a stateful
// fake GitHub. Faults are injected at the boundaries a real run can lose: a step that throws, a
// write whose acknowledgement is lost, and a state write that never happens.
type Harness = { made: RecoveryFixture; recovery: Recovery; runtime: FakeRuntime; counts: { verify: number; publish: number }; review: { response: string } };

function harness(t: TestContext, review = PASS, made = createRecoveryFixture()): Harness {
  t.after(() => { made.cleanup(); });
  const runtime = fakeRuntime();
  const verdict = { response: review };
  const reviewer = fakeReviewer((input) => (input.task === "issue-43" ? FAIL : verdict.response));
  const counts = { verify: 0, publish: 0 };
  const recovery: Recovery = {
    repository: GITHUB, state: made.state, receipts: made.store, source: made.host.dir, root: made.root, checks: CHECKS,
    steps: {
      verify: (request) => {
        counts.verify++;
        return verifyCandidate(request, { runtime, reviewer });
      },
      publish: (request) => {
        counts.publish++;
        return publishCandidate(request, { run: made.runner, control: made.host.dir, store: made.store, checks: CHECKS, quarantineRoot: made.root });
      },
      notify: (notice) => deliverNotice(made.runner, notice),
    },
  };
  return { made, recovery, runtime, counts, review: verdict };
}

const request = (made: RecoveryFixture, overrides: Partial<IssueRequest> = {}): IssueRequest => ({
  issue: { id: "42", title: "Issue 42", branch: "sandcastle/issue-42" }, artifacts: made.artifacts,
  task: TASK, taskSha256: "1".repeat(64), base: made.base, ref: REF, run: made.run, ...overrides,
});

const remoteTip = (made: RecoveryFixture, branch = "sandcastle/issue-42"): string =>
  execFileSync("git", ["--git-dir", made.remote, "for-each-ref", "--format=%(objectname)", `refs/heads/${branch}`], { env: cleanGitEnv, encoding: "utf8" }).trim();

function stored(made: RecoveryFixture, task = TASK): IssueState | null {
  const loaded = loadState(made.state, "Zimfra/software_testing", task);
  assert.ok("state" in loaded, JSON.stringify(loaded));
  return loaded.state;
}

function published(outcome: IssueOutcome, sha: string): string {
  assert.equal(outcome.kind, "published", JSON.stringify(outcome));
  assert.ok(outcome.kind === "published" && outcome.sha === sha);
  return outcome.url;
}

function failedIn(outcome: IssueOutcome, phase: string, reason: RegExp): void {
  assert.ok(outcome.kind === "failed", JSON.stringify(outcome));
  assert.equal(outcome.phase, phase);
  assert.match(outcome.reason, reason);
}

await test("a run verifies, publishes and notifies once; a rerun with unchanged inputs repeats nothing", async (t) => {
  const { made, recovery, runtime, counts } = harness(t);
  const run = await recoverRun([request(made)], recovery);
  assert.equal(run.status, "complete", JSON.stringify(run));
  assert.equal(exitCode(run), 0);
  const url = published(run.issues[0]?.outcome ?? { kind: "no-work" }, made.candidate);
  assert.equal(url, "https://github.com/Zimfra/software_testing/pull/7");
  assert.equal(remoteTip(made), made.candidate);
  assert.deepEqual([counts.verify, counts.publish, runtime.calls.length, made.github.creates, made.github.posts], [1, 1, 1, 1, 1]);
  const reads = made.github.reads;
  const again = await recoverIssue(request(made), recovery);
  assert.equal(published(again.outcome, made.candidate), url);
  assert.deepEqual([counts.verify, counts.publish, runtime.calls.length, made.github.creates, made.github.posts], [1, 1, 1, 1, 1], "no phase ran again");
  assert.equal(made.github.reads, reads, "a delivered notice is not even looked up again");
});

await test("a restart after a failed notification resumes only the notification", async (t) => {
  const { made, recovery, runtime, counts } = harness(t);
  made.github.faults.commentFails = true;
  const first = await recoverRun([request(made)], recovery);
  assert.equal(first.status, "incomplete");
  assert.notEqual(exitCode(first), 0);
  assert.equal(first.reason, "issue 42 is published, notification not confirmed", "the pull request exists, so the issue is not called unintegrated");
  failedIn(first.issues[0]?.outcome ?? { kind: "no-work" }, "notification", /did not confirm/);
  assert.equal(made.github.posts, 0);
  const second = await recoverIssue(request(made), recovery);
  published(second.outcome, made.candidate);
  assert.deepEqual([counts.verify, counts.publish, runtime.calls.length, made.github.creates, made.github.posts], [1, 1, 1, 1, 1]);
});

await test("a pull request created before its acknowledgement was lost is reconciled, never created twice", async (t) => {
  const { made, recovery, counts } = harness(t);
  made.github.faults.createLostAck = true;
  const first = await recoverIssue(request(made), recovery);
  failedIn(first.outcome, "publication", /unknown.*reconciles/);
  assert.deepEqual(stored(made)?.publication, { status: "attempted" }, "the attempt is on record before its outcome is known");
  assert.equal(made.github.posts, 0, "nobody is told about a pull request that is not confirmed");
  const second = await recoverIssue(request(made), recovery);
  assert.equal(published(second.outcome, made.candidate), "https://github.com/Zimfra/software_testing/pull/7");
  assert.deepEqual([counts.verify, counts.publish, made.github.creates, made.github.pulls.length, made.github.posts], [1, 2, 1, 1, 1]);
});

await test("a comment posted before its acknowledgement was lost is found on retry, never posted twice", async (t) => {
  const { made, recovery } = harness(t);
  made.github.faults.commentLostAck = true;
  failedIn((await recoverIssue(request(made), recovery)).outcome, "notification", /may have been posted/);
  published((await recoverIssue(request(made), recovery)).outcome, made.candidate);
  assert.equal(made.github.posts, 1);
});

/** A save that loses power once, on the first write `when` matches, before anything reaches disk. */
function crashOnce(when: (state: IssueState) => boolean): (dir: string, state: IssueState) => void {
  let armed = true;
  return (dir, state) => {
    if (armed && when(state)) {
      armed = false;
      throw new Error("power lost before the state write");
    }
    saveState(dir, state);
  };
}

await test("a crash between a remote write and its state write resumes without repeating the write", async (t) => {
  const { made, recovery, runtime, counts } = harness(t);
  const points: [string, (state: IssueState) => boolean][] = [
    ["verification", (state) => state.verification !== null],
    ["publication", (state) => state.publication?.status === "delivered"],
    ["notification", (state) => state.notification?.status === "delivered"],
  ];
  for (const [phase, when] of points) {
    rmSync(join(made.state, `${stateKey("Zimfra/software_testing", TASK)}.json`), { force: true });
    await assert.rejects(recoverIssue(request(made), { ...recovery, save: crashOnce(when) }), /power lost/, phase);
    published((await recoverIssue(request(made), recovery)).outcome, made.candidate);
  }
  assert.equal(runtime.calls.length, 1, "the container checks ran once; later verifications reused the receipt");
  assert.equal(counts.verify, 4, "verification is asked again only when its result never reached the state");
  assert.equal(made.github.creates, 1, "one pull request");
  assert.equal(made.github.posts, 1, "one comment");
  assert.equal(remoteTip(made), made.candidate);
});

await test("a crash after a comment is posted leaves the notice recorded as attempted, and the retry reconciles it", async (t) => {
  const { made, recovery } = harness(t);
  const crashing: Recovery = { ...recovery, steps: { ...recovery.steps, notify: (notice) => {
    recovery.steps.notify(notice);
    throw new Error("power lost after the comment was posted");
  } } };
  await assert.rejects(recoverIssue(request(made), crashing), /power lost/);
  assert.deepEqual(stored(made)?.notification, { status: "attempted" }, "the state shows the comment may exist");
  assert.equal(made.github.posts, 1);
  const reads = made.github.reads;
  published((await recoverIssue(request(made), recovery)).outcome, made.candidate);
  assert.equal(made.github.posts, 1, "the retry found the comment instead of posting another");
  assert.ok(made.github.reads > reads, "the retry read the issue before deciding");
});

await test("an interrupted import or verification keeps the artifact and recovers without restoring guest files", async (t) => {
  const made = createRecoveryFixture({ recovery: "half-finished work\n" });
  const { recovery, counts } = harness(t, PASS, made);
  const names = ["candidate.json", "candidate.bundle", "recovery.data"];
  const before = digests(made.artifacts, names);
  let interrupted = true;
  const flaky: Recovery = { ...recovery, steps: { ...recovery.steps, verify: (r) => {
    if (interrupted) {
      interrupted = false;
      counts.verify++;
      return Promise.reject(new Error("the verifier was killed mid-import"));
    }
    return recovery.steps.verify(r);
  } } };
  failedIn((await recoverIssue(request(made), flaky)).outcome, "verification", /killed mid-import/);
  assert.equal(stored(made)?.artifacts, made.artifacts, "the state names the retained artifact");
  assert.equal(stored(made)?.verification, null);
  published((await recoverIssue(request(made), flaky)).outcome, made.candidate);
  assert.deepEqual(digests(made.artifacts, names), before, "the artifact, recovery data included, is unchanged");
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: made.host.dir, env: cleanGitEnv, encoding: "utf8" }), "", "nothing was restored into the control checkout");
  assert.ok(!existsSync(join(made.host.dir, "recovery.data")));

  const truncated = artifactForTask(made, "issue-44", { "feature.txt": "ok\n" });
  t.after(() => rmSync(truncated.artifacts, { recursive: true, force: true }));
  truncateSync(join(truncated.artifacts, "candidate.bundle"), 10);
  const kept = digests(truncated.artifacts, ["candidate.json", "candidate.bundle"]);
  const torn = await recoverIssue(request(made, { issue: { id: "44", title: "Issue 44", branch: "sandcastle/issue-44" }, artifacts: truncated.artifacts, task: "issue-44", ref: truncated.ref }), recovery);
  failedIn(torn.outcome, "import", /candidate\.bundle.*kept/s);
  assert.deepEqual(digests(truncated.artifacts, ["candidate.json", "candidate.bundle"]), kept, "the torn artifact is kept for inspection");
  assert.equal(stored(made, "issue-44"), null);
});

await test("failed verification stays held until the candidate changes, and changed inputs invalidate earlier evidence", async (t) => {
  const { made, recovery, runtime, counts, review } = harness(t, FAIL);
  const first = await recoverRun([request(made)], recovery);
  assert.equal(first.status, "incomplete");
  assert.equal(first.issues[0]?.outcome.kind, "held");
  assert.equal(made.github.creates + made.github.posts, 0, "failed work is neither published nor announced");
  review.response = PASS;
  assert.equal((await recoverIssue(request(made), recovery)).outcome.kind, "held", "a failed verification is not retried on unchanged inputs");
  assert.deepEqual([counts.verify, runtime.calls.length], [1, 1]);

  const changed = anotherCandidate(made, { "feature.txt": "ok\n", "more.txt": "more\n" });
  t.after(() => rmSync(changed, { recursive: true, force: true }));
  const checked = checkArtifacts(changed, { repository: "Zimfra/software_testing", task: TASK, base: made.base, ref: REF });
  assert.ok("manifest" in checked);
  const sha = checked.manifest.candidate.sha;
  published((await recoverIssue(request(made, { artifacts: changed }), recovery)).outcome, sha);
  assert.deepEqual([counts.verify, runtime.calls.length, made.github.creates], [2, 2, 1]);
  assert.ok(readdirSync(made.state).some((name) => name.endsWith(".superseded.json")), "the superseded state is kept");
  assert.equal(stored(made)?.inputs.candidate, sha);

  published((await recoverIssue(request(made, { artifacts: changed, taskSha256: "2".repeat(64) }), recovery)).outcome, sha);
  assert.equal(counts.verify, 3, "a changed task asks for verification again");
  assert.deepEqual([runtime.calls.length, made.github.creates, made.github.posts], [2, 1, 1], "the verifier reused its receipt and GitHub was reconciled, not written");
});

await test("stale or forged state never stands in for verification or publication", async (t) => {
  const { made, recovery, counts } = harness(t);
  const other = anotherCandidate(made, { "feature.txt": "ok\n", "other.txt": "other\n" });
  t.after(() => rmSync(other, { recursive: true, force: true }));
  const otherVerified = await verifyCandidate({ artifacts: other, source: made.host.dir, expected: { repository: "Zimfra/software_testing", task: TASK, base: made.base, ref: REF }, run: made.run, store: made.store, root: made.root, checks: CHECKS }, { runtime: fakeRuntime(), reviewer: fakeReviewer(PASS) });
  assert.equal(otherVerified.status, "passed");
  assert.ok(otherVerified.status === "passed");
  // Run once to learn the exact inputs, then forge the state: another candidate's passing receipt
  // and a publication that never happened.
  await recoverIssue(request(made), { ...recovery, steps: { ...recovery.steps, publish: () => Promise.resolve({ refusals: ["held for the test"] }) } });
  const real = stored(made);
  assert.ok(real !== null && real.verification !== null);
  saveState(made.state, { ...real, verification: { ...real.verification, receipt: otherVerified.digest }, publication: { status: "delivered", url: "https://github.com/Zimfra/software_testing/pull/99" } });
  const before = counts.verify;
  const url = published((await recoverIssue(request(made), recovery)).outcome, made.candidate);
  assert.equal(counts.verify, before + 1, "a receipt for another candidate is not reused");
  assert.equal(url, "https://github.com/Zimfra/software_testing/pull/7", "the forged publication was replaced by a real one");
  assert.equal(remoteTip(made), made.candidate);
});

await test("malformed state or a state store inside the checkout fails closed and is kept", async (t) => {
  const { made, recovery, counts } = harness(t);
  const path = join(made.state, `${stateKey("Zimfra/software_testing", TASK)}.json`);
  writeFileSync(path, '{"version":9}', { mode: 0o600 });
  const run = await recoverRun([request(made)], recovery);
  assert.equal(run.status, "incomplete");
  assert.notEqual(exitCode(run), 0);
  failedIn(run.issues[0]?.outcome ?? { kind: "no-work" }, "recovery", /version 9/);
  assert.equal(readFileSync(path, "utf8"), '{"version":9}');
  failedIn((await recoverIssue(request(made), { ...recovery, state: join(made.host.dir, ".state") })).outcome, "recovery", /^the run-state store .* is inside/);
  assert.deepEqual([counts.verify, counts.publish, made.github.creates], [0, 0, 0]);
});

await test("mixed outcomes: the reviewed issue proceeds, the failed one is held and the run is incomplete", async (t) => {
  const { made, recovery } = harness(t);
  const second = artifactForTask(made, "issue-43", { "feature.txt": "ok\n", "b.txt": "b\n" });
  t.after(() => rmSync(second.artifacts, { recursive: true, force: true }));
  const run = await recoverRun([
    request(made),
    request(made, { issue: { id: "43", title: "Issue 43", branch: "sandcastle/issue-43" }, artifacts: second.artifacts, task: "issue-43", ref: second.ref }),
  ], recovery);
  assert.equal(run.status, "incomplete");
  assert.equal(exitCode(run), 2);
  assert.match(run.reason ?? "", /issue 43 is not integrated/);
  assert.doesNotMatch(run.reason ?? "", /issue 42/);
  published(run.issues[0]?.outcome ?? { kind: "no-work" }, made.candidate);
  assert.equal(run.issues[1]?.outcome.kind, "held");
  assert.equal(remoteTip(made, "sandcastle/issue-43"), "", "the failed issue was not pushed");
  assert.deepEqual([made.github.creates, made.github.posts], [1, 1]);
});
