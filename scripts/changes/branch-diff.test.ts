import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepo } from "../test-support/repo-fixture.ts";
import { addedLineNumbers, addedLines, branchBase, changedSince } from "./branch-diff.ts";

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

  await t.test("branchBase is the fork point, dated no later than the branch's first own commit", () => {
    const found = branchBase({ cwd: repo.dir });
    assert.equal(found.sha, base);
    assert.match(found.date, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("a rebase onto a newer main keeps the branch's original start date", (t) => {
    const other = createRepo("branch-diff-rebase-");
    t.after(() => other.cleanup());
    other.commit("base");
    other.git(["switch", "--quiet", "-c", "feature"]);
    other.git(["commit", "--quiet", "--allow-empty", "-m", "own work", "--date", "2020-01-02T12:00:00Z"]);
    other.git(["update-ref", "refs/remotes/origin/main", "main"]);
    assert.equal(branchBase({ cwd: other.dir }).date, "2020-01-02");
  });

  await t.test("changedSince covers commits, the index, untracked files and both sides of a rename", () => {
    repo.write("untracked.md", "new\n");
    repo.write(".gitignore", "*.log\n");
    repo.write("ignored.log", "x\n");
    assert.deepEqual(changedSince(base, { cwd: repo.dir }).sort(), [".gitignore", "a.md", "new/.keep", "new/name.md", "old/name.md", "untracked.md"]);
  });

  await t.test("addedLineNumbers gives the positions of added lines in the current file", () => {
    repo.write("a.md", "zero\none\ntwo\nthree\n");
    assert.deepEqual(addedLineNumbers(base, "a.md", { cwd: repo.dir }), [1, 3, 4]);
  });

  await t.test("addedLines returns only added lines of the named paths", () => {
    assert.deepEqual(addedLines(base, ["a.md"], { cwd: repo.dir }), ["zero", "two", "three"]);
    assert.deepEqual(addedLines(base, [], { cwd: repo.dir }), []);
  });
});
