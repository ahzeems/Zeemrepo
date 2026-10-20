import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { Run } from "../git/pr-ready.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import {
  anotherCandidate, CHECKS, createVerifierCandidate, exportArtifact, FAIL, fakeReviewer, fakeRuntime, guestOn, PASS, type VerifierFixture, type VerifierOptions,
} from "../test-support/verifier-fixture.ts";
import { readReceipt, writeReceipt } from "./verification-receipt.ts";
import { verifyCandidate } from "./verifier-driver.ts";
import { HOST_EXECUTABLES, main } from "./isolated-publication.ts";

// The control checkout is the verifier fixture's trusted host repository. Its origin names the
// GitHub repository the receipt binds; the network is a local bare repository that the faked
// runner routes origin's fetches, ls-remotes and pushes to. gh is faked; git runs for real.
const ORIGIN_URL = "https://github.com/Zimfra/software_testing.git";
const OTHER_URL = "https://github.com/evil/software_testing.git";
const BRANCH = "sandcastle/issue-42";
const PR_URL = "https://github.com/Zimfra/software_testing/pull/7";
const NETWORK_FENCE = ["-c", "protocol.allow=never", "-c", "protocol.file.allow=always"];

type Fixture = VerifierFixture & { remote: string; digest: string; markers: string };
type Reply = { status: number | null; stdout: string };
type Call = { command: string; args: readonly string[] };

function git(dir: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: dir, env: cleanGitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function fixture(t: TestContext, options: VerifierOptions = {}, review = PASS): Promise<Fixture> {
  const made = createVerifierCandidate(options);
  const remote = mkdtempSync(join(tmpdir(), "publication-remote-"));
  const markers = mkdtempSync(join(tmpdir(), "publication-markers-"));
  t.after(() => { made.cleanup(); rmSync(remote, { recursive: true, force: true }); rmSync(markers, { recursive: true, force: true }); });
  execFileSync("git", ["init", "--quiet", "--bare", remote], { env: cleanGitEnv });
  made.host.git(["remote", "add", "origin", remote]);
  made.host.git(["push", "--quiet", "origin", "main"]);
  made.host.git(["fetch", "--quiet", "origin"]);
  made.host.git(["remote", "set-url", "origin", ORIGIN_URL]);
  const outcome = await verifyCandidate(
    { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store: made.store, root: made.root, checks: CHECKS },
    { runtime: fakeRuntime(), reviewer: fakeReviewer(review) },
  );
  assert.ok(outcome.status === "passed" || outcome.status === "failed", JSON.stringify(outcome));
  return { ...made, remote, markers, digest: outcome.digest };
}

function exactPr(head: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 7, url: PR_URL, state: "OPEN", baseRefName: "main", headRefName: BRANCH, headRefOid: head,
    headRepository: { name: "software_testing" }, headRepositoryOwner: { login: "Zimfra" }, isCrossRepository: false, ...overrides,
  };
}

const json = (value: unknown): Reply => ({ status: 0, stdout: `${JSON.stringify(value)}\n` });

// By default gh is logged in as the machine account, no pull request is open and the one created
// is exactly the candidate on its branch into main.
type Gh = { user?: string; list?: (head: string) => Reply; create?: Reply; view?: (head: string) => Reply };

function ghReply(gh: Gh, head: string, args: readonly string[]): Reply {
  const [area, verb] = args;
  if (area === "auth") return { status: 0, stdout: "" };
  if (area === "api" && verb === "user") return { status: 0, stdout: `${gh.user ?? "zimmybot"}\n` };
  if (area === "repo" && verb === "view") return { status: 0, stdout: "Zimfra\n" };
  if (area === "pr" && verb === "list") return gh.list?.(head) ?? json([]);
  if (area === "pr" && verb === "create") return gh.create ?? { status: 0, stdout: `${PR_URL}\n` };
  if (area === "pr" && verb === "view") return gh.view?.(head) ?? json(exactPr(head));
  throw new Error(`unexpected gh ${args.join(" ")}`);
}

type Routing = { gh?: Gh; hooksPath?: string };

