import assert from "node:assert/strict";
import { copyFileSync, lstatSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main, spawnRunner, type Run } from "./pr-ready.ts";
import { execFileSync, spawnSync } from "node:child_process";

type Call = { command: string; args: readonly string[] };

function fixture(t: TestContext, codeowners?: string): RepoFixture {
  const repo = createRepo("pr-ready-");
  const remote = mkdtempSync(join(tmpdir(), "pr-ready-remote-"));
  t.after(() => { repo.cleanup(); rmSync(remote, { recursive: true, force: true }); });
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  if (codeowners !== undefined) repo.write(".github/CODEOWNERS", codeowners);
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
// onCheck runs inside the faked npm run check, as a test that escaped its fixture would.
type Outcomes = { check?: number; prView?: string; ghAuth?: number; ghUser?: string; onCheck?: () => void };

function runner(repo: RepoFixture, outcomes: Outcomes = {}): { run: Run; calls: (Call & { inherit: boolean; env: Record<string, string> })[] } {
  const calls: (Call & { inherit: boolean; env: Record<string, string> })[] = [];
  const run: Run = (command, args, options = {}) => {
    calls.push({ command, args, inherit: options.inherit === true, env: options.env ?? {} });
    if (command === "npm") {
      outcomes.onCheck?.();
      return { status: outcomes.check ?? 0, stdout: "" };
    }
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
  const checked = repo.git(["rev-parse", "HEAD"]);
  const push = calls.find((call) => call.command === "git" && call.args[0] === "push");
  assert.deepEqual(push?.args, ["push", "origin", `${checked}:refs/heads/feat/x`], "pushes exactly the checked commit to the branch");
  assert.equal(push.env.PR_READY_CHECKED, checked, "tells the pre-push hook this commit was just checked");
  assert.equal(repo.git(["config", "--get", "branch.feat/x.merge"]), "refs/heads/feat/x", "the branch tracks its pushed copy");
  assert.ok(!calls.some((call) => call.args.includes("merge") && call.command === "gh"), "never merges");
});

// Each class of state git-state compares, changed by what runs as npm run check.
const MUTATIONS: [string, (repo: RepoFixture) => void, RegExp][] = [
  ["a commit", (repo) => { repo.write("b.md", "replacement\n"); repo.commit("replacement"); }, /HEAD moved/],
  ["a branch switch", (repo) => repo.git(["switch", "--quiet", "-c", "other"]), /checked-out branch changed/],
  ["a new ref", (repo) => repo.git(["tag", "planted"]), /refs changed/],
  ["local config", (repo) => repo.git(["config", "fixture.planted", "yes"]), /local git config changed: fixture\.planted/],
  ["a staged file", (repo) => { repo.write("staged.md", "x\n"); repo.git(["add", "staged.md"]); }, /the index changed/],
  ["a working-tree file", (repo) => repo.write("untracked.md", "x\n"), /the working tree changed/],
];

await test("a check that changes git state is refused before anything is pushed, whether it passed or failed", async (t) => {
  for (const check of [0, 1]) {
    for (const [name, mutate, named] of MUTATIONS) {
      await t.test(`${name}, check exit ${String(check)}`, (t) => {
        const repo = fixture(t);
        const { run, calls } = runner(repo, { check, onCheck: () => mutate(repo) });
        const result = go(repo, run);
        assert.equal(result.code, EXIT_REFUSED);
        assert.match(result.err, named);
        assert.match(result.err, /changed this repository's git state/);
        if (check !== 0) assert.match(result.err, /npm run check failed/);
        assert.ok(!calls.some((call) => call.args[0] === "push"), "nothing is pushed");
        assert.ok(!calls.some((call) => call.command === "gh"), "no pull request is opened");
      });
    }
  }
});

await test("a check that commits and passes never certifies the replacement commit", (t) => {
  const repo = fixture(t);
  const checked = repo.git(["rev-parse", "HEAD"]);
  const { run, calls } = runner(repo, { onCheck: () => { repo.write("b.md", "replacement\n"); repo.commit("replacement"); } });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, new RegExp(`HEAD moved from ${checked}`));
  assert.ok(!calls.some((call) => call.env.PR_READY_CHECKED !== undefined), "no commit is handed to the hook as checked");
});

await test("a state refusal names what changed without printing config values, subsections or file contents", (t) => {
  const repo = fixture(t);
  const { run } = runner(repo, { onCheck: () => {
    repo.git(["config", "remote.https://token-SUBSECTION-XYZ@example.invalid/r.url", "VALUE-SECRET-XYZ"]);
    repo.write("leak.md", "CONTENT-SECRET-XYZ\n");
  } });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /local git config changed: remote\.<\.\.\.>\.url/);
  assert.match(result.err, /the working tree changed/);
  for (const secret of ["SUBSECTION-XYZ", "VALUE-SECRET-XYZ", "CONTENT-SECRET-XYZ"]) assert.ok(!result.err.includes(secret), secret);
});

