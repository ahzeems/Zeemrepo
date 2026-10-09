import assert from "node:assert/strict";
import { test } from "node:test";
import { commitViolations, stagedMix } from "./wiki-compliance-validation.ts";

const commit = (subject: string, files: string[]) => ({ sha: "a".repeat(40), subject, files });

await test("a wiki-only commit with the docs(wiki) subject is allowed", () => {
  assert.deepEqual(commitViolations([commit("docs(wiki): record the lesson", ["wiki/lessons/A.md"])]), []);
});

await test("a breaking-change marker on the wiki scope is allowed", () => {
  assert.deepEqual(commitViolations([commit("docs(wiki)!: restructure the index", ["wiki/Home.md"])]), []);
});

await test("a code-only commit is allowed and needs no wiki subject", () => {
  assert.deepEqual(commitViolations([commit("feat(lib): add git helper", ["scripts/lib/git.ts"])]), []);
});

await test("a commit mixing wiki and other files is refused, naming the commit", () => {
  const [violation] = commitViolations([commit("feat: everything", ["scripts/a.ts", "wiki/Home.md"])]);
  assert.equal(violation?.kind, "mixed");
  assert.equal(violation?.sha, "a".repeat(40));
  assert.match(violation?.detail ?? "", /1 wiki file\(s\) with 1 other/);
});

await test("a wiki-only commit with any other subject is refused", () => {
  for (const subject of ["wiki: old style", "docs: record", "docs(wiki) record", "Docs(Wiki): record", "docs(wiki):record"]) {
    const [violation] = commitViolations([commit(subject, ["wiki/Home.md"])]);
    assert.equal(violation?.kind, "subject", subject);
  }
});

await test("root documents and look-alike folders are not wiki files", () => {
  assert.deepEqual(commitViolations([commit("docs: readme", ["README.md", "docs/wiki/x.md", "wikis/a.md"])]), []);
});

await test("stagedMix reports both sides of a mixed staging and nothing otherwise", () => {
  assert.deepEqual(stagedMix(["wiki/a.md", "scripts/b.ts"]), { wiki: ["wiki/a.md"], other: ["scripts/b.ts"] });
  assert.equal(stagedMix(["wiki/a.md"]), null);
  assert.equal(stagedMix(["scripts/b.ts"]), null);
  assert.equal(stagedMix([]), null);
});

await test("wiki paths are recognised in any letter case, and the bare wiki path counts", () => {
  for (const path of ["Wiki/x.md", "WIKI/Home.md", "wiki"]) {
    const [violation] = commitViolations([commit("feat: sneak", ["scripts/a.ts", path])]);
    assert.equal(violation?.kind, "mixed", path);
  }
});

await test("a docs(wiki) subject on a commit with no wiki files is refused as mislabelled", () => {
  const [violation] = commitViolations([commit("docs(wiki): record", ["scripts/a.ts"])]);
  assert.equal(violation?.kind, "subject");
  assert.match(violation?.detail ?? "", /no wiki files/);
});