// Every git may use only the file transport. Network commands reach the bare remote through an
// insteadOf rewrite; `hooksPath` stands for a hooks directory configured outside publication (the
// host user's global config), which publication must override.
function runner(made: Fixture, routing: Routing = {}): { run: Run; calls: Call[] } {
  const calls: Call[] = [];
  const run: Run = (command, args) => {
    calls.push({ command, args });
    if (command === "gh") return ghReply(routing.gh ?? {}, made.candidate, args);
    if (command !== "git") throw new Error(`publication started ${command}`);
    const network = args.some((arg) => ["push", "fetch", "ls-remote"].includes(arg)) ? ["-c", `url.${made.remote}.insteadOf=${ORIGIN_URL}`, "-c", `url.${made.remote}.insteadOf=${OTHER_URL}`] : [];
    const hooks = routing.hooksPath === undefined ? [] : ["-c", `core.hooksPath=${routing.hooksPath}`];
    const result = spawnSync("git", [...NETWORK_FENCE, ...network, ...hooks, ...args], { cwd: made.host.dir, env: cleanGitEnv, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout };
  };
  return { run, calls };
}

const argsFor = (made: Fixture, overrides: Record<string, string> = {}): string[] => Object.entries({
  "--artifacts": made.artifacts, "--receipt": made.digest, "--repository": made.expected.repository, "--task": made.expected.task,
  "--run": made.run, "--base": made.base, "--candidate": made.candidate, "--ref": made.expected.ref, ...overrides,
}).flat();

async function go(made: Fixture, run: Run, args = argsFor(made)): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  const code = await main(args, { output, run, control: made.host.dir, store: made.store, checks: CHECKS, quarantineRoot: made.root });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

const remoteBranch = (made: Fixture): string => git(made.remote, ["for-each-ref", "--format=%(objectname)", `refs/heads/${BRANCH}`]);
const pushes = (calls: readonly Call[]): Call[] => calls.filter((call) => call.command === "git" && call.args.includes("push"));

async function refusedUnpushed(made: Fixture, run: Run, calls: readonly Call[], named: RegExp, args?: string[]): Promise<void> {
  const result = await go(made, run, args);
  assert.equal(result.code, EXIT_REFUSED, result.out);
  assert.match(result.err, named);
  assert.equal(pushes(calls).length, 0, "nothing was pushed");
  assert.equal(remoteBranch(made), "", "origin has no candidate branch");
}

await test("a valid receipt-bound candidate is pushed by SHA from quarantine and gets its exact pull request", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const result = await go(made, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.equal(remoteBranch(made), made.candidate, "origin's branch holds exactly the verified candidate");
  assert.match(result.out, new RegExp(PR_URL.replaceAll(".", "\\.")));
  assert.match(result.out, new RegExp(`receipt ${made.digest}`), "names the receipt that verified the candidate");
  assert.match(result.out, /control checkout .* not checked/i, "says the control checkout's checks did not verify the candidate");
  const [push] = pushes(calls);
  assert.ok(push !== undefined);
  assert.ok(push.args.includes(`${made.candidate}:refs/heads/${BRANCH}`), "pushes the candidate SHA, not a name");
  assert.ok(!push.args.some((arg) => /^(--force|-f|--no-verify|--mirror|--all)$/.test(arg) || arg.startsWith("+")), "no forced or hook-skipping push");
  const create = calls.find((call) => call.command === "gh" && call.args[1] === "create");
  assert.ok(create !== undefined && !create.args.includes("--fill") && create.args.includes("--title") && create.args.includes("--body"));
  const body = create.args[create.args.indexOf("--body") + 1] ?? "";
  assert.match(body, new RegExp(made.digest), "the pull request body names the receipt");
  assert.match(body, /control checkout/i);
  assert.ok(!calls.some((call) => call.command === "gh" && (call.args.includes("merge") || call.args.includes("--approve"))), "never merges or approves");
});

await test("publication starts only git and gh, and every git that acts on the candidate disables hooks", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  assert.equal((await go(made, run)).code, EXIT_OK);
  assert.deepEqual([...new Set(calls.map((call) => call.command))].sort(), [...HOST_EXECUTABLES].sort());
  const onCandidate = calls.filter((call) => call.command === "git" && call.args.some((arg) => arg.startsWith("--git-dir")));
  assert.ok(onCandidate.length > 0, "the push acts on the quarantine repository");
  for (const call of onCandidate) assert.ok(call.args.join(" ").includes("core.hooksPath=/dev/null"), `hooks are disabled: git ${call.args.join(" ")}`);
  assert.ok(!calls.some((call) => call.args.includes("checkout") || call.args.includes("switch") || call.args.includes("worktree")), "the candidate is never checked out");
});