await test("a checkout that fetches only main still pushes the checked commit, tracks it and opens the PR", (t) => {
  const repo = fixture(t);
  repo.git(["config", "remote.origin.fetch", "+refs/heads/main:refs/remotes/origin/main"]);
  const { run, calls } = runner(repo);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.ok(calls.some((call) => call.command === "gh" && call.args[1] === "create"), "the pull request is opened");
  assert.equal(repo.git(["config", "--get", "branch.feat/x.remote"]), "origin");
  assert.equal(repo.git(["config", "--get", "branch.feat/x.merge"]), "refs/heads/feat/x");
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

await test("gh logged in as a code owner named in CODEOWNERS is refused before anything is pushed", async (t) => {
  const owners = "# only the owner approves\n* @Human-Owner @org/reviewers someone@example.invalid\n/docs/ @second-owner\n";
  for (const user of ["human-owner", "Second-Owner"]) {
    await t.test(user, (t) => {
      const repo = fixture(t, owners);
      const { run, calls } = runner(repo, { ghUser: user });
      const result = go(repo, run);
      assert.equal(result.code, EXIT_REFUSED);
      assert.match(result.err, /code owner/);
      assert.match(result.err, /machine account/);
      assert.ok(!calls.some((call) => call.args[0] === "push"), "nothing is pushed under a code owner's login");
      assert.ok(!calls.some((call) => call.command === "gh" && call.args[1] === "create"));
    });
  }
  await t.test("a branch cannot edit CODEOWNERS to get past the refusal", (t) => {
    const repo = fixture(t, owners);
    repo.write(".github/CODEOWNERS", "* @someone-else\n");
    repo.commit("chore: edit owners");
    assert.equal(go(repo, runner(repo, { ghUser: "human-owner" }).run).code, EXIT_REFUSED);
  });
  await t.test("a user who is both the repository owner and a code owner gets both reasons", (t) => {
    const repo = fixture(t, "* @repo-owner\n");
    const both = go(repo, runner(repo, { ghUser: "repo-owner" }).run);
    assert.equal(both.code, EXIT_REFUSED);
    assert.match(both.err, /repository owner/);
    assert.match(both.err, /code owner/);
  });
});

await test("a login that is not a code owner, or no usable CODEOWNERS, is not refused", async (t) => {
  const cases: [string, string | undefined][] = [
    ["a different login", "* @human-owner\n"],
    ["no CODEOWNERS file", undefined],
    ["only comments, a team and an email", "# nothing\n* @org/team me@example.invalid\n"],
    ["a login that only contains an owner's name", "* @machine\n"],
    ["a comment line that names the login", "# ping @machine-bot\n* @human-owner\n"],
    ["an inline comment that names the login", "* @human-owner # cc @machine-bot\n"],
  ];
  for (const [name, codeowners] of cases) {
    await t.test(name, (t) => {
      const repo = fixture(t, codeowners);
      const result = go(repo, runner(repo, { ghUser: "machine-bot" }).run);
      assert.equal(result.code, EXIT_OK, result.err);
    });
  }
});

await test("a CODEOWNERS file that cannot be read fails closed instead of skipping the refusal", (t) => {
  const repo = fixture(t, "* @human-owner\n");
  const base = runner(repo, { ghUser: "human-owner" });
  const run: Run = (command, args, options) =>
    command === "git" && args[0] === "ls-tree" ? { status: 128, stdout: "" } : base.run(command, args, options);
  assert.throws(() => go(repo, run), /ls-tree/);
  assert.ok(!base.calls.some((call) => call.args[0] === "push"), "nothing is pushed when the owners cannot be read");
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

// Mode and bytes of every path under `root`, .git included: HEAD, refs, config, index and files.
function treeState(root: string): Record<string, string> {
  const state: Record<string, string> = {};
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    const content = entry.isSymbolicLink() ? readlinkSync(path) : entry.isFile() ? readFileSync(path).toString("base64") : "";
    state[relative(root, path)] = `${lstatSync(path).mode}:${content}`;
  }
  return state;
}

function withEnv<T>(variables: Record<string, string>, body: () => T): T {
  const saved = Object.fromEntries(Object.keys(variables).map((key) => [key, process.env[key]]));
  Object.assign(process.env, variables);
  try {
    return body();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// What a hook or a parent session leaves behind: routing toward a decoy, plus injected config.
function withDecoyRouting<T>(decoy: string, body: () => T): T {
  return withEnv({
    GIT_DIR: join(decoy, ".git"), GIT_WORK_TREE: decoy, GIT_INDEX_FILE: join(decoy, ".git", "index"),
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "fixture.injected", GIT_CONFIG_VALUE_0: "yes",
  }, body);
}

await test("an explicit cwd with nothing inherited acts on that checkout", (t) => {
  const selected = createRepo("pr-ready-plain-");
  t.after(() => selected.cleanup());
  selected.commit("plain");
  assert.equal(spawnRunner(selected.dir)("git", ["rev-parse", "--show-toplevel"]).stdout.trim(), realpathSync(selected.dir));
});

await test("an explicit cwd is the checkout git, node and npm act on, whatever routing is inherited", (t) => {
  const selected = createRepo("pr-ready-selected-");
  const decoy = createRepo("pr-ready-decoy-");
  t.after(() => { selected.cleanup(); decoy.cleanup(); });
  selected.commit("selected");
  decoy.commit("decoy");
  const before = treeState(decoy.dir);
  const toplevel = (command: string, args: string[]) => withDecoyRouting(decoy.dir, () => spawnRunner(selected.dir)(command, args).stdout.trim());
  assert.equal(toplevel("git", ["rev-parse", "--show-toplevel"]), realpathSync(selected.dir), "git");
  assert.equal(toplevel("node", ["-e", "process.stdout.write(require('node:child_process').execFileSync('git', ['rev-parse', '--show-toplevel']))"]),
    realpathSync(selected.dir), "a git launched by node");
  assert.equal(toplevel("npm", ["exec", "--yes=false", "-c", "git rev-parse --show-toplevel"]), realpathSync(selected.dir), "a git launched by npm");
  withDecoyRouting(decoy.dir, () => {
    const run = spawnRunner(selected.dir);
    assert.equal(run("git", ["config", "fixture.marker", "set"]).status, 0);
    assert.equal(run("sh", ["-c", "printf x > made.txt && git add made.txt"]).status, 0);
    assert.equal(run("git", ["config", "--get", "fixture.injected"]).status, 1, "injected config does not reach the command");
  });
  assert.deepEqual(treeState(decoy.dir), before, "the decoy's HEAD, refs, config, index and files are unchanged");
  assert.equal(selected.git(["config", "--get", "fixture.marker"]), "set");
  assert.equal(selected.git(["diff", "--cached", "--name-only"]), "made.txt");
});

// A hooked repository whose history three injected variables could each rewrite: a graft file
// that cuts HEAD's parent, a replace-ref base under refs/alt/, and turning off its real
// refs/replace/ entry. Its alternate index holds a staged file, as a pre-commit hook's does.
function hookedRepository(t: TestContext): { dir: string; index: string; graft: string; clean: string } {
  const repo = createRepo("pr-ready-hooked-");
  t.after(() => repo.cleanup());
  repo.commit("first");
  const first = repo.git(["rev-parse", "HEAD"]);
  repo.commit("second");
  const second = repo.git(["rev-parse", "HEAD"]);
  const altFirst = repo.git(["commit-tree", `${first}^{tree}`, "-m", "alt-first"]);
  repo.git(["update-ref", `refs/replace/${first}`, altFirst]);
  repo.git(["update-ref", `refs/alt/${second}`, first]);
  const graft = join(repo.dir, ".git", "test-grafts");
  writeFileSync(graft, `${second}\n`);
  repo.write("staged.txt", "staged\n");
  repo.git(["add", "staged.txt"]);
  const index = join(repo.dir, ".git", "alt-index");
  copyFileSync(join(repo.dir, ".git", "index"), index);
  repo.git(["reset", "--quiet"]);
  return { dir: repo.dir, index, graft, clean: repo.git(["log", "--format=%s"]) };
}

await test("without a cwd git runs in the hook's repository and index, and injected history is dropped", (t) => {
  const hooked = hookedRepository(t);
  const routing = { GIT_DIR: join(hooked.dir, ".git"), GIT_WORK_TREE: hooked.dir, GIT_INDEX_FILE: hooked.index };
  const log = (injected: Record<string, string>) => withEnv({ ...routing, ...injected }, () =>
    spawnRunner(undefined)("git", ["log", "--format=%s"]).stdout.trim());
  assert.equal(hooked.clean, "second\nalt-first", "the repository's own replace ref applies");
  withEnv(routing, () => {
    const run = spawnRunner(undefined);
    assert.equal(run("git", ["rev-parse", "--absolute-git-dir"]).stdout.trim(), realpathSync(join(hooked.dir, ".git")));
    assert.equal(run("git", ["diff", "--cached", "--name-only"]).stdout.trim(), "staged.txt", "the hook's index is kept");
    assert.equal(run("sh", ["-c", `GIT_GRAFT_FILE='${hooked.graft}' git log --format=%s`]).stdout.trim(), "second",
      "a graft set inside the command still works, so the control below is real");
  });
  for (const injected of [{ GIT_GRAFT_FILE: hooked.graft }, { GIT_REPLACE_REF_BASE: "refs/alt/" }, { GIT_NO_REPLACE_OBJECTS: "1" }]) {
    assert.equal(log(injected), hooked.clean, Object.keys(injected).join(","));
  }
});

await test("a narrowed fetch refspec cannot leave readiness on a stale origin/main, and other remote refs are left alone", (t) => {
  const repo = fixture(t);
  const before = repo.git(["rev-parse", "main"]);
  repo.git(["switch", "--quiet", "-c", "elsewhere", "main"]);
  repo.write("moved.md", "main moved\n");
  repo.commit("main moved on origin");
  repo.git(["push", "--quiet", "origin", "elsewhere:main"]);
  repo.git(["switch", "--quiet", "feat/x"]);
  repo.git(["update-ref", "refs/remotes/origin/main", before]);
  repo.git(["update-ref", "refs/remotes/origin/other", before]);
  repo.git(["config", "remote.origin.fetch", "+refs/heads/other:refs/remotes/origin/other"]);
  const result = go(repo, runner(repo).run);
  assert.equal(result.code, EXIT_REFUSED, "the branch lacks the commit origin's main now has");
  assert.match(result.err, /behind main/);
  assert.equal(repo.git(["rev-parse", "refs/remotes/origin/other"]), before, "an unrelated remote-tracking ref is not rewritten");
});

await test("an origin without main stops readiness instead of comparing a leftover ref", (t) => {
  const repo = fixture(t);
  const remote = repo.git(["remote", "get-url", "origin"]);
  execFileSync("git", ["--git-dir", remote, "update-ref", "-d", "refs/heads/main"], { env: cleanGitEnv });
  assert.throws(() => go(repo, runner(repo).run), /git fetch .* failed/);
});

await test("readiness compares the main commit it captured, even if the tracking ref moves afterwards", (t) => {
  const repo = fixture(t);
  const before = repo.git(["rev-parse", "main"]);
  repo.git(["switch", "--quiet", "-c", "elsewhere", "main"]);
  repo.write("moved.md", "main moved\n");
  repo.commit("main moved on origin");
  repo.git(["push", "--quiet", "origin", "elsewhere:main"]);
  repo.git(["switch", "--quiet", "feat/x"]);
  const base = runner(repo).run;
  const run: Run = (command, args, options) => {
    const result = base(command, args, options);
    if (command === "git" && args[0] === "rev-parse" && args.includes("refs/remotes/origin/main^{commit}")) {
      repo.git(["update-ref", "refs/remotes/origin/main", before]);
    }
    return result;
  };
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED, "the old ref planted after capture is not what readiness compares");
  assert.match(result.err, /behind main/);
});

await test("an unreachable origin stops readiness instead of comparing a leftover ref", (t) => {
  const repo = fixture(t);
  repo.git(["remote", "set-url", "origin", join(repo.dir, "no-such-remote")]);
  assert.throws(() => go(repo, runner(repo).run), /git fetch .* failed/);
});
