import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { hashFile, main, redactKey } from "./git-state.ts";

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

await test("VS Code's merge-base key is editor metadata, not an escape", async (t) => {
  await t.test("added during the check", (t) => {
    const repo = fresh(t);
    assert.equal(changedBy(repo, () => repo.git(["config", "branch.main.vscode-merge-base", "origin/main"])).code, EXIT_OK);
  });
  await t.test("changed or removed during the check", (t) => {
    const repo = fresh(t);
    repo.git(["config", "branch.main.vscode-merge-base", "origin/main"]);
    assert.equal(changedBy(repo, () => repo.git(["config", "branch.main.vscode-merge-base", "origin/other"])).code, EXIT_OK);
    assert.equal(changedBy(repo, () => repo.git(["config", "--unset", "branch.main.vscode-merge-base"])).code, EXIT_OK);
  });
  for (const [name, key] of [["a tracking key", "branch.main.merge"], ["another VS Code key", "branch.main.vscode-merge-base-x"],
    ["the same variable outside branch", "fixture.main.vscode-merge-base"], ["the variable with no branch", "branch.vscode-merge-base"]] as const) {
    await t.test(`${name} is still refused`, (t) => {
      const repo = fresh(t);
      const result = changedBy(repo, () => repo.git(["config", key, "x"]));
      assert.equal(result.code, EXIT_REFUSED, key);
      assert.match(result.err, /local git config changed/);
    });
  }
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

// A tracked file already modified and an untracked file, each rewritten without changing what
// git status prints: the same "XY path" lines, different bytes.
function dirtyRepo(t: TestContext): RepoFixture {
  const repo = fresh(t);
  repo.write("tracked.txt", "committed\n");
  repo.commit("tracked");
  repo.write("tracked.txt", "dirty one\n");
  repo.write("untracked.txt", "untracked one\n");
  return repo;
}

await test("content changes that leave git status unchanged are refused", async (t) => {
  const cases: [string, (repo: RepoFixture) => void][] = [
    ["a dirty tracked file rewritten", (repo) => repo.write("tracked.txt", "dirty two\n")],
    ["an untracked file rewritten", (repo) => repo.write("untracked.txt", "untracked two\n")],
    ["a dirty file made executable", (repo) => chmodSync(join(repo.dir, "tracked.txt"), 0o755)],
    ["an untracked file made executable", (repo) => chmodSync(join(repo.dir, "untracked.txt"), 0o755)],
    ["an untracked symlink retargeted", (repo) => { rmSync(join(repo.dir, "link")); symlinkSync("elsewhere", join(repo.dir, "link")); }],
    ["a file with tabs, spaces and a newline in its name rewritten", (repo) => repo.write("odd na\tme\nx.txt", "two\n")],
  ];
  for (const [name, change] of cases) {
    await t.test(name, (t) => {
      const repo = dirtyRepo(t);
      symlinkSync("somewhere", join(repo.dir, "link"));
      repo.write("odd na\tme\nx.txt", "one\n");
      const status = repo.git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
      const result = changedBy(repo, () => change(repo));
      assert.equal(repo.git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]), status, "git status is unchanged");
      assert.equal(result.code, EXIT_REFUSED, name);
      assert.match(result.err, /the working tree changed/);
    });
  }
});

