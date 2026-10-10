import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main, spawnRunner, type Run } from "./pr-ready.ts";
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
type Outcomes = { check?: number; prView?: string; ghAuth?: number; ghUser?: string };

function runner(repo: RepoFixture, outcomes: Outcomes = {}): { run: Run; calls: (Call & { inherit: boolean; env: Record<string, string> })[] } {
  const calls: (Call & { inherit: boolean; env: Record<string, string> })[] = [];
  const run: Run = (command, args, options = {}) => {
    calls.push({ command, args, inherit: options.inherit === true, env: options.env ?? {} });
    if (command === "npm") return { status: outcomes.check ?? 0, stdout: "" };
    if (command === "gh" && args[0] === "auth") return { status: outcomes.ghAuth ?? 0, stdout: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "user") return { status: 0, stdout: `${outcomes.ghUser ?? "machine-bot"}\n` };
    if (command === "gh" && args[0] === "repo" && args[1] === "view") return { status: 0, stdout: "repo-owner\n" };
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
  assert.match(result.err, /hooks are not installed/);
  const check = calls.find((call) => call.command === "npm" && call.args.join(" ") === "run check");
  assert.ok(check?.inherit, "npm run check streams its output to the terminal");
  const push = calls.find((call) => call.command === "git" && call.args.join(" ") === "push --set-upstream origin feat/x");
  assert.ok(push, "pushes the branch");
  assert.equal(push.env.PR_READY_CHECKED, repo.git(["rev-parse", "HEAD"]), "tells the pre-push hook this commit was just checked");
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

await test("a closed or merged PR for the branch does not count as open", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { prView: JSON.stringify({ url: "https://github.com/o/r/pull/3", state: "CLOSED" }) });
  assert.equal(go(repo, run).code, EXIT_OK);
  assert.ok(calls.some((call) => call.command === "gh" && call.args[1] === "create"));
});

await test("gh is checked before anything is pushed", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { ghAuth: 1 });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /gh auth login/);
  assert.ok(!calls.some((call) => call.args[0] === "push"));
});

await test("gh logged in as the repository owner is refused before anything is pushed", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { ghUser: "repo-owner" });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /machine account/);
  assert.ok(!calls.some((call) => call.args[0] === "push"), "nothing is pushed under the owner's login");
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
  await t.test("nothing to merge", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "-c", "feat/empty", "refs/remotes/origin/main"]);
    const result = go(repo, runner(repo).run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /no commits that are not on main/);
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

await test("a step that hangs is stopped, and config injected through GIT_ variables does not reach it", () => {
  const started = Date.now();
  assert.throws(() => spawnRunner(undefined, 200)("sh", ["-c", "sleep 10"]), /ETIMEDOUT|timed out/i);
  assert.ok(Date.now() - started < 5000, "npm run pr does not wait for a stalled push or gh");
  const saved = process.env.GIT_CONFIG_COUNT;
  process.env.GIT_CONFIG_COUNT = "1";
  try {
    assert.equal(spawnRunner(undefined)("sh", ["-c", "printf %s \"${GIT_CONFIG_COUNT:-unset}\""]).stdout, "unset");
  } finally {
    if (saved === undefined) delete process.env.GIT_CONFIG_COUNT;
    else process.env.GIT_CONFIG_COUNT = saved;
  }
});