const sentinel = (path: string): string => `#!/bin/sh\ntouch '${path}'\n`;

function hooksDir(made: Fixture): string {
  const dir = join(made.markers, "hooks");
  mkdirSync(dir);
  for (const hook of ["pre-push", "reference-transaction", "post-checkout", "pre-commit", "push-to-checkout"]) {
    writeFileSync(join(dir, hook), sentinel(join(made.markers, `fired-${hook}`)));
    chmodSync(join(dir, hook), 0o755);
  }
  return dir;
}

await test("no hook runs, whether the control checkout or the host user's global config names a hooks directory", async (t) => {
  const made = await fixture(t);
  const hooks = hooksDir(made);
  made.host.git(["config", "core.hooksPath", hooks]);
  const { run } = runner(made, { hooksPath: hooks });
  assert.equal((await go(made, run)).code, EXIT_OK);
  assert.deepEqual(readdirSync(made.markers).filter((name) => name.startsWith("fired-")), [], "no hook fired on the host");
});

await test("candidate scripts and hooks are never executed, and changed check machinery is refused for human review", async (t) => {
  const markers = mkdtempSync(join(tmpdir(), "publication-planted-"));
  t.after(() => rmSync(markers, { recursive: true, force: true }));
  const planted = {
    "feature.txt": "ok\n", ".githooks/pre-push": sentinel(join(markers, "candidate-pre-push")),
    "package.json": JSON.stringify({ name: "planted", scripts: { check: `touch ${join(markers, "candidate-check")}`, test: "true" } }),
  };
  const made = await fixture(t, { files: planted });
  const { run, calls } = runner(made);
  await refusedUnpushed(made, run, calls, /human review/);
  assert.match((await go(made, run)).err, /\.githooks\/pre-push/);
  assert.deepEqual(readdirSync(markers), [], "no candidate executable ran");
});

await test("an unverified, failed or tampered receipt cannot publish", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  await refusedUnpushed(made, run, calls, /no receipt/, argsFor(made, { "--receipt": "a".repeat(64) }));
  const path = join(made.store, `${made.digest}.json`);
  const original = readFileSync(path, "utf8");
  writeFileSync(path, original.replace(made.run, "run-x"));
  await refusedUnpushed(made, run, calls, /changed after issue/);
  writeFileSync(path, original);
  const failed = await fixture(t, {}, FAIL);
  const failedRun = runner(failed);
  await refusedUnpushed(failed, failedRun.run, failedRun.calls, /outcome is failed/);
});

await test("a receipt for another run, task, base or candidate cannot publish this one", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  await refusedUnpushed(made, run, calls, /binds run run-1, not run-9/, argsFor(made, { "--run": "run-9" }));
  await refusedUnpushed(made, run, calls, /binds task issue-42, not issue-43/, argsFor(made, { "--task": "issue-43" }));
  await refusedUnpushed(made, run, calls, /binds candidate [0-9a-f]{40}, not f{40}/, argsFor(made, { "--candidate": "f".repeat(40) }));
  await refusedUnpushed(made, run, calls, /base e{40} has no readable package\.json/, argsFor(made, { "--base": "e".repeat(40) }));
});

await test("an artifact that is not the one the receipt verified is refused, even for the same receipt", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const other = anotherCandidate(made, { "feature.txt": "ok\n", "extra.txt": "more\n" });
  t.after(() => rmSync(other, { recursive: true, force: true }));
  await refusedUnpushed(made, run, calls, /imported [0-9a-f]{40}, not the verified candidate/, argsFor(made, { "--artifacts": other }));
  const manifestPath = join(made.artifacts, "candidate.json");
  writeFileSync(manifestPath, readFileSync(manifestPath, "utf8").replace('"claims":{"implement":"succeeded","review":"succeeded"}', '"claims":{"implement":"succeeded"}'));
  await refusedUnpushed(made, run, calls, /manifest is not the one the receipt verified/);
});

