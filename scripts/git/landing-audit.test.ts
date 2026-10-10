import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { classifyLandings, githubMerged, prNumberOf } from "./landing-audit.ts";

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
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  repo.commit("fix: direct push");
  repo.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
  repo.write("config/landing-audit.json", JSON.stringify({ since: "0".repeat(40), repo: "o/r" }));
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: () => undefined, warn: (line) => err.push(line) }, merged: (pr, sha) => pr === 2 && sha === landed });
  assert.equal(code, 1);
  assert.match(err.join("\n"), /\[no-pr\] fix: direct push/);
  assert.doesNotMatch(err.join("\n"), /#2/);
});

await test("the audit reads its start point from origin/main and needs a full commit id", async (t) => {
  const { createRepo } = await import("../test-support/repo-fixture.ts");
  const { main } = await import("./landing-audit.ts");
  const repo = createRepo("landing-audit-config-");
  t.after(() => repo.cleanup());
  repo.write("config/landing-audit.json", JSON.stringify({ since: "916259b", repo: "o/r" }));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("start")]);
  assert.throws(() => main([], { cwd: repo.dir, output: { write: () => undefined, warn: () => undefined }, merged: () => true }), /full "since" commit id/);
});

await test("a gh that hangs is stopped at the timeout and reported as an error, not a verdict", () => {
  const directory = mkdtempSync(join(tmpdir(), "landing-audit-"));
  try {
    const hanging = join(directory, "gh");
    writeFileSync(hanging, "#!/bin/sh\nsleep 10\n");
    chmodSync(hanging, 0o755);
    const started = Date.now();
    assert.throws(() => githubMerged(directory, "o/r", { program: hanging, timeoutMs: 200 })(1, "a".repeat(40)), /gh could not run/);
    assert.ok(Date.now() - started < 5000, "the audit does not wait for gh to finish");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fakeGh(t: { after: (fn: () => void) => void }, script: string): string {
  const directory = mkdtempSync(join(tmpdir(), "landing-audit-gh-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gh = join(directory, "gh");
  writeFileSync(gh, `#!/bin/sh\n${script}\n`);
  chmodSync(gh, 0o755);
  return gh;
}

await test("GitHub's answer decides the verdict, and a gh failure is an error, never a verdict", (t) => {
  const sha = "a".repeat(40);
  const merged = fakeGh(t, `printf '%s' '{"state":"MERGED","mergeCommit":{"oid":"${sha}"}}'`);
  assert.equal(githubMerged(undefined, "o/r", { program: merged })(1, sha), true);
  assert.equal(githubMerged(undefined, "o/r", { program: merged })(1, "b".repeat(40)), false, "merged, but as another commit");
  const open = fakeGh(t, `printf '%s' '{"state":"OPEN","mergeCommit":null}'`);
  assert.equal(githubMerged(undefined, "o/r", { program: open })(1, sha), false);
  const missing = fakeGh(t, "echo 'no pull requests found for branch' >&2; exit 1");
  assert.equal(githubMerged(undefined, "o/r", { program: missing })(1, sha), false, "no such PR is a verdict");
  const broken = fakeGh(t, "echo 'HTTP 401: Bad credentials' >&2; exit 1");
  assert.throws(() => githubMerged(undefined, "o/r", { program: broken })(1, sha), /gh pr view 1 failed: HTTP 401/);
});

await test("--help prints usage, other arguments are an error, and a bad repo name is refused", async (t) => {
  const { createRepo } = await import("../test-support/repo-fixture.ts");
  const { main } = await import("./landing-audit.ts");
  const lines: string[] = [];
  const output = { write: (line: string) => lines.push(line), warn: (line: string) => lines.push(line) };
  assert.equal(main(["--help"], { output }), 0);
  assert.match(lines.join("\n"), /Usage/);
  assert.equal(main(["--json"], { output }), 2);
  const repo = createRepo("landing-audit-repo-");
  t.after(() => repo.cleanup());
  repo.write("config/landing-audit.json", JSON.stringify({ since: "c".repeat(40), repo: "not a repo" }));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("start")]);
  assert.throws(() => main([], { cwd: repo.dir, output, merged: () => true }), /"repo" as owner\/name/);
});
