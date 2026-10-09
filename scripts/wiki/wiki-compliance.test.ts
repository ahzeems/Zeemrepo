import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { main } from "./wiki-compliance.ts";

type Run = { code: number; out: string; err: string };

function branch(t: TestContext): RepoFixture & { check(...args: string[]): Run } {
  const repo = createRepo("wiki-compliance-");
  t.after(() => repo.cleanup());
  repo.write("scripts/a.ts", "export const a = 1;\n");
  repo.write("wiki/Home.md", "# Wiki\n");
  const base = repo.commit("base");
  repo.git(["update-ref", "refs/remotes/origin/main", base]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  const check = (...args: string[]): Run => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
    const code = main(args, { cwd: repo.dir, output });
    return { code, out: out.join("\n"), err: err.join("\n") };
  };
  return { ...repo, check };
}

await test("history check", async (t) => {
  await t.test("passes a branch that keeps wiki and code commits apart", (t) => {
    const repo = branch(t);
    repo.write("scripts/a.ts", "export const a = 2;\n");
    repo.commit("feat: raise a");
    repo.write("wiki/Home.md", "# Wiki\n\nRecorded.\n");
    repo.commit("docs(wiki): record the change");
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
    assert.match(result.out, /2 commit\(s\) on this branch keep wiki and other files apart/);
  });

  await t.test("refuses a mixed commit and says how to split it", (t) => {
    const repo = branch(t);
    repo.write("scripts/a.ts", "export const a = 2;\n");
    repo.write("wiki/Home.md", "# Changed\n");
    repo.commit("feat: both");
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[mixed\]/);
    assert.match(result.err, /add it in one commit and delete it in the next/);
  });

  await t.test("refuses a wiki-only commit with the wrong subject", (t) => {
    const repo = branch(t);
    repo.write("wiki/Home.md", "# Changed\n");
    repo.commit("wiki: old style");
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[subject\]/);
    assert.match(result.err, /docs\(wiki\):/);
  });

  await t.test("moving a note out of wiki does not hide the wiki side", (t) => {
    const repo = branch(t);
    repo.git(["mv", "wiki/Home.md", "scripts/Home.md"]);
    repo.commit("refactor: move");
    assert.equal(repo.check().code, EXIT_REFUSED);
  });

  await t.test("a merge that adds its own changes is judged on them", (t) => {
    const repo = branch(t);
    repo.git(["switch", "--quiet", "-c", "side", "refs/remotes/origin/main"]);
    repo.write("scripts/c.ts", "export const c = 1;\n");
    repo.commit("feat: side");
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-commit", "side"]);
    repo.write("wiki/Home.md", "# Slipped in during the merge\n");
    repo.write("scripts/a.ts", "export const a = 99;\n");
    repo.git(["add", "--all"]);
    repo.git(["commit", "--quiet", "--no-edit"]);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED, result.out);
    assert.match(result.err, /\[mixed\]/);
  });

  await t.test("ordinary merges, even of mixed history, are not judged", (t) => {
    const repo = branch(t);
    repo.write("scripts/b.ts", "export const b = 1;\n");
    repo.commit("feat: add b");
    repo.git(["switch", "--quiet", "-c", "side", "refs/remotes/origin/main"]);
    repo.write("wiki/Home.md", "# Side\n");
    repo.commit("docs(wiki): side");
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--quiet", "--no-ff", "-m", "Merge side", "side"]);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("--json reports the verdict as data", (t) => {
    const repo = branch(t);
    repo.write("wiki/Home.md", "# Changed\n");
    repo.commit("wiki: old style");
    const result = repo.check("--json");
    assert.equal(result.code, EXIT_REFUSED);
    const parsed: unknown = JSON.parse(result.out);
    assert.ok(typeof parsed === "object" && parsed !== null && "compliant" in parsed && parsed.compliant === false);
  });
});

await test("staged check", async (t) => {
  await t.test("refuses a staged mix, listing every file", (t) => {
    const repo = branch(t);
    repo.write("scripts/a.ts", "export const a = 2;\n");
    repo.write("wiki/Home.md", "# Changed\n");
    repo.git(["add", "--all"]);
    const result = repo.check("--staged");
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /wiki\/Home\.md/);
    assert.match(result.err, /scripts\/a\.ts/);
  });

  await t.test("passes wiki-only, code-only and empty stagings", (t) => {
    const repo = branch(t);
    assert.equal(repo.check("--staged").code, EXIT_OK);
    repo.write("wiki/Home.md", "# Changed\n");
    repo.git(["add", "--all"]);
    assert.equal(repo.check("--staged").code, EXIT_OK);
    repo.commit("docs(wiki): change");
    repo.write("scripts/a.ts", "export const a = 3;\n");
    repo.git(["add", "--all"]);
    assert.equal(repo.check("--staged").code, EXIT_OK);
  });

  await t.test("a staged rename across the boundary is mixed", (t) => {
    const repo = branch(t);
    repo.git(["mv", "scripts/a.ts", "wiki/a.ts"]);
    assert.equal(repo.check("--staged").code, EXIT_REFUSED);
  });

  await t.test("concluding a merge is not refused", (t) => {
    const repo = branch(t);
    repo.git(["switch", "--quiet", "-c", "side", "refs/remotes/origin/main"]);
    repo.write("scripts/a.ts", "export const a = 9;\n");
    repo.write("wiki/Home.md", "# Side\n");
    repo.commit("side work");
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--no-commit", "--no-ff", "side"]);
    assert.equal(repo.check("--staged").code, EXIT_OK);
  });
});

await test("arguments and failures", async (t) => {
  await t.test("rejects unknown arguments", (t) => {
    const result = branch(t).check("--bogus");
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /--help/);
  });

  await t.test("prints help", (t) => {
    const result = branch(t).check("--help");
    assert.equal(result.code, EXIT_OK);
    assert.match(result.out, /Usage/);
  });

  await t.test("--json still answers in JSON when the check cannot run", (t) => {
    const repo = createRepo("wiki-compliance-");
    t.after(() => repo.cleanup());
    repo.commit("first");
    repo.git(["branch", "-m", "trunk"]);
    const out: string[] = [];
    const code = main(["--json"], { cwd: repo.dir, output: { write: (line) => out.push(line), warn: () => undefined } });
    assert.equal(code, EXIT_ERROR);
    const parsed: unknown = JSON.parse(out.join(""));
    assert.ok(typeof parsed === "object" && parsed !== null && "error" in parsed && /no base ref/.test(String(parsed.error)));
  });

  await t.test("a repository with no main to compare against is an error, not a pass", (t) => {
    const repo = createRepo("wiki-compliance-");
    t.after(() => repo.cleanup());
    repo.commit("first");
    repo.git(["branch", "-m", "trunk"]);
    assert.throws(() => main([], { cwd: repo.dir, output: { write: () => undefined, warn: () => undefined } }), /no base ref/);
  });
});
