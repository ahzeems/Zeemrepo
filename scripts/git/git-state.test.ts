import assert from "node:assert/strict";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo } from "../test-support/repo-fixture.ts";
import { main } from "./git-state.ts";

function run(cwd: string, args: string[], stdin = ""): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd, output, stdin }), out: out.join("\n"), err: err.join("\n") };
}

await test("git state around a check", async (t) => {
  const repo = createRepo("git-state-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  const snapshot = (): string => {
    const result = run(repo.dir, ["snapshot"]);
    assert.equal(result.code, EXIT_OK, result.err);
    return result.out;
  };

  await t.test("unchanged state passes", () => {
    const result = run(repo.dir, ["verify"], snapshot());
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a fixture commit that moved HEAD is refused", () => {
    const before = snapshot();
    repo.commit("leaked fixture commit");
    const result = run(repo.dir, ["verify"], before);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /HEAD moved/);
  });

  await t.test("a switched branch is refused", () => {
    const before = snapshot();
    repo.git(["switch", "--quiet", "-c", "elsewhere"]);
    const result = run(repo.dir, ["verify"], before);
    repo.git(["switch", "--quiet", "main"]);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /branch changed/);
  });

  await t.test("core.bare turned on is refused", () => {
    const before = snapshot();
    repo.git(["config", "core.bare", "true"]);
    const result = run(repo.dir, ["verify"], before);
    repo.git(["config", "--unset", "core.bare"]);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /core\.bare/);
  });

  await t.test("a changed local config value is refused, naming the key but not the value", () => {
    const before = snapshot();
    repo.git(["config", "user.email", "leaked@example.invalid"]);
    const result = run(repo.dir, ["verify"], before);
    repo.git(["config", "user.email", "fixture@example.invalid"]);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /user\.email/);
    assert.doesNotMatch(result.err, /leaked@/);
  });

  await t.test("a malformed snapshot and bad arguments are errors, not passes", () => {
    assert.equal(run(repo.dir, ["verify"], "not a snapshot").code, EXIT_ERROR);
    assert.equal(run(repo.dir, ["verify"], "").code, EXIT_ERROR);
    assert.equal(run(repo.dir, []).code, EXIT_ERROR);
    assert.equal(run(repo.dir, ["snapshot", "extra"]).code, EXIT_ERROR);
    assert.equal(run(repo.dir, ["--help"]).code, EXIT_OK);
  });
});
