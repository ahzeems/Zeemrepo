import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { classifyLandings, githubPullRequest, main, prNumberOf, type PullRequest, type PullRequestLookup } from "./landing-audit.ts";

// Each listed PR merged into main as the given commit, by the given merger.
function landedAs(merges: Record<number, string>, mergedBy = "owner"): PullRequestLookup {
  return (pr) => merges[pr] === undefined ? null : { state: "MERGED", mergeCommit: merges[pr], base: "main", mergedBy };
}

// A fixture whose main names @owner as code owner from its first commit.
function ownedRepo(prefix: string): RepoFixture {
  const repo = createRepo(prefix);
  repo.write(".github/CODEOWNERS", "* @owner\n");
  return repo;
}

await test("prNumberOf reads GitHub merge and squash subjects", () => {
  assert.equal(prNumberOf("Merge pull request #12 from ahzeems/feat/x"), 12);
  assert.equal(prNumberOf("feat(guards): harden guards (#13)"), 13);
  assert.equal(prNumberOf("fix: typo"), null);
  assert.equal(prNumberOf("Merge branch 'main' into feat/x"), null);
});

await test("classifyLandings accepts only a PR merged into main as this commit by a code owner of the time", () => {
  const sha = (letter: string): string => letter.repeat(40);
  const pull = (overrides: Partial<PullRequest>): PullRequest => ({ state: "MERGED", mergeCommit: sha("a"), base: "main", mergedBy: "Owner", ...overrides });
  const answers = new Map<number, PullRequest | null>([
    [1, pull({})],
    [2, null],
    [3, pull({ state: "OPEN", mergeCommit: null })],
    [4, pull({ mergeCommit: sha("f") })],
    [5, pull({ base: "release" })],
    [6, pull({ mergedBy: "intruder" })],
    [7, pull({ mergedBy: null })],
  ]);
  const commits = [
    { sha: sha("a"), subject: "Merge pull request #1 from o/feat" },
    { sha: sha("a"), subject: "fix: pushed straight to main" },
    { sha: sha("a"), subject: "Merge pull request #2 from o/feat" },
    { sha: sha("a"), subject: "Merge pull request #3 from o/feat" },
    { sha: sha("a"), subject: "Merge pull request #4 from o/feat" },
    { sha: sha("a"), subject: "feat: release (#5)" },
    { sha: sha("a"), subject: "Merge pull request #6 from o/feat" },
    { sha: sha("a"), subject: "Merge pull request #7 from o/feat" },
  ];
  const result = classifyLandings(commits, (pr) => answers.get(pr) ?? null, () => ["owner"]);
  assert.deepEqual(result.map((entry) => entry.verdict), ["ok", "no-pr", "unverified-pr", "unverified-pr", "unverified-pr", "wrong-base", "unauthorized-merger", "unauthorized-merger"]);
});

await test("classifyLandings judges each merger by the code owners in force when that commit landed", () => {
  const commits = [
    { sha: "a".repeat(40), subject: "Merge pull request #1 from o/feat" },
    { sha: "b".repeat(40), subject: "Merge pull request #2 from o/feat" },
  ];
  const lookup: PullRequestLookup = (pr) => ({ state: "MERGED", mergeCommit: commits[pr - 1]?.sha ?? null, base: "main", mergedBy: pr === 1 ? "alice" : "bob" });
  const owners = (sha: string): string[] => sha === commits[0]?.sha ? ["alice"] : ["bob"];
  assert.deepEqual(classifyLandings(commits, lookup, owners).map((entry) => entry.verdict), ["ok", "ok"], "alice's earlier merge stays valid after bob became owner");
  assert.deepEqual(classifyLandings(commits, lookup, () => []).map((entry) => entry.verdict), ["unauthorized-merger", "unauthorized-merger"], "no code owner means no authorized merger");
});