await test("a receipt for another branch ref, or a receipt with a rewritten ref, cannot publish", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  await refusedUnpushed(made, run, calls, /binds ref refs\/heads\/sandcastle\/issue-42, not refs\/heads\/sandcastle\/issue-43/, argsFor(made, { "--ref": "refs/heads/sandcastle/issue-43" }));
  const read = readReceipt(made.store, made.digest);
  assert.ok("receipt" in read);
  const forged = writeReceipt(made.store, { ...read.receipt, candidate: { ...read.receipt.candidate, ref: "refs/heads/main" } });
  await refusedUnpushed(made, run, calls, /Refusing to push main/, argsFor(made, { "--receipt": forged, "--ref": "refs/heads/main" }));
});

await test("a destination other than the receipt's repository is refused before anything is pushed", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  made.host.git(["remote", "set-url", "origin", OTHER_URL]);
  await refusedUnpushed(made, run, calls, /origin publishes to github\.com\/evil\/software_testing, but the receipt verified/);
  made.host.git(["remote", "set-url", "origin", ORIGIN_URL]);
  made.host.git(["config", "remote.origin.pushurl", OTHER_URL]);
  await refusedUnpushed(made, run, calls, /pushes to/);
  made.host.git(["config", "--unset", "remote.origin.pushurl"]);
  await refusedUnpushed(made, run, calls, /binds repository Zimfra\/software_testing, not Zimfra\/other/, argsFor(made, { "--repository": "Zimfra/other" }));
});

await test("the owner's or a code owner's login is refused before anything is pushed", async (t) => {
  const made = await fixture(t);
  const owner = runner(made, { gh: { user: "Zimfra" } });
  await refusedUnpushed(made, owner.run, owner.calls, /repository owner/);
  made.host.write(".github/CODEOWNERS", "* @code-owner\n");
  made.host.commit("chore: owners");
  made.host.git(["push", "--quiet", made.remote, "main"]);
  const codeOwner = runner(made, { gh: { user: "code-owner" } });
  await refusedUnpushed(made, codeOwner.run, codeOwner.calls, /code owner/);
});

await test("a candidate verified on a base that main has moved past is refused", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const elsewhere = mkdtempSync(join(tmpdir(), "publication-main-"));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));
  git(elsewhere, ["clone", "--quiet", "--branch", "main", made.remote, "."]);
  git(elsewhere, ["-c", "user.name=f", "-c", "user.email=f@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "main moves"]);
  git(elsewhere, ["push", "--quiet", "origin", "main"]);
  await refusedUnpushed(made, run, calls, /main has moved/);
});

await test("an uncommitted change in the control checkout refuses, since it would not be the pinned tooling", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  made.host.write("README.md", "edited\n");
  await refusedUnpushed(made, run, calls, /control checkout .* uncommitted/);
});

await test("a control checkout on a commit that origin's main does not hold refuses, since it would not be the pinned tooling", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  made.host.write("local.md", "unpushed\n");
  made.host.commit("chore: local only");
  await refusedUnpushed(made, run, calls, /control checkout is on [0-9a-f]{40}, which origin's main does not contain/);
});

await test("a verified base that origin's main does not contain refuses, since the pull request would carry unreviewed base commits", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  // The fixture's base is a root commit, so a main that does not contain it is a different history.
  const unrelated = made.host.git(["commit-tree", `${made.base}^{tree}`, "-m", "another main"]);
  made.host.git(["push", "--quiet", made.remote, `+${unrelated}:refs/heads/main`]);
  made.host.git(["reset", "--quiet", "--hard", unrelated]);
  await refusedUnpushed(made, run, calls, /the verified base [0-9a-f]{40} is not on origin's main/);
});

await test("a candidate verified on a base one commit ahead of origin's main refuses, since that base commit was never reviewed", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const ahead = made.host.commit("chore: base commit main does not hold");
  const guest = guestOn(made.host, ahead);
  guest.write("feature.txt", "ok\n");
  const candidate = guest.commit("feat: candidate on the unlanded base");
  const artifacts = exportArtifact(guest, ahead, candidate, {});
  guest.cleanup();
  t.after(() => rmSync(artifacts, { recursive: true, force: true }));
  const outcome = await verifyCandidate(
    { artifacts, source: made.host.dir, expected: { ...made.expected, base: ahead }, run: made.run, store: made.store, root: made.root, checks: CHECKS },
    { runtime: fakeRuntime(), reviewer: fakeReviewer() },
  );
  assert.equal(outcome.status, "passed", JSON.stringify(outcome));
  // The control checkout returns to main, so only the base is off main.
  made.host.git(["reset", "--quiet", "--hard", made.base]);
  const args = argsFor(made, { "--artifacts": artifacts, "--receipt": outcome.status === "passed" ? outcome.digest : "", "--base": ahead, "--candidate": candidate });
  await refusedUnpushed(made, run, calls, new RegExp(`the verified base ${ahead} is not on origin's main`), args);
});

