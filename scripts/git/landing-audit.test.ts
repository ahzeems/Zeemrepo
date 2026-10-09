import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLandings, prNumberOf } from "./landing-audit.ts";

await test("prNumberOf reads GitHub merge and squash subjects", () => {
  assert.equal(prNumberOf("Merge pull request #12 from ahzeems/feat/x"), 12);
  assert.equal(prNumberOf("feat(guards): harden guards (#13)"), 13);
  assert.equal(prNumberOf("fix: typo"), null);
  assert.equal(prNumberOf("Merge branch 'main' into feat/x"), null);
});

await test("classifyLandings flags commits that did not land through a merged PR", () => {
  const commits = [
    { sha: "a".repeat(40), subject: "Merge pull request #5 from o/feat" },
    { sha: "b".repeat(40), subject: "fix: pushed straight to main" },
    { sha: "c".repeat(40), subject: "Merge pull request #6 from o/feat" },
  ];
  const merged = (number: number, sha: string): boolean => number === 5 && sha === "a".repeat(40);
  const result = classifyLandings(commits, merged);
  assert.deepEqual(result.map((entry) => [entry.sha.slice(0, 1), entry.verdict]), [["a", "ok"], ["b", "no-pr"], ["c", "unverified-pr"]]);
});

await test("the audit walks main's first-parent history from the configured start", async (t) => {
  const { createRepo } = await import("../test-support/repo-fixture.ts");
  const { main } = await import("./landing-audit.ts");
  const repo = createRepo("landing-audit-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  const landed = repo.commit("Merge pull request #2 from o/feat");
  repo.commit("fix: direct push");
  repo.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
  repo.write("config/landing-audit.json", JSON.stringify({ since: start }));
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: () => undefined, warn: (line) => err.push(line) }, merged: (pr, sha) => pr === 2 && sha === landed });
  assert.equal(code, 1);
  assert.match(err.join("\n"), /\[no-pr\] fix: direct push/);
  assert.doesNotMatch(err.join("\n"), /#2/);
});
