import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo } from "../test-support/repo-fixture.ts";
import { main } from "./worktree-guard.ts";

function run(cwd: string, args: string[] = []): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd, output }), out: out.join("\n"), err: err.join("\n") };
}

await test("worktree guard", async (t) => {
  const repo = createRepo("worktree-guard-");
  t.after(() => repo.cleanup());
  const base = repo.commit("base");
  repo.git(["update-ref", "refs/remotes/origin/main", base]);

  await t.test("a pushed, clean checkout is safe", () => {
    const result = run(repo.dir);
    assert.equal(result.code, EXIT_OK, result.err);
    assert.match(result.out, /every worktree is committed and pushed/);
  });

  await t.test("uncommitted and unpushed work in another worktree is reported", () => {
    const other = join(repo.dir, ".worktrees", "feat");
    repo.git(["worktree", "add", "--quiet", "-b", "feat", other]);
    repo.write(".worktrees/feat/new.md", "draft\n");
    const result = run(repo.dir);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /feat: 1 uncommitted file\(s\)/);
  });

  await t.test("--json and arguments", () => {
    const parsed: unknown = JSON.parse(run(repo.dir, ["--json"]).out);
    assert.ok(typeof parsed === "object" && parsed !== null && "safe" in parsed && parsed.safe === false);
    assert.equal(run(repo.dir, ["--bogus"]).code, EXIT_ERROR);
    assert.equal(run(repo.dir, ["--help"]).code, EXIT_OK);
  });
});
