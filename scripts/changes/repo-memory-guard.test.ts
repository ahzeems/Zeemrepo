import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main } from "./repo-memory-guard.ts";

const RECORD = "wiki/work/projects/Work.md";

function branch(t: TestContext): RepoFixture & { check(...args: string[]): { code: number; out: string; err: string } } {
  const repo = createRepo("repo-memory-guard-");
  t.after(() => repo.cleanup());
  repo.write("notes.md", "x\n");
  repo.write(RECORD, "---\nstatus: backlog\n---\n");
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  const check = (...args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
    return { code: main(args, { cwd: repo.dir, output }), out: out.join("\n"), err: err.join("\n") };
  };
  return { ...repo, check };
}

await test("a branch that records itself passes", (t) => {
  const repo = branch(t);
  repo.write("notes.md", "y\n");
  repo.write(RECORD, '---\nstatus: in-progress\nevidence:\n  - "VERIFIED: npm test passes"\n---\n');
  repo.commit("work");
  const result = repo.check();
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /records this branch/);
});

await test("a branch with no work record is refused, and --json says why", (t) => {
  const repo = branch(t);
  repo.write("notes.md", "y\n");
  repo.commit("work");
  assert.equal(repo.check().code, EXIT_REFUSED);
  const parsed: unknown = JSON.parse(repo.check("--json").out);
  assert.ok(typeof parsed === "object" && parsed !== null && "recorded" in parsed && parsed.recorded === false);
});

await test("arguments", async (t) => {
  await t.test("bad", (t) => assert.equal(branch(t).check("--bogus").code, EXIT_ERROR));
  await t.test("help", (t) => assert.match(branch(t).check("--help").out, /Usage/));
});
