import assert from "node:assert/strict";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main } from "./changelog-guard.ts";

const today = new Date().toISOString().slice(0, 10);
const FRAGMENT = `changelog/${today}-raise-a.md`;
type Checked = { code: number; out: string; err: string };
type Branch = RepoFixture & { check(...args: string[]): Checked };

function checker(repo: RepoFixture, cwd = repo.dir) {
  return (...args: string[]): Checked => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
    return { code: main(args, { cwd, output, today }), out: out.join("\n"), err: err.join("\n") };
  };
}

// A feature branch off main, where main already holds an earlier fragment unless `switched` is false.
function branch(t: TestContext, { switched = true, other = "" } = {}): Branch {
  const repo = createRepo("changelog-guard-");
  t.after(() => repo.cleanup());
  repo.write("CHANGELOG.md", "# Changelog\n");
  repo.write("scripts/a.ts", "export const a = 1;\n");
  if (switched) repo.write("changelog/2020-01-01-earlier.md", "- An earlier change.\n");
  if (other !== "") repo.write(other, "Not a fragment.\n");
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  return { ...repo, check: checker(repo) };
}

await test("a branch with a dated fragment passes, untracked, staged or committed", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write(FRAGMENT, "- Raised a.\n");
  assert.equal(repo.check().code, EXIT_OK, "untracked");
  repo.git(["add", "--all"]);
  assert.equal(repo.check().code, EXIT_OK, "staged");
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /records its own changelog fragment/);
});

await test("a branch without a fragment is refused", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /adds no changelog fragment/);
});

await test("once main holds a fragment, a CHANGELOG.md entry is refused and the branch is told to move it", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write("CHANGELOG.md", `# Changelog\n\n## ${today}\n\n- Raised a.\n`);
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /CHANGELOG\.md is history/);
  assert.match(result.err, /move it into a new fragment/);
});

await test("the switching branch may add a CHANGELOG.md entry while main holds no fragment, but only with a fragment", (t) => {
  const repo = branch(t, { switched: false });
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write("CHANGELOG.md", `# Changelog\n\nNew entries live in changelog/.\n\n## ${today}\n\n- Raised a.\n`);
  repo.commit("feat: raise a");
  assert.match(repo.check().err, /move it into a new fragment/, "a transition entry alone is refused");
  repo.write(FRAGMENT, "- Raised a.\n");
  repo.commit("docs: add the fragment");
  const result = repo.check();
  assert.equal(result.code, EXIT_OK, result.err);
});

await test("a file under changelog/ on main that is not a fragment does not end the transition", (t) => {
  const repo = branch(t, { switched: false, other: "changelog/README.md" });
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write("CHANGELOG.md", `# Changelog\n\n## ${today}\n\n- Raised a.\n`);
  repo.write(FRAGMENT, "- Raised a.\n");
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_OK, result.err);
});

await test("a fragment already on main cannot be edited, deleted or renamed", async (t) => {
  const edits: [string, (repo: Branch) => void][] = [
    ["edited", (repo) => repo.write("changelog/2020-01-01-earlier.md", "- Rewritten.\n")],
    ["deleted", (repo) => repo.git(["rm", "--quiet", "changelog/2020-01-01-earlier.md"])],
    ["renamed", (repo) => repo.git(["mv", "changelog/2020-01-01-earlier.md", `changelog/${today}-earlier.md`])],
  ];
  for (const [name, edit] of edits) {
    await t.test(name, (t) => {
      const repo = branch(t);
      repo.write(FRAGMENT, "- Raised a.\n");
      edit(repo);
      repo.commit(`docs: ${name}`);
      const result = repo.check();
      assert.equal(result.code, EXIT_REFUSED);
      assert.match(result.err, /changelog\/2020-01-01-earlier\.md is already on main/);
    });
  }
});

await test("two branches from one base each add a fragment and merge into main in either order without a conflict", async (t) => {
  for (const order of [["one", "two"], ["two", "one"]]) {
    await t.test(order.join(" then "), (t) => {
      const repo = branch(t);
      repo.git(["switch", "--quiet", "main"]);
      for (const name of ["one", "two"]) {
        repo.git(["switch", "--quiet", "-c", name, "main"]);
        repo.write(`scripts/${name}.ts`, `export const ${name} = 1;\n`);
        repo.write(`changelog/${today}-${name}.md`, `- Added ${name}.\n`);
        repo.commit(`feat: ${name}`);
        assert.equal(checker(repo)().code, EXIT_OK, `${name} passes the guard on its own`);
      }
      repo.git(["switch", "--quiet", "main"]);
      for (const name of order) {
        repo.git(["merge", "--quiet", "--no-ff", "-m", `Merge ${name}`, name]);
        repo.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
      }
      assert.deepEqual(repo.git(["ls-tree", "--name-only", "HEAD", "--", "changelog/"]).split("\n").sort(),
        ["changelog/2020-01-01-earlier.md", `changelog/${today}-one.md`, `changelog/${today}-two.md`]);
    });
  }
});

await test("--json reports the verdict, and arguments are checked", async (t) => {
  await t.test("json", (t) => {
    const repo = branch(t);
    repo.write("scripts/a.ts", "export const a = 2;\n");
    repo.commit("feat: raise a");
    const parsed: unknown = JSON.parse(repo.check("--json").out);
    assert.ok(typeof parsed === "object" && parsed !== null && "allowed" in parsed && parsed.allowed === false);
  });
  await t.test("bad arguments", (t) => assert.equal(branch(t).check("--bogus").code, EXIT_ERROR));
  await t.test("help", (t) => assert.match(branch(t).check("--help").out, /Usage/));
});

await test("run from a subdirectory, the guard still reads the repository's fragments", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write(FRAGMENT, "- Raised a.\n");
  repo.commit("feat: raise a");
  assert.equal(checker(repo, join(repo.dir, "scripts"))().code, EXIT_OK);
});
