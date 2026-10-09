import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main, type Run } from "./pr-ready.ts";
import { execFileSync, spawnSync } from "node:child_process";

type Call = { command: string; args: readonly string[] };

function fixture(t: TestContext): RepoFixture {
  const repo = createRepo("pr-ready-");
  const remote = mkdtempSync(join(tmpdir(), "pr-ready-remote-"));
  t.after(() => { repo.cleanup(); rmSync(remote, { recursive: true, force: true }); });
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  repo.commit("base");
  repo.git(["remote", "add", "origin", remote]);
  repo.git(["push", "--quiet", "origin", "main"]);
  repo.git(["fetch", "--quiet", "origin"]);
  repo.git(["switch", "--quiet", "-c", "feat/x"]);
  repo.write("a.md", "work\n");
  repo.commit("feat: work");
  return repo;
}

// npm and gh are faked; git runs for real against the fixture and its bare remote.
function runner(repo: RepoFixture, outcomes: { check?: number; prView?: string } = {}): { run: Run; calls: Call[] } {
  const calls: Call[] = [];
  const run: Run = (command, args) => {
    calls.push({ command, args });
    if (command === "npm") return { status: outcomes.check ?? 0, stdout: "" };
    if (command === "gh" && args[1] === "view") return outcomes.prView === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: outcomes.prView };
    if (command === "gh" && args[1] === "create") return { status: 0, stdout: "https://github.com/o/r/pull/7\n" };
    if (command === "git") {
      const result = spawnSync("git", args, { cwd: repo.dir, env: cleanGitEnv, encoding: "utf8" });
      return { status: result.status, stdout: result.stdout };
    }
    throw new Error(`unexpected ${command}`);
  };
  return { run, calls };
}

function go(repo: RepoFixture, run: Run, args: string[] = []): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { cwd: repo.dir, output, run }), out: out.join("\n"), err: err.join("\n") };
}

await test("a ready branch is checked, pushed and gets a PR, and nothing merges", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /https:\/\/github\.com\/o\/r\/pull\/7/);
  assert.match(result.out, /the owner merges/);
  assert.ok(calls.some((call) => call.command === "npm" && call.args.join(" ") === "run check"));
  assert.ok(calls.some((call) => call.command === "git" && call.args.join(" ") === "push --set-upstream origin feat/x"));
  assert.ok(!calls.some((call) => call.args.includes("merge") && call.command === "gh"), "never merges");
});

await test("an existing open PR is reported, not duplicated", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { prView: JSON.stringify({ url: "https://github.com/o/r/pull/3", state: "OPEN" }) });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /pull\/3/);
  assert.ok(!calls.some((call) => call.command === "gh" && call.args[1] === "create"));
});

await test("--dry-run checks but does not push or open a PR", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo);
  assert.equal(go(repo, run, ["--dry-run"]).code, EXIT_OK);
  assert.ok(!calls.some((call) => call.args[0] === "push" || call.command === "gh"));
});

await test("refusals stop before pushing", async (t) => {
  await t.test("on main", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "main"]);
    const result = go(repo, runner(repo).run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /feature branch/);
  });
  await t.test("uncommitted changes", (t) => {
    const repo = fixture(t);
    repo.write("dirty.md", "x\n");
    assert.match(go(repo, runner(repo).run).err, /uncommitted/);
  });
  await t.test("branch behind origin/main", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "main"]);
    repo.write("b.md", "main moved\n");
    repo.commit("main moves");
    repo.git(["push", "--quiet", "origin", "main"]);
    repo.git(["switch", "--quiet", "feat/x"]);
    const result = go(repo, runner(repo).run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /merge origin\/main into this branch/);
  });
  await t.test("failing checks", (t) => {
    const repo = fixture(t);
    const { run, calls } = runner(repo, { check: 1 });
    const result = go(repo, run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /npm run check failed/);
    assert.ok(!calls.some((call) => call.args[0] === "push"));
  });
});

await test("arguments", (t) => {
  const repo = fixture(t);
  assert.equal(go(repo, runner(repo).run, ["--bogus"]).code, EXIT_ERROR);
  assert.match(go(repo, runner(repo).run, ["--help"]).out, /Usage/);
});