// The fixture's main, published to a local bare origin, as GitHub holds it.
function publish(t: TestContext, repo: RepoFixture): void {
  const remote = mkdtempSync(join(tmpdir(), "landing-audit-origin-"));
  t.after(() => rmSync(remote, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  repo.git(["remote", "add", "origin", remote]);
  repo.git(["push", "--quiet", "origin", "main"]);
}

await test("the audit walks main's first-parent history from the configured start", (t) => {
  const repo = ownedRepo("landing-audit-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  const landed = repo.commit("Merge pull request #2 from o/feat");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  repo.commit("fix: direct push");
  publish(t, repo);
  repo.write("config/landing-audit.json", JSON.stringify({ since: "0".repeat(40), repo: "o/r" }));
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: () => undefined, warn: (line) => err.push(line) }, lookup: landedAs({ 2: landed }) });
  assert.equal(code, 1);
  assert.match(err.join("\n"), /\[no-pr\] fix: direct push/);
  assert.doesNotMatch(err.join("\n"), /#2/);
});

await test("the audit fetches origin first, so a stale local origin/main cannot hide a direct push", (t) => {
  const repo = ownedRepo("landing-audit-stale-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  const landed = repo.commit("Merge pull request #2 from o/feat");
  publish(t, repo);
  repo.commit("fix: direct push");
  repo.git(["push", "--quiet", "origin", "main"]);
  repo.git(["update-ref", "refs/remotes/origin/main", landed]);
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: () => undefined, warn: (line) => err.push(line) }, lookup: landedAs({ 2: landed }) });
  assert.equal(code, 1, "the direct push on origin is found although the local ref predates it");
  assert.match(err.join("\n"), /\[no-pr\] fix: direct push/);
});

await test("an origin that cannot be fetched is an error, never a clean verdict", (t) => {
  const repo = ownedRepo("landing-audit-offline-");
  t.after(() => repo.cleanup());
  repo.write("config/landing-audit.json", JSON.stringify({ since: "c".repeat(40), repo: "o/r" }));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("start")]);
  repo.git(["remote", "add", "origin", join(repo.dir, "no-such-remote")]);
  assert.throws(() => main([], { cwd: repo.dir, output: { write: () => undefined, warn: () => undefined }, lookup: landedAs({}) }), /git fetch/);
});

await test("the audit reads its start point from origin/main and needs a full commit id", (t) => {
  const repo = ownedRepo("landing-audit-config-");
  t.after(() => repo.cleanup());
  repo.write("config/landing-audit.json", JSON.stringify({ since: "916259b", repo: "o/r" }));
  repo.commit("start");
  publish(t, repo);
  assert.throws(() => main([], { cwd: repo.dir, output: { write: () => undefined, warn: () => undefined }, lookup: landedAs({}) }), /full "since" commit id/);
});

