import assert from "node:assert/strict";
import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { GitError, git, gitLines, gitPaths, isAncestor, mergeBase, refExists, tryGit } from "./git.ts";

function withRepo(t: { after(fn: () => void): void }): RepoFixture {
  const repo = createRepo();
  t.after(() => repo.cleanup());
  return repo;
}

function withEnv(values: Record<string, string>, run: () => void): void {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

await test("git output", async (t) => {
  const repo = withRepo(t);
  repo.write("a.txt", "a\n");
  const first = repo.commit("first");

  await t.test("drops only the trailing newline", () => {
    assert.equal(git(["rev-parse", "HEAD"], { cwd: repo.dir }), first);
    repo.write("a.txt", "changed\n");
    assert.equal(git(["status", "--porcelain"], { cwd: repo.dir }), " M a.txt");
    repo.git(["checkout", "--", "a.txt"]);
  });

  await t.test("gitLines splits output and drops empty lines", () => {
    repo.write("b.txt", "b\n");
    const second = repo.commit("second");
    assert.deepEqual(gitLines(["rev-list", "HEAD"], { cwd: repo.dir }), [second, first]);
    assert.deepEqual(gitLines(["rev-list", `${second}..${second}`], { cwd: repo.dir }), []);
  });

  await t.test("does not quote non-ASCII paths", () => {
    repo.write("café.md", "x\n");
    repo.commit("non-ascii");
    assert.equal(git(["ls-files", "café.md"], { cwd: repo.dir }), "café.md");
  });

  await t.test("gitPaths keeps -z an option even when a file is named -z", () => {
    repo.write("-z", "x\n");
    assert.deepEqual(gitPaths(["ls-files", "--others", "--exclude-standard", "--", "absent.txt"], { cwd: repo.dir }), []);
    rmSync(join(repo.dir, "-z"));
  });

  await t.test("gitPaths returns control characters literally, unquoted", () => {
    repo.write("tab\there.ts", "x\n");
    repo.write("new\nline.ts", "x\n");
    repo.commit("control characters");
    assert.deepEqual(gitPaths(["diff", "--name-only", "HEAD~1", "HEAD"], { cwd: repo.dir }).sort(), ["new\nline.ts", "tab\there.ts"]);
  });

  await t.test("gitPaths reports both sides of a rename", () => {
    repo.write("scripts/guard.ts", "export const a = 1;\n".repeat(20));
    repo.commit("add guard");
    repo.write("docs/.keep", "");
    repo.git(["mv", "scripts/guard.ts", "docs/guard.txt"]);
    repo.commit("move guard");
    assert.deepEqual(gitPaths(["diff", "--name-only", "HEAD~1", "HEAD"], { cwd: repo.dir }).sort(), ["docs/.keep", "docs/guard.txt", "scripts/guard.ts"]);
  });

});

await test("git errors", async (t) => {
  const repo = withRepo(t);
  repo.commit("first");

  await t.test("throws GitError with stderr and the exit status", () => {
    assert.throws(() => git(["rev-parse", "--verify", "no-such-ref"], { cwd: repo.dir }), (error: unknown) =>
      error instanceof GitError && error.args.includes("no-such-ref") && error.stderr.length > 0 && error.status === 128);
  });

  await t.test("a failure to run git at all keeps its cause and a readable message", () => {
    assert.throws(() => git(["status"], { cwd: join(repo.dir, "missing") }), (error: unknown) =>
      error instanceof GitError && error.status === null && error.cause !== undefined && /ENOENT/.test(error.message));
  });

  await t.test("tryGit returns null when git ran and said no", () => {
    assert.equal(tryGit(["rev-parse", "--verify", "--quiet", "missing"], { cwd: repo.dir }), null);
  });

  await t.test("tryGit still throws when git could not run", () => {
    assert.throws(() => tryGit(["status"], { cwd: join(repo.dir, "missing") }), GitError);
  });
});

await test("git environment", async (t) => {
  await t.test("an explicit cwd wins over an inherited GIT_DIR (hook environment)", (t) => {
    const repo = withRepo(t);
    const other = withRepo(t);
    withEnv({ GIT_DIR: join(other.dir, ".git"), GIT_INDEX_FILE: join(other.dir, ".git", "index") }, () => {
      assert.equal(git(["rev-parse", "--show-toplevel"], { cwd: repo.dir }), realpathSync(repo.dir));
    });
  });

  await t.test("ignores config injected through the environment, even in a hook", (t) => {
    const repo = withRepo(t);
    withEnv({ GIT_DIR: join(repo.dir, ".git"), GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "zeem.probe", GIT_CONFIG_VALUE_0: "injected" }, () => {
      assert.equal(tryGit(["config", "--get", "zeem.probe"]), null);
    });
  });

  await t.test("without a cwd the hook's GIT_DIR is honoured", (t) => {
    const repo = withRepo(t);
    withEnv({ GIT_DIR: join(repo.dir, ".git") }, () => {
      assert.equal(realpathSync(git(["rev-parse", "--absolute-git-dir"])), realpathSync(join(repo.dir, ".git")));
    });
  });
});

await test("refExists", async (t) => {
  const repo = withRepo(t);
  repo.commit("first");
  await t.test("is true for a commit ref and false for a missing one", () => {
    assert.equal(refExists("refs/heads/main", { cwd: repo.dir }), true);
    assert.equal(refExists("refs/remotes/origin/main", { cwd: repo.dir }), false);
  });
  await t.test("rejects a ref that git would read as an option", () => {
    assert.throws(() => refExists("--all", { cwd: repo.dir }), /option/);
  });
});

await test("mergeBase", async (t) => {
  await t.test("uses local main when there is no origin", (t) => {
    const repo = withRepo(t);
    const base = repo.commit("base");
    repo.git(["switch", "--quiet", "-c", "feature"]);
    repo.commit("work");
    assert.equal(mergeBase({ cwd: repo.dir }), base);
  });

  await t.test("prefers origin/main over a stale local main", (t) => {
    const repo = withRepo(t);
    repo.commit("old");
    const remoteTip = repo.commit("remote tip");
    repo.git(["update-ref", "refs/remotes/origin/main", remoteTip]);
    repo.git(["reset", "--quiet", "--hard", "HEAD~1"]);
    repo.git(["switch", "--quiet", "-c", "feature", remoteTip]);
    repo.commit("work");
    assert.equal(mergeBase({ cwd: repo.dir }), remoteTip);
  });

  await t.test("throws, not falls back, when origin/main exists but shares no history", (t) => {
    const repo = withRepo(t);
    repo.commit("main");
    repo.git(["switch", "--quiet", "--orphan", "unrelated"]);
    const unrelated = repo.commit("unrelated");
    repo.git(["update-ref", "refs/remotes/origin/main", unrelated]);
    repo.git(["switch", "--quiet", "main"]);
    assert.throws(() => mergeBase({ cwd: repo.dir }), /refs\/remotes\/origin\/main.*no common history/);
  });

  await t.test("throws when neither main ref exists", (t) => {
    const repo = withRepo(t);
    repo.commit("on main");
    repo.git(["switch", "--quiet", "--orphan", "lonely"]);
    repo.commit("only");
    repo.git(["branch", "--quiet", "-D", "main"]);
    assert.throws(() => mergeBase({ cwd: repo.dir }), /no base ref/);
  });
});

await test("isAncestor", async (t) => {
  const repo = withRepo(t);
  const base = repo.commit("base");
  const head = repo.commit("head");

  await t.test("is true for an ancestor and false for a descendant", () => {
    assert.equal(isAncestor(base, head, { cwd: repo.dir }), true);
    assert.equal(isAncestor(head, base, { cwd: repo.dir }), false);
  });

  await t.test("throws on a missing object instead of answering false", () => {
    assert.throws(() => isAncestor("0".repeat(40), head, { cwd: repo.dir }), GitError);
  });

  await t.test("rejects a ref that git would read as an option", () => {
    assert.throws(() => isAncestor("--all", head, { cwd: repo.dir }), /option/);
  });
});
