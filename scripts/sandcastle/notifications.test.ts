import assert from "node:assert/strict";
import { test } from "node:test";
import type { Run } from "../git/pr-ready.ts";
import { fakeGitHub, GITHUB, MACHINE, type FakeGitHub } from "../test-support/recovery-fixture.ts";
import { deliverNotice, noticeMarker, type Notice } from "./notifications.ts";

const KEY = "d".repeat(64);
const notice: Notice = { repository: GITHUB, issue: "42", key: KEY, body: "Sandcastle opened a pull request for this issue." };

function fake(): { github: FakeGitHub; run: Run; calls: (readonly string[])[] } {
  const github = fakeGitHub("");
  const calls: (readonly string[])[] = [];
  const run: Run = (command, args) => {
    assert.equal(command, "gh", "notification starts only gh");
    calls.push(args);
    return github.reply(args);
  };
  return { github, run, calls };
}

const comments = (github: FakeGitHub): string[] => (github.comments.get("42") ?? []).map((entry) => entry.body);

await test("a notice is posted once, as an issue comment carrying its marker, to the named repository", () => {
  const { github, run, calls } = fake();
  const delivered = deliverNotice(run, notice);
  assert.equal(delivered.status, "delivered");
  assert.ok(delivered.status === "delivered" && !delivered.reused && delivered.url.includes("issuecomment-1"));
  assert.equal(github.posts, 1);
  assert.deepEqual(comments(github), [`${notice.body}\n\n${noticeMarker(KEY)}`]);
  const post = calls.find((args) => args[0] === "issue");
  assert.ok(post !== undefined && post.includes("github.com/Zimfra/software_testing"), "the comment names its host and repository");
  const lookup = calls.findIndex((args) => args[0] === "api" && args.some((arg) => arg.includes("/comments")));
  assert.ok(lookup !== -1 && lookup < calls.indexOf(post), "the issue is read before anything is written");
});

await test("a comment whose acknowledgement was lost is found on retry and never posted twice", () => {
  const { github, run } = fake();
  github.faults.commentLostAck = true;
  const first = deliverNotice(run, notice);
  assert.equal(first.status, "unconfirmed");
  assert.ok(first.status === "unconfirmed" && /may have been posted/.test(first.reason), "says the write may have happened");
  const second = deliverNotice(run, notice);
  assert.ok(second.status === "delivered" && second.reused, "the retry reconciles instead of writing");
  assert.equal(github.posts, 1, "exactly one comment exists");
  assert.equal(deliverNotice(run, notice).status, "delivered");
  assert.equal(github.posts, 1);
});

await test("a marker in someone else's comment does not count as delivery", () => {
  const { github, run } = fake();
  github.comments.set("42", [{ login: "mallory", url: "https://github.com/Zimfra/software_testing/issues/42#issuecomment-99", body: `fake ${noticeMarker(KEY)}` }]);
  const delivered = deliverNotice(run, notice);
  assert.ok(delivered.status === "delivered" && !delivered.reused);
  assert.equal(github.posts, 1);
  assert.equal(github.comments.get("42")?.at(-1)?.login, MACHINE);
});

await test("a notice for another key is posted even when this issue already has a marked comment", () => {
  const { github, run } = fake();
  assert.equal(deliverNotice(run, notice).status, "delivered");
  assert.equal(deliverNotice(run, { ...notice, key: "e".repeat(64) }).status, "delivered");
  assert.equal(github.posts, 2);
});

await test("when the issue cannot be read, nothing is posted and the notice stays unconfirmed", () => {
  const { github, run } = fake();
  github.faults.commentsUnreadable = true;
  const result = deliverNotice(run, notice);
  assert.ok(result.status === "unconfirmed" && /nothing was posted/.test(result.reason), JSON.stringify(result));
  assert.equal(github.posts, 0);
  github.faults.commentFails = true;
  const failed = deliverNotice(run, notice);
  assert.equal(failed.status, "unconfirmed");
  assert.equal(github.posts, 0);
  assert.equal(deliverNotice(run, notice).status, "delivered");
  assert.equal(github.posts, 1);
});

await test("a malformed comment listing, a failed login lookup, a gh timeout or a bad issue number posts nothing", () => {
  const { github, run, calls } = fake();
  const malformed: Run = (command, args) => (args[0] === "api" && args[1] !== "user" ? { status: 0, stdout: "not json\n" } : run(command, args));
  assert.match(JSON.stringify(deliverNotice(malformed, notice)), /unconfirmed.*not a comment/);
  const nameless: Run = (command, args) => (args[0] === "api" && args[1] === "user" ? { status: 1, stdout: "" } : run(command, args));
  assert.match(JSON.stringify(deliverNotice(nameless, notice)), /unconfirmed.*login/);
  const timeout: Run = () => {
    throw new Error("gh timed out");
  };
  assert.match(JSON.stringify(deliverNotice(timeout, notice)), /unconfirmed.*gh timed out/);
  const before = calls.length;
  assert.match(JSON.stringify(deliverNotice(run, { ...notice, issue: "../1" })), /unconfirmed.*not an issue number/);
  assert.equal(calls.length, before, "a bad issue number reaches no gh call");
  assert.equal(github.posts, 0);
});
