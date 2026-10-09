import assert from "node:assert/strict";
import { test } from "node:test";
import { countLines, describeRisk, parseWorktrees } from "./worktree-validation.ts";

await test("parseWorktrees reads porcelain -z records, including bare ones", () => {
  const porcelain = "worktree /repo\0HEAD abc\0branch refs/heads/main\0\0worktree /bare\0bare\0\0";
  assert.deepEqual(parseWorktrees(porcelain), [{ path: "/repo", bare: false }, { path: "/bare", bare: true }]);
});

await test("parseWorktrees refuses incomplete or inconsistent output", () => {
  for (const bad of ["", "worktree /repo\0HEAD abc\0", "worktree /repo\0\0", "worktree /b\0bare\0HEAD abc\0\0", "nope\0HEAD abc\0\0"]) {
    assert.throws(() => parseWorktrees(bad), /worktree porcelain/, JSON.stringify(bad));
  }
});

await test("countLines and describeRisk", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a\nb\n"), 2);
  assert.equal(describeRisk({ path: "/w", uncommitted: 2, unpushed: 1 }), "/w: 2 uncommitted file(s), 1 unpushed commit(s)");
});
