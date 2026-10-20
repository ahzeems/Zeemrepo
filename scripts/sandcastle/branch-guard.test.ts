import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepo } from "../test-support/repo-fixture.ts";
import { branchRefusal } from "./branch-guard.ts";

await test("branchRefusal refuses main and a detached HEAD, and allows a feature branch", () => {
  const repo = createRepo();
  try {
    repo.commit("chore: base");
    assert.match(branchRefusal(repo.dir) ?? "", /feature branch/);
    repo.git(["switch", "--quiet", "-c", "feat/x"]);
    assert.equal(branchRefusal(repo.dir), undefined);
    repo.git(["switch", "--quiet", "--detach", "HEAD"]);
    assert.match(branchRefusal(repo.dir) ?? "", /feature branch/);
  } finally {
    repo.cleanup();
  }
});