await test("a self-inconsistent receipt refuses even under a valid digest", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const read = readReceipt(made.store, made.digest);
  assert.ok("receipt" in read);
  const { receipt } = read;
  const failedStep = receipt.checks.results.map((step) => ({ ...step, exit: 1 }));
  const forged = writeReceipt(made.store, { ...receipt, checks: { ...receipt.checks, results: failedStep } });
  await refusedUnpushed(made, run, calls, /outcome passed does not follow from its checks and review/, argsFor(made, { "--receipt": forged }));
});

await test("a remote branch holding other work is never rewritten", async (t) => {
  const made = await fixture(t);
  const { run, calls } = runner(made);
  const other = made.host.git(["commit-tree", `${made.base}^{tree}`, "-p", made.base, "-m", "someone else's work"]);
  made.host.git(["push", "--quiet", made.remote, `${other}:refs/heads/${BRANCH}`]);
  const result = await go(made, run);
  assert.equal(result.code, EXIT_REFUSED, result.out);
  assert.match(result.err, /Refusing to rewrite/);
  assert.equal(remoteBranch(made), other, "origin's branch is unchanged");
  assert.equal(pushes(calls).length, 0);
});

await test("a rerun reuses the exact open pull request instead of opening another", async (t) => {
  const made = await fixture(t);
  const first = runner(made);
  assert.equal((await go(made, first.run)).code, EXIT_OK);
  const again = runner(made, { gh: { list: (head) => json([exactPr(head)]) } });
  const result = await go(made, again.run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.ok(!again.calls.some((call) => call.command === "gh" && call.args[1] === "create"), "no second pull request");
  assert.equal(remoteBranch(made), made.candidate);
});

await test("a pull request that is not exactly the candidate into main is refused, and the push is reported", async (t) => {
  const made = await fixture(t);
  const wrong: [string, Record<string, unknown>, RegExp][] = [
    ["another head", { headRefOid: "f".repeat(40) }, /head is f+, not the checked commit/],
    ["another base", { baseRefName: "develop" }, /base is develop/],
    ["a fork", { isCrossRepository: true, headRepositoryOwner: { login: "Zimfra" } }, /cross-repository/],
  ];
  for (const [name, overrides, named] of wrong) {
    const { run } = runner(made, { gh: { view: (head) => json(exactPr(head, overrides)) } });
    const result = await go(made, run);
    assert.equal(result.code, EXIT_REFUSED, name);
    assert.match(result.err, named, name);
    assert.match(result.err, new RegExp(`${made.candidate} is already pushed to ${BRANCH}`), name);
  }
});

await test("a failure after the push says the candidate is already pushed and how to recover", async (t) => {
  const made = await fixture(t);
  const { run } = runner(made, { gh: { create: { status: 1, stdout: "" } } });
  await assert.rejects(go(made, run), new RegExp(`${made.candidate} is already pushed to ${BRANCH}.*rerun`, "s"));
  assert.equal(remoteBranch(made), made.candidate);
});

await test("a failed push names the uncertainty instead of claiming nothing reached origin", async (t) => {
  const made = await fixture(t);
  writeFileSync(join(made.remote, "hooks", "pre-receive"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(made.remote, "hooks", "pre-receive"), 0o755);
  const { run } = runner(made);
  await assert.rejects(go(made, run), /may or may not have reached origin/);
  assert.equal(remoteBranch(made), "");
});

await test("the CLI refuses wrong usage with exit 2", async (t) => {
  const made = await fixture(t);
  const { run } = runner(made);
  for (const args of [[], ["--artifacts"], [...argsFor(made), "--extra", "x"], argsFor(made, { "--base": "HEAD" }), argsFor(made, { "--receipt": "short" })]) {
    assert.equal((await go(made, run, args)).code, EXIT_ERROR, args.join(" "));
  }
  const help: string[] = [];
  assert.equal(await main(["--help"], { output: { write: (line) => help.push(line), warn: () => undefined } }), EXIT_OK);
  assert.match(help.join("\n"), /--receipt/);
  assert.ok(existsSync(made.host.dir));
});