await test("unchanged dirty and untracked contents pass, and deletion and creation are refused", async (t) => {
  await t.test("unchanged", (t) => {
    const repo = dirtyRepo(t);
    symlinkSync("/nonexistent-outside-target", join(repo.dir, "outside-link"));
    assert.equal(changedBy(repo, () => undefined).code, EXIT_OK);
  });
  await t.test("a dirty file deleted", (t) => {
    const repo = dirtyRepo(t);
    assert.equal(changedBy(repo, () => rmSync(join(repo.dir, "tracked.txt"))).code, EXIT_REFUSED);
  });
  await t.test("an untracked file created", (t) => {
    const repo = dirtyRepo(t);
    assert.equal(changedBy(repo, () => repo.write("new.txt", "x\n")).code, EXIT_REFUSED);
  });
  await t.test("ignored files stay outside the snapshot", (t) => {
    const repo = dirtyRepo(t);
    repo.write(".gitignore", "ignored.txt\n");
    repo.write("ignored.txt", "one\n");
    assert.equal(changedBy(repo, () => repo.write("ignored.txt", "two\n")).code, EXIT_OK);
  });
  await t.test("with this repository's .gitignore, an editor's swap, backup and autosave files stay outside the snapshot", async (t) => {
    const gitignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
    for (const name of [".tracked.txt.swp", ".tracked.txt.swo", "tracked.txt~", "#tracked.txt#", ".#tracked.txt"]) {
      await t.test(name, (t) => {
        const repo = dirtyRepo(t);
        repo.write(".gitignore", gitignore);
        assert.equal(changedBy(repo, () => repo.write(name, "x\n")).code, EXIT_OK);
      });
    }
    for (const name of ["tracked.swp", ".tracked.txt.swq", "a#b.txt", "a~b.txt", "a.#b.txt", "notes.txt"]) {
      await t.test(`${name} is still seen`, (t) => {
        const repo = dirtyRepo(t);
        repo.write(".gitignore", gitignore);
        assert.equal(changedBy(repo, () => repo.write(name, "x\n")).code, EXIT_REFUSED);
      });
    }
  });
});

await test("a symlink is read as its target text, never followed, and contents never reach the output", (t) => {
  const repo = dirtyRepo(t);
  const outside = mkdtempSync(join(tmpdir(), "git-state-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, "target.txt"), "outside one\n");
  symlinkSync(join(outside, "target.txt"), join(repo.dir, "escape"));
  repo.write("secret.txt", "SECRET-CONTENT-XYZ\n");
  const unchanged = changedBy(repo, () => writeFileSync(join(outside, "target.txt"), "outside two\n"));
  assert.equal(unchanged.code, EXIT_OK, "a link's target outside the fixture is not read");
  const changed = changedBy(repo, () => repo.write("secret.txt", "SECRET-CONTENT-ABC\n"));
  assert.equal(changed.code, EXIT_REFUSED);
  assert.doesNotMatch(changed.err, /SECRET-CONTENT|secret\.txt/);
  assert.doesNotMatch(run(repo.dir, ["snapshot"]).out, /SECRET-CONTENT|secret\.txt|outside/);
});

// Root reads a mode-000 file anyway, so there is nothing to refuse.
await test("an unreadable working file is an error, not a passing snapshot", { skip: process.getuid?.() === 0 }, (t) => {
  const repo = dirtyRepo(t);
  chmodSync(join(repo.dir, "untracked.txt"), 0o000);
  assert.throws(() => run(repo.dir, ["snapshot"]), /EACCES|permission/i);
});

await test("a listed path under a directory that now links outside the work tree is recorded, never read", (t) => {
  const repo = fresh(t);
  repo.write("dir/file.txt", "committed\n");
  repo.commit("dir");
  const outside = mkdtempSync(join(tmpdir(), "git-state-outside-dir-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, "file.txt"), "outside one\n");
  rmSync(join(repo.dir, "dir"), { recursive: true });
  symlinkSync(outside, join(repo.dir, "dir"));
  assert.equal(changedBy(repo, () => writeFileSync(join(outside, "file.txt"), "outside two\n")).code, EXIT_OK);
});

// git status -z prints names as raw bytes; one that is not UTF-8 cannot be read back by name, so
// the snapshot stops instead of recording it as absent and passing a later rewrite.
await test("a listed name that is not valid UTF-8 stops the snapshot", { skip: process.platform !== "linux" }, (t) => {
  const repo = fresh(t);
  writeFileSync(Buffer.concat([Buffer.from(`${repo.dir}/caf`), Buffer.from([0xe9]), Buffer.from(".txt")]), "one\n");
  assert.throws(() => run(repo.dir, ["snapshot"]), /not valid UTF-8/);
});

await test("files are hashed in chunks, so size is bounded by the disk, not by one read", (t) => {
  const repo = fresh(t);
  const path = join(repo.dir, "chunks.bin");
  const content = Buffer.from("0123456789abcdefghij");
  writeFileSync(path, content);
  const whole = hashFile(path, 1 << 20);
  assert.equal(hashFile(path, 7), whole, "three uneven chunks give the same digest");
  writeFileSync(path, Buffer.concat([content.subarray(0, 19), Buffer.from("J")]));
  assert.notEqual(hashFile(path, 7), whole, "a change in the last chunk is seen");
});
