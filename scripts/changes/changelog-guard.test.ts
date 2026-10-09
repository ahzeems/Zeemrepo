import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { main } from "./changelog-guard.ts";

const today = new Date().toISOString().slice(0, 10);

function branch(t: TestContext): RepoFixture & { check(...args: string[]): { code: number; out: string; err: string } } {
  const repo = createRepo("changelog-guard-");
  t.after(() => repo.cleanup());
  repo.write("CHANGELOG.md", "# Changelog\n");
  repo.write("scripts/a.ts", "export const a = 1;\n");
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  const check = (...args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
    return { code: main(args, { cwd: repo.dir, output, today }), out: out.join("\n"), err: err.join("\n") };
  };
  return { ...repo, check };
}

await test("a branch with a dated entry passes, before or after committing it", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write("CHANGELOG.md", `# Changelog\n\n## ${today}\n\n- Raised a.\n`);
  repo.git(["add", "--all"]);
  assert.equal(repo.check().code, EXIT_OK, "staged");
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /records its own CHANGELOG\.md entry/);
});

await test("a branch without an entry is refused", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.commit("feat: raise a");
  const result = repo.check();
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /adds no entry to CHANGELOG\.md/);
});

await test("an entry under a date older than the branch is refused", (t) => {
  const repo = branch(t);
  repo.write("scripts/a.ts", "export const a = 2;\n");
  repo.write("CHANGELOG.md", "# Changelog\n\n## 2020-01-01\n\n- Raised a.\n");
  repo.commit("feat: raise a");
  assert.equal(repo.check().code, EXIT_REFUSED);
});

await test("--json reports the verdict, and a missing base is an error", async (t) => {
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
