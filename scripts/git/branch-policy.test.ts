import assert from "node:assert/strict";
import { test } from "node:test";
import { commitRefusals, pushRefusals, type PushUpdate } from "./branch-policy.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const ZERO = "0".repeat(40);
const update = (remoteRef: string, localOid: string, remoteOid: string): PushUpdate => ({ localRef: "refs/heads/x", localOid, remoteRef, remoteOid });
// isAncestor(ancestor, descendant): A is an ancestor of B; B has landed on origin/main.
const ancestry = (ancestor: string, descendant: string): boolean =>
  (ancestor === A && descendant === B) || (ancestor === B && descendant === "refs/remotes/origin/main") || ancestor === descendant;

await test("commitRefusals refuses committing on main and allows feature branches", () => {
  assert.match(commitRefusals("refs/heads/main").join(), /Do not commit on main/);
  assert.deepEqual(commitRefusals("refs/heads/feat/x"), []);
  assert.match(commitRefusals(null).join(), /detached HEAD/);
});

await test("pushRefusals: main is never pushed, created or deleted", () => {
  for (const [local, remote] of [[B, A], [A, ZERO], [ZERO, A]] as const) {
    assert.match(pushRefusals([update("refs/heads/main", local, remote)], ancestry).join(), /pull request/);
  }
});

await test("pushRefusals: a branch push that only adds commits is allowed", () => {
  assert.deepEqual(pushRefusals([update("refs/heads/feat/x", B, A), update("refs/heads/feat/new", A, ZERO)], ancestry), []);
});

await test("pushRefusals: rewriting a published branch is refused", () => {
  assert.match(pushRefusals([update("refs/heads/feat/x", A, B)], ancestry).join(), /Refusing to rewrite refs\/heads\/feat\/x/);
});

await test("pushRefusals: deleting a branch needs its work on origin/main", () => {
  assert.deepEqual(pushRefusals([update("refs/heads/feat/done", ZERO, B)], ancestry), []);
  assert.match(pushRefusals([update("refs/heads/feat/open", ZERO, A)], ancestry).join(), /Cannot confirm refs\/heads\/feat\/open landed/);
});

await test("pushRefusals: tags and other refs pass, malformed input is refused", () => {
  assert.deepEqual(pushRefusals([update("refs/tags/v1", A, ZERO)], ancestry), []);
  assert.match(pushRefusals([update("main", A, ZERO)], ancestry).join(), /Invalid pre-push input/);
  assert.match(pushRefusals([update("refs/heads/x", "nope", ZERO)], ancestry).join(), /Invalid pre-push input/);
});
