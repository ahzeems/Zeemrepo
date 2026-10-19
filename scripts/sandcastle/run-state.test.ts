import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { defaultStateStore, loadState, saveState, stateKey, supersede, type IssueState } from "./run-state.ts";

const REPOSITORY = "Zimfra/software_testing";
const TASK = "issue-42";
const A = "a".repeat(40);
const B = "b".repeat(40);
const DIGEST = "c".repeat(64);

function store(t: TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), "run-state-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const state = (overrides: Partial<IssueState> = {}): IssueState => ({
  version: 1,
  inputs: { repository: REPOSITORY, task: TASK, taskSha256: DIGEST, base: A, ref: `refs/heads/sandcastle/${TASK}`, candidate: B, manifestSha256: DIGEST },
  artifacts: "/var/tmp/artifacts", verification: null, publication: null, notification: null, ...overrides,
});

const file = (dir: string): string => join(dir, `${stateKey(REPOSITORY, TASK)}.json`);

function refused(dir: string, pattern: RegExp): void {
  const loaded = loadState(dir, REPOSITORY, TASK);
  assert.ok("refusals" in loaded, "the state is refused");
  assert.match(loaded.refusals.join("\n"), pattern);
}

await test("a saved state reads back exactly, private to this user, and no state reads as none", (t) => {
  const dir = store(t);
  assert.deepEqual(loadState(dir, REPOSITORY, TASK), { state: null });
  const saved = state({ verification: { receipt: DIGEST, run: "run-1", outcome: "passed" }, publication: { status: "delivered", url: "https://github.com/Zimfra/software_testing/pull/7" }, notification: { status: "attempted" } });
  saveState(dir, saved);
  assert.deepEqual(loadState(dir, REPOSITORY, TASK), { state: saved });
  assert.equal(statSync(file(dir)).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(dir), [`${stateKey(REPOSITORY, TASK)}.json`], "no temporary file is left behind");
  assert.notEqual(stateKey(REPOSITORY, TASK), stateKey(REPOSITORY, "issue-43"), "each issue has its own state");
});

await test("a save replaces the state file by rename, so a crash mid-write leaves the earlier state readable", (t) => {
  const dir = store(t);
  const first = state();
  saveState(dir, first);
  const before = statSync(file(dir)).ino;
  writeFileSync(`${file(dir)}.0badc0ffee12.tmp`, '{"version":1,"inpu');
  assert.deepEqual(loadState(dir, REPOSITORY, TASK), { state: first }, "a torn temporary file is never read");
  const second = state({ verification: { receipt: DIGEST, run: "run-1", outcome: "failed" } });
  saveState(dir, second);
  assert.notEqual(statSync(file(dir)).ino, before, "the file was replaced, not rewritten in place");
  assert.deepEqual(loadState(dir, REPOSITORY, TASK), { state: second });
});

await test("malformed, incompatible, foreign or loosely held state fails closed and is kept as it was", (t) => {
  const dir = store(t);
  writeFileSync(file(dir), "{not json", { mode: 0o600 });
  refused(dir, /not valid JSON/);
  assert.equal(readFileSync(file(dir), "utf8"), "{not json", "the bad state is kept for inspection");
  writeFileSync(file(dir), JSON.stringify({ ...state(), version: 2 }));
  refused(dir, /version 2.*only version 1/);
  writeFileSync(file(dir), JSON.stringify(state({ inputs: { ...state().inputs, task: "issue-43" } })));
  refused(dir, /names repository Zimfra\/software_testing task issue-43/);
  writeFileSync(file(dir), JSON.stringify({ ...state(), extra: true }));
  refused(dir, /unknown key extra/);
  writeFileSync(file(dir), JSON.stringify(state({ verification: { receipt: "nope", run: "run-1", outcome: "passed" } })));
  refused(dir, /verification/);
  writeFileSync(file(dir), JSON.stringify({ ...state(), publication: { status: "delivered" } }));
  refused(dir, /publication/);
  writeFileSync(file(dir), JSON.stringify({ ...state(), notification: { status: "sent", url: "x" } }));
  refused(dir, /notification/);
  writeFileSync(file(dir), JSON.stringify({ ...state(), inputs: { ...state().inputs, candidate: "HEAD" } }));
  refused(dir, /inputs/);
  writeFileSync(file(dir), JSON.stringify(state()));
  chmodSync(file(dir), 0o666);
  refused(dir, /writable by another user/);
});

await test("superseded state is moved aside and kept, so changed inputs start clean without losing history", (t) => {
  const dir = store(t);
  saveState(dir, state());
  const kept = supersede(dir, state());
  assert.deepEqual(loadState(dir, REPOSITORY, TASK), { state: null });
  assert.ok(kept.startsWith(dir) && kept.endsWith(".superseded.json"), kept);
  assert.deepEqual(JSON.parse(readFileSync(kept, "utf8")), state());
});

await test("the default store is a private host directory beside the receipt store", () => {
  assert.equal(defaultStateStore({ XDG_STATE_HOME: "/state" }, "/home/agent"), "/state/zeemrepo/run-state");
  assert.equal(defaultStateStore({ XDG_STATE_HOME: "relative" }, "/home/agent"), "/home/agent/.local/state/zeemrepo/run-state");
});

await test("a save removes this issue's stale temporary files, and only regular files with that name", (t) => {
  const dir = store(t);
  const outside = store(t);
  writeFileSync(join(outside, "target"), "keep");
  const stale = `${file(dir)}.0123456789ab.tmp`;
  const link = `${file(dir)}.ba9876543210.tmp`;
  const other = `${join(dir, stateKey(REPOSITORY, "issue-43"))}.json.0123456789ab.tmp`;
  writeFileSync(stale, '{"torn');
  symlinkSync(join(outside, "target"), link);
  writeFileSync(other, "another issue's write");
  saveState(dir, state());
  assert.ok(!existsSync(stale), "the stale temporary file is gone");
  assert.ok(lstatSync(link).isSymbolicLink(), "a link with the same name pattern is left alone");
  assert.equal(readFileSync(join(outside, "target"), "utf8"), "keep", "nothing outside the store is touched");
  assert.ok(existsSync(other), "another issue's temporary file is left alone");
});

