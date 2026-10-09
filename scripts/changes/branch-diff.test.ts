import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepo } from "../test-support/repo-fixture.ts";
import { addedLines, branchBase, changedSince } from "./branch-diff.ts";

await test("branch diff", async (t) => {
  const repo = createRepo("branch-diff-");
  t.after(() => repo.cleanup());
  repo.write("a.md", "one\n");
  repo.write("old/name.md", "x\n".repeat(20));
  const base = repo.commit("base");
  repo.git(["update-ref", "refs/remotes/origin/main", base]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.write("a.md", "one\ntwo\n");
  repo.commit("committed change");
  repo.write("new/.keep", "");
  repo.git(["add", "new/.keep"]);
  repo.git(["mv", "old/name.md", "new/name.md"]);

  await t.test("branchBase is the fork point with its UTC date", () => {
    const found = branchBase({ cwd: repo.dir });
    assert.equal(found.sha, base);
    assert.match(found.date, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("changedSince covers commits and the index, both sides of a rename", () => {
    assert.deepEqual(changedSince(base, { cwd: repo.dir }).sort(), ["a.md", "new/.keep", "new/name.md", "old/name.md"]);
  });

  await t.test("addedLines returns only added lines of the named paths", () => {
    assert.deepEqual(addedLines(base, ["a.md"], { cwd: repo.dir }), ["two"]);
    assert.deepEqual(addedLines(base, [], { cwd: repo.dir }), []);
  });
});
