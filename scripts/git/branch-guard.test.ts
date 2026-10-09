import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main, parsePushInput } from "./branch-guard.ts";

function run(repo: RepoFixture, args: string[], stdin = ""): { code: number; err: string } {
  const err: string[] = [];
  const output: Output = { write: () => undefined, warn: (line) => err.push(line) };
  return { code: main(args, { cwd: repo.dir, output, stdin }), err: err.join("\n") };
}

function repo(t: TestContext): RepoFixture {
  const fixture = createRepo("branch-guard-");
  t.after(() => fixture.cleanup());
  return fixture;
}

await test("commit mode refuses main and allows a feature branch", (t) => {
  const fixture = repo(t);
  fixture.commit("base");
  assert.equal(run(fixture, ["commit"]).code, EXIT_REFUSED);
  fixture.git(["switch", "--quiet", "-c", "feat/x"]);
  assert.equal(run(fixture, ["commit"]).code, EXIT_OK);
});

await test("push mode reads git's pre-push lines and checks real ancestry", (t) => {
  const fixture = repo(t);
  const base = fixture.commit("base");
  fixture.git(["update-ref", "refs/remotes/origin/main", base]);
  fixture.git(["switch", "--quiet", "-c", "feat/x"]);
  const head = fixture.commit("work");
  assert.equal(run(fixture, ["push"], `refs/heads/feat/x ${head} refs/heads/feat/x ${base}\n`).code, EXIT_OK);
  const refused = run(fixture, ["push"], `refs/heads/feat/x ${head} refs/heads/main ${base}\n`);
  assert.equal(refused.code, EXIT_REFUSED);
  assert.match(refused.err, /pull request/);
});

await test("push mode judges every ref in one push", (t) => {
  const fixture = repo(t);
  const base = fixture.commit("base");
  fixture.git(["update-ref", "refs/remotes/origin/main", base]);
  fixture.git(["switch", "--quiet", "-c", "feat/x"]);
  const head = fixture.commit("work");
  const zero = "0".repeat(40);
  const result = run(fixture, ["push"], `refs/heads/feat/x ${head} refs/heads/feat/x ${base}\nrefs/tags/v1 ${head} refs/tags/v1 ${zero}\nrefs/heads/feat/x ${head} refs/heads/main ${base}\n`);
  assert.equal(result.code, EXIT_REFUSED);
  assert.equal(result.err.split("\n").length, 1, "only the main update is refused");
});

await test("commit mode refuses a detached HEAD in a real checkout", (t) => {
  const fixture = repo(t);
  const base = fixture.commit("base");
  fixture.git(["switch", "--quiet", "--detach", base]);
  assert.match(run(fixture, ["commit"]).err, /detached HEAD/);
});

await test("parsePushInput splits lines and ignores blanks", () => {
  assert.deepEqual(parsePushInput("a b c d\n\n"), [{ localRef: "a", localOid: "b", remoteRef: "c", remoteOid: "d" }]);
  assert.deepEqual(parsePushInput("a b c\n"), [{ localRef: "a", localOid: "b", remoteRef: "c", remoteOid: "" }]);
});

await test("arguments", async (t) => {
  await t.test("bad mode", (t) => assert.equal(run(repo(t), ["sideways"]).code, EXIT_ERROR));
  await t.test("help", (t) => assert.equal(run(repo(t), ["--help"]).code, EXIT_OK));
});
