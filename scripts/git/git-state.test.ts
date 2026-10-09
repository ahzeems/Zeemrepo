import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main, redactKey } from "./git-state.ts";

function run(cwd: string, args: string[], stdin = ""): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd, output, stdin }), out: out.join("\n"), err: err.join("\n") };
}

// A fresh repository per case, so a failed setup cannot leak into the next case.
function fresh(t: TestContext, commit = true): RepoFixture {
  const repo = createRepo("git-state-");
  t.after(() => repo.cleanup());
  if (commit) repo.commit("base");
  return repo;
}

function changedBy(repo: RepoFixture, change: () => void): { code: number; err: string } {
  const before = run(repo.dir, ["snapshot"]);
  assert.equal(before.code, EXIT_OK, before.err);
  change();
  return run(repo.dir, ["verify"], before.out);
}

await test("unchanged state passes, including an unborn and a detached HEAD", async (t) => {
  await t.test("with commits", (t) => assert.equal(changedBy(fresh(t), () => undefined).code, EXIT_OK));
  await t.test("unborn", (t) => assert.equal(changedBy(fresh(t, false), () => undefined).code, EXIT_OK));
  await t.test("detached", (t) => {
    const repo = fresh(t);
    repo.git(["switch", "--quiet", "--detach"]);
    assert.equal(changedBy(repo, () => undefined).code, EXIT_OK);
  });
});

await test("each kind of escape is refused and named", async (t) => {
  const cases: [string, (repo: RepoFixture) => void, RegExp][] = [
    ["a fixture commit", (repo) => repo.commit("leaked"), /HEAD moved/],
    ["a first commit on an unborn branch", (repo) => repo.commit("leaked"), /HEAD moved from \(none\)/],
    ["a branch switch", (repo) => repo.git(["switch", "--quiet", "-c", "elsewhere"]), /branch changed/],
    ["a detach", (repo) => repo.git(["switch", "--quiet", "--detach"]), /to \(detached\)/],
    ["core.bare from unset to true", (repo) => repo.git(["config", "core.bare", "true"]), /core\.bare changed from \(unset\) to true/],
    ["an added key", (repo) => repo.git(["config", "fixture.added", "x"]), /local git config changed: fixture\.added/],
    ["a removed key", (repo) => repo.git(["config", "--unset", "commit.gpgsign"]), /commit\.gpgsign/],
    ["a multi-valued key gaining a value", (repo) => repo.git(["config", "--add", "user.email", "second@example.invalid"]), /user\.email/],
    ["a value with a newline", (repo) => repo.git(["config", "user.name", "Fix\nture"]), /user\.name/],
    ["a new tag", (repo) => repo.git(["tag", "leaked"]), /refs changed/],
    ["a staged file", (repo) => { repo.write("leak.txt", "x\n"); repo.git(["add", "leak.txt"]); }, /the index changed/],
    ["an untracked file", (repo) => repo.write("leak.txt", "x\n"), /the working tree changed/],
    ["per-worktree config", (repo) => { repo.git(["config", "extensions.worktreeConfig", "true"]); repo.git(["config", "--worktree", "core.sparseCheckout", "true"]); }, /per-worktree git config changed/],
  ];
  for (const [name, change, message] of cases) {
    await t.test(name, (t) => {
      const repo = fresh(t, !name.includes("unborn"));
      if (name.startsWith("core.bare")) repo.git(["config", "--unset", "core.bare"]);
      const result = changedBy(repo, () => change(repo));
      assert.equal(result.code, EXIT_REFUSED, name);
      assert.match(result.err, message);
    });
  }
});

await test("config values never reach the output, and subsections are redacted", (t) => {
  const repo = fresh(t);
  const result = changedBy(repo, () => {
    repo.git(["config", "user.email", "leaked@example.invalid"]);
    repo.git(["config", "url.https://user:SECRET-TOKEN@example.invalid/.insteadOf", "https://example.invalid/"]);
  });
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /url\.<\.\.\.>\.insteadof/);
  assert.doesNotMatch(result.err, /leaked@|SECRET-TOKEN/);
  const snapshot = run(repo.dir, ["snapshot"]).out;
  assert.doesNotMatch(snapshot, /leaked@|SECRET-TOKEN|fixture@example/, "the snapshot holds hashes, not values");
  assert.equal(redactKey("core.bare"), "core.bare");
  assert.equal(redactKey("remote.origin.url"), "remote.<...>.url");
});

await test("malformed snapshots, bad arguments and a non-repository are errors, not passes", (t) => {
  const repo = fresh(t);
  for (const stdin of ["not a snapshot", "", "{}", '{"head":null,"branch":null,"bare":null,"config":{"a":1},"worktreeConfig":null,"refs":"","index":"","tree":""}']) {
    assert.equal(run(repo.dir, ["verify"], stdin).code, EXIT_ERROR, stdin);
  }
  assert.equal(run(repo.dir, []).code, EXIT_ERROR);
  assert.equal(run(repo.dir, ["snapshot", "extra"]).code, EXIT_ERROR);
  assert.equal(run(repo.dir, ["--help"]).code, EXIT_OK);
  const outside = mkdtempSync(join(tmpdir(), "git-state-nogit-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.throws(() => run(outside, ["snapshot"]), /rev-parse/);
});
