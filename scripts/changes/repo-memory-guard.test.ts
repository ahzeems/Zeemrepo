import assert from "node:assert/strict";
import { join } from "node:path";
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

await test("renaming a work record does not make its old evidence new", (t) => {
  const repo = createRepo("repo-memory-rename-");
  t.after(() => repo.cleanup());
  repo.write("notes.md", "x\n");
  repo.write("wiki/work/projects/Old name.md", '---\nstatus: backlog\nevidence:\n  - "VERIFIED: an old result"\n---\nBody text that stays the same for rename detection.\n'.repeat(1));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.git(["mv", "wiki/work/projects/Old name.md", "wiki/work/projects/New name.md"]);
  repo.write("notes.md", "y\n");
  repo.git(["add", "--all"]);
  const out: string[] = [];
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: (line) => out.push(line), warn: (line) => err.push(line) } });
  assert.equal(code, EXIT_REFUSED);
  assert.match(err.join("\n"), /gains no VERIFIED: or OWNER DECISION: evidence/);
});

await test("a work record path is recognised in any letter case", (t) => {
  const repo = createRepo("repo-memory-case-");
  t.after(() => repo.cleanup());
  repo.write("notes.md", "x\n");
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.write("notes.md", "y\n");
  repo.write("Wiki/Work/projects/Work.md", '---\nstatus: in-progress\nevidence:\n  - "VERIFIED: npm test passes"\n---\n');
  repo.git(["add", "--all"]);
  const out: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: (line) => out.push(line), warn: () => undefined } });
  assert.equal(code, EXIT_OK);
});

await test("run from a subdirectory, the guard still reads the work records", async (t) => {
  const repo = branch(t);
  repo.write("notes.md", "y\n");
  repo.write(RECORD, '---\nstatus: in-progress\nevidence:\n  - "VERIFIED: npm test passes"\n---\n');
  repo.commit("work");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(repo.dir, "sub"));
  const code = main([], { cwd: join(repo.dir, "sub"), output: { write: () => undefined, warn: () => undefined } });
  assert.equal(code, EXIT_OK);
});