await test("a gh that hangs is stopped at the timeout and reported as an error, not a verdict", () => {
  const directory = mkdtempSync(join(tmpdir(), "landing-audit-"));
  try {
    const hanging = join(directory, "gh");
    writeFileSync(hanging, "#!/bin/sh\nsleep 10\n");
    chmodSync(hanging, 0o755);
    const started = Date.now();
    assert.throws(() => githubPullRequest(directory, "o/r", { program: hanging, timeoutMs: 200 })(1), /gh could not run/);
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

await test("gh's answer is read strictly, a missing PR is an answer, and a gh failure or malformed answer is an error", (t) => {
  const sha = "a".repeat(40);
  const merged = fakeGh(t, `printf '%s' '{"state":"MERGED","mergeCommit":{"oid":"${sha}"},"baseRefName":"main","mergedBy":{"login":"Owner"}}'`);
  assert.deepEqual(githubPullRequest(undefined, "o/r", { program: merged })(1), { state: "MERGED", mergeCommit: sha, base: "main", mergedBy: "Owner" });
  const open = fakeGh(t, `printf '%s' '{"state":"OPEN","mergeCommit":null,"baseRefName":"main","mergedBy":null}'`);
  assert.deepEqual(githubPullRequest(undefined, "o/r", { program: open })(1), { state: "OPEN", mergeCommit: null, base: "main", mergedBy: null });
  const missing = fakeGh(t, "echo 'no pull requests found for branch' >&2; exit 1");
  assert.equal(githubPullRequest(undefined, "o/r", { program: missing })(1), null, "no such PR is a verdict");
  const broken = fakeGh(t, "echo 'HTTP 401: Bad credentials' >&2; exit 1");
  assert.throws(() => githubPullRequest(undefined, "o/r", { program: broken })(1), /gh pr view 1 failed: HTTP 401/);
  for (const answer of ['{"state":"MERGED","mergeCommit":{"oid":"x"}}', '{"mergeCommit":null,"baseRefName":"main","mergedBy":null}', '{"state":"OPEN","mergeCommit":null,"mergedBy":null}', '{"state":"MERGED","mergeCommit":{"oid":1},"baseRefName":"main","mergedBy":null}', "[]", "not json"]) {
    const malformed = fakeGh(t, `printf '%s' '${answer}'`);
    assert.throws(() => githubPullRequest(undefined, "o/r", { program: malformed })(1), /gh pr view 1/, answer);
  }
});

await test("--help prints usage, other arguments are an error, and a bad repo name is refused", (t) => {
  const lines: string[] = [];
  const output = { write: (line: string) => lines.push(line), warn: (line: string) => lines.push(line) };
  assert.equal(main(["--help"], { output }), 0);
  assert.match(lines.join("\n"), /Usage/);
  assert.equal(main(["--json"], { output }), 2);
  const repo = ownedRepo("landing-audit-repo-");
  t.after(() => repo.cleanup());
  repo.write("config/landing-audit.json", JSON.stringify({ since: "c".repeat(40), repo: "not a repo" }));
  repo.commit("start");
  publish(t, repo);
  assert.throws(() => main([], { cwd: repo.dir, output, lookup: landedAs({}) }), /"repo" as owner\/name/);
});

await test("a narrowed fetch refspec cannot leave the audit on a stale origin/main, and other remote refs are left alone", (t) => {
  const repo = ownedRepo("landing-audit-narrow-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  const landed = repo.commit("Merge pull request #2 from o/feat");
  publish(t, repo);
  repo.commit("fix: direct push");
  repo.git(["push", "--quiet", "origin", "main"]);
  repo.git(["update-ref", "refs/remotes/origin/main", landed]);
  repo.git(["update-ref", "refs/remotes/origin/other", start]);
  repo.git(["config", "remote.origin.fetch", "+refs/heads/other:refs/remotes/origin/other"]);
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: () => undefined, warn: (line) => err.push(line) }, lookup: landedAs({ 2: landed }) });
  assert.equal(code, 1, "the direct push on origin is found although fetch would only fill FETCH_HEAD");
  assert.match(err.join("\n"), /\[no-pr\] fix: direct push/);
  assert.equal(repo.git(["rev-parse", "refs/remotes/origin/other"]), start, "an unrelated remote-tracking ref is not rewritten");
});

await test("an origin without main is an error, never a clean verdict", (t) => {
  const repo = ownedRepo("landing-audit-nomain-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  repo.git(["update-ref", "refs/remotes/origin/main", start]);
  const remote = mkdtempSync(join(tmpdir(), "landing-audit-empty-"));
  t.after(() => rmSync(remote, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  repo.git(["remote", "add", "origin", remote]);
  assert.throws(() => main([], { cwd: repo.dir, output: { write: () => undefined, warn: () => undefined }, lookup: landedAs({}) }), /git fetch/);
});

// main: start, then each given commit, published; config written at the start commit.
function auditRepo(t: TestContext, prefix: string): { repo: RepoFixture; start: string } {
  const repo = ownedRepo(prefix);
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  return { repo, start };
}

function runAudit(repo: RepoFixture, lookup: PullRequestLookup): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const code = main([], { cwd: repo.dir, output: { write: (line) => out.push(line), warn: (line) => err.push(line) }, lookup });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

await test("a clean audit names its repository and states that history at and before the boundary is outside it", (t) => {
  const { repo, start } = auditRepo(t, "landing-audit-scope-");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  const first = repo.commit("Merge pull request #2 from o/feat");
  publish(t, repo);
  const result = runAudit(repo, landedAs({ 2: first }));
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /1 commit\(s\) on o\/r main after [0-9a-f]{12}/);
  assert.match(result.out, /at and before [0-9a-f]{12} is outside this audit/);
});

await test("the first commit after the boundary is audited and the boundary itself is not", (t) => {
  const { repo, start } = auditRepo(t, "landing-audit-boundary-");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  repo.commit("fix: direct push right after the boundary");
  publish(t, repo);
  const result = runAudit(repo, landedAs({}));
  assert.equal(result.code, 1);
  assert.match(result.err, /\[no-pr\] fix: direct push right after the boundary/);
  assert.doesNotMatch(result.err, /start/);
});

await test("a boundary that is missing or not on main's first-parent history is an error, never a verdict", (t) => {
  const { repo } = auditRepo(t, "landing-audit-offmain-");
  repo.git(["switch", "--quiet", "-c", "side"]);
  const side = repo.commit("side work");
  repo.git(["switch", "--quiet", "main"]);
  repo.git(["merge", "--quiet", "--no-ff", "-m", "Merge pull request #2 from o/side", "side"]);
  publish(t, repo);
  for (const since of [side, "0".repeat(40)]) {
    repo.write("config/landing-audit.json", JSON.stringify({ since, repo: "o/r" }));
    repo.commit(`config ${since.slice(0, 7)}`);
    repo.git(["push", "--quiet", "origin", "main"]);
    assert.throws(() => runAudit(repo, () => { throw new Error("GitHub must not be asked"); }), /not on main's first-parent history/, since);
  }
});

await test("a code-owner change applies from the commit after it lands, so earlier merges stay valid", (t) => {
  const { repo, start } = auditRepo(t, "landing-audit-rotate-");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  const byOwner = repo.commit("Merge pull request #2 from o/feat");
  repo.write(".github/CODEOWNERS", "* @successor\n");
  const handover = repo.commit("Merge pull request #3 from o/handover");
  const bySuccessor = repo.commit("Merge pull request #4 from o/feat");
  publish(t, repo);
  const mergers: Record<number, string> = { 2: "owner", 3: "owner", 4: "successor" };
  const shas: Record<number, string> = { 2: byOwner, 3: handover, 4: bySuccessor };
  const lookup = (who: Record<number, string>): PullRequestLookup => (pr) => ({ state: "MERGED", mergeCommit: shas[pr] ?? null, base: "main", mergedBy: who[pr] ?? null });
  assert.equal(runAudit(repo, lookup(mergers)).code, 0, "each merge was by the code owner of its time");
  const stale = runAudit(repo, lookup({ ...mergers, 4: "owner" }));
  assert.equal(stale.code, 1);
  assert.match(stale.err, /\[unauthorized-merger\] Merge pull request #4/);
  assert.doesNotMatch(stale.err, /#2|#3/);
});

await test("a landing whose parent has no CODEOWNERS file has no authorized merger", (t) => {
  const repo = createRepo("landing-audit-noowners-");
  t.after(() => repo.cleanup());
  const start = repo.commit("start");
  repo.write("config/landing-audit.json", JSON.stringify({ since: start, repo: "o/r" }));
  const landed = repo.commit("Merge pull request #2 from o/feat");
  publish(t, repo);
  const result = runAudit(repo, landedAs({ 2: landed }));
  assert.equal(result.code, 1);
  assert.match(result.err, /\[unauthorized-merger\] Merge pull request #2/);
});
