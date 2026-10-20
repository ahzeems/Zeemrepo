import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createCandidate, deltaBomb, describeBundle, REF, renameBundleRef, type CandidateFixture, type CandidateOptions } from "../test-support/artifact-fixture.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { LIMITS } from "./artifact.ts";
import { main, quarantineCandidate, runGit, trustedEnv, type Outcome } from "./quarantine.ts";

type Run = CandidateFixture & { root: string };

function fixture(t: TestContext, options: CandidateOptions = {}): Run {
  const made = createCandidate(options);
  const root = mkdtempSync(join(tmpdir(), "quarantine-root-"));
  t.after(() => { made.cleanup(); rmSync(root, { recursive: true, force: true }); });
  return { ...made, root };
}

const quarantine = (made: Run): Promise<Outcome> => quarantineCandidate({ artifacts: made.artifacts, source: made.host.dir, expected: made.expected, root: made.root });

async function refused(made: Run): Promise<string> {
  const outcome = await quarantine(made);
  assert.equal(outcome.accepted, false, "the candidate was accepted");
  return outcome.accepted ? "" : outcome.refusals.join("\n");
}

// Linux only: processes whose environment names `path`. Git exports GIT_DIR to every child, so
// this finds index-pack even after it is orphaned and reparented away from the fetch.
function processesUsing(path: string): string[] {
  return readdirSync("/proc").filter((name) => /^\d+$/.test(name)).flatMap((pid) => {
    try {
      if (!readFileSync(`/proc/${pid}/environ`, "latin1").includes(path)) return [];
      return [`${pid}: ${readFileSync(`/proc/${pid}/cmdline`, "latin1").replaceAll("\0", " ")}`];
    } catch {
      return [];
    }
  });
}

const hostRefs =(host: RepoFixture): string => host.git(["for-each-ref", "--format=%(refname) %(objectname)"]);

function inQuarantine(gitDir: string, args: readonly string[]): string {
  return execFileSync("git", ["--git-dir", gitDir, ...args], { env: cleanGitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

await test("a full candidate keeps its exact SHA and descends from the base", async (t) => {
  const made = fixture(t);
  const before = hostRefs(made.host);
  const outcome = await quarantine(made);
  assert.ok(outcome.accepted, outcome.accepted ? "" : outcome.refusals.join("\n"));
  assert.equal(outcome.candidate.sha, made.candidate);
  assert.equal(outcome.kind, "full");
  assert.equal(inQuarantine(outcome.gitDir, ["rev-parse", outcome.candidate.ref]), made.candidate);
  assert.equal(inQuarantine(outcome.gitDir, ["rev-parse", `${made.candidate}^`]), made.base);
  assert.equal(inQuarantine(outcome.gitDir, ["rev-parse", "--is-bare-repository"]), "true");
  assert.equal(inQuarantine(outcome.gitDir, ["for-each-ref", "refs/heads", "refs/tags"]), "", "nothing in quarantine is a publishable branch");
  assert.ok(outcome.quarantine.startsWith(made.root));
  assert.equal(hostRefs(made.host), before, "the trusted source repository is unchanged");
  assert.equal(made.host.git(["status", "--porcelain"]), "");
});

await test("an incremental candidate whose prerequisite is the base is accepted", async (t) => {
  const made = fixture(t, { incremental: true });
  const outcome = await quarantine(made);
  assert.ok(outcome.accepted, outcome.accepted ? "" : outcome.refusals.join("\n"));
  assert.equal(outcome.kind, "incremental");
  assert.deepEqual(outcome.prerequisites, [made.base]);
  assert.equal(inQuarantine(outcome.gitDir, ["rev-parse", outcome.candidate.ref]), made.candidate);
});

await test("builder claims and recovery data stay data without authority", async (t) => {
  const made = fixture(t, { recovery: "diff --git a/feature.txt b/feature.txt\n+uncommitted\n" });
  const outcome = await quarantine(made);
  assert.ok(outcome.accepted, outcome.accepted ? "" : outcome.refusals.join("\n"));
  assert.deepEqual(outcome.builderClaims, { implement: "succeeded", review: "succeeded" });
  assert.deepEqual(Object.keys(outcome).sort(), ["accepted", "base", "builderClaims", "candidate", "gitDir", "kind", "prerequisites", "quarantine", "recovery"]);
  assert.ok(outcome.recovery !== null);
  assert.ok(outcome.recovery.path.startsWith(outcome.quarantine));
  assert.equal(readFileSync(outcome.recovery.path, "utf8"), "diff --git a/feature.txt b/feature.txt\n+uncommitted\n");
  assert.equal(made.host.git(["status", "--porcelain"]), "", "recovery data is never restored into the host checkout");
  assert.equal(existsSync(join(made.host.dir, "feature.txt")), false);
});

await test("identity, prerequisite and integrity failures refuse in quarantine", async (t) => {
  await t.test("a candidate that does not descend from the base", async (t) => {
    const made = fixture(t);
    const stray = createRepo("artifact-stray-");
    t.after(() => stray.cleanup());
    const sha = stray.commit("unrelated");
    stray.git(["update-ref", REF, sha]);
    stray.git(["bundle", "create", "--quiet", join(made.root, "stray.bundle"), REF]);
    const bytes = readFileSync(join(made.root, "stray.bundle"));
    made.writeBundle(bytes);
    made.writeManifest(describeBundle({ ...made.manifest, candidate: { ref: REF, sha } }, bytes));
    assert.match((await refused(made)), /does not descend from the base/);
  });
  await t.test("a candidate equal to the base", async (t) => {
    const made = fixture(t);
    made.guest.git(["update-ref", REF, made.base]);
    made.guest.git(["bundle", "create", "--quiet", join(made.root, "same.bundle"), REF]);
    const bytes = readFileSync(join(made.root, "same.bundle"));
    made.writeBundle(bytes);
    made.writeManifest(describeBundle({ ...made.manifest, candidate: { ref: REF, sha: made.base } }, bytes));
    assert.match((await refused(made)), /adds no commit to the base/);
  });
  await t.test("a prerequisite missing from the base's history", async (t) => {
    const made = fixture(t);
    made.guest.write("more.txt", "more\n");
    const next = made.guest.commit("feat: more");
    made.guest.git(["update-ref", REF, next]);
    made.guest.git(["bundle", "create", "--quiet", join(made.root, "thin.bundle"), `^${made.candidate}`, REF]);
    const bytes = readFileSync(join(made.root, "thin.bundle"));
    made.writeBundle(bytes);
    made.writeManifest(describeBundle({ ...made.manifest, candidate: { ref: REF, sha: next } }, bytes, [made.candidate]));
    assert.match((await refused(made)), new RegExp(`prerequisite ${made.candidate} is not in the base's history`));
  });
  await t.test("a base the trusted source does not hold", async (t) => {
    const made = fixture(t);
    const other = createRepo("artifact-other-");
    t.after(() => other.cleanup());
    other.commit("elsewhere");
    const outcome = await quarantineCandidate({ artifacts: made.artifacts, source: other.dir, expected: made.expected, root: made.root });
    assert.equal(outcome.accepted, false);
    assert.match(outcome.accepted ? "" : outcome.refusals.join("\n"), /trusted source does not hold the base/);
  });
  await t.test("a delta bomb stops at the allocation limit, not after inflating", async (t) => {
    const made = fixture(t);
    // 262 bytes that inflate to 192 MiB: small enough to stay safe if the limit is missing.
    const bytes = deltaBomb(REF, made.candidate, 3072);
    made.writeBundle(bytes);
    made.writeManifest(describeBundle(made.manifest, bytes));
    assert.match((await refused(made)), /Git refused the bundle \(fetch exit \d+\): fatal: attempting to allocate \d+ over limit/);
  });
  await t.test("a slow import is stopped with its whole process group at the timeout", async (t) => {
    const made = fixture(t);
    // 60 deltas of up to 48 MiB each: every one is under the allocation limit, together seconds of work.
    const bytes = deltaBomb(REF, made.candidate, 768, 60);
    made.writeBundle(bytes);
    made.writeManifest(describeBundle(made.manifest, bytes));
    const outcome = await quarantineCandidate({ artifacts: made.artifacts, source: made.host.dir, expected: made.expected, root: made.root, timeoutMs: 1000 });
    assert.ok(!outcome.accepted && outcome.quarantine !== null, "the slow candidate was not refused with its quarantine kept");
    const quarantined = outcome.quarantine;
    // If this case fails, an orphaned index-pack is still running; stop exactly those processes.
    t.after(() => {
      for (const found of processesUsing(quarantined)) {
        try {
          process.kill(Number(found.split(":")[0]), "SIGKILL");
        } catch {
          // Already exited.
        }
      }
    });
    assert.match(outcome.refusals.join("\n"), /Git did not finish fetch within 1000 ms/);
    let left = processesUsing(outcome.quarantine);
    for (let wait = 0; wait < 20 && left.length > 0; wait += 1) {
      await new Promise((done) => setTimeout(done, 100));
      left = processesUsing(outcome.quarantine);
    }
    assert.deepEqual(left, [], "a Git process outlived the timeout");
  });
  await t.test("a branch line that names an annotated tag", async (t) => {
    const made = fixture(t);
    made.guest.git(["tag", "--annotate", "--message", "a tag, not a commit", "candidate-tag", made.candidate]);
    const tag = made.guest.git(["rev-parse", "refs/tags/candidate-tag"]);
    made.guest.git(["bundle", "create", "--quiet", join(made.root, "tag.bundle"), "refs/tags/candidate-tag"]);
    const bytes = renameBundleRef(readFileSync(join(made.root, "tag.bundle")), "refs/tags/candidate-tag", REF);
    made.writeBundle(bytes);
    made.writeManifest(describeBundle({ ...made.manifest, candidate: { ref: REF, sha: tag } }, bytes));
    assert.match((await refused(made)), /the candidate ref names a tag, not a commit/);
  });
  await t.test("a corrupt pack behind a valid header and digest", async (t) => {
    const made = fixture(t);
    const bytes = made.bundle();
    const pack = bytes.indexOf("PACK");
    const corrupt = Buffer.concat([bytes.subarray(0, pack + 12), Buffer.alloc(bytes.length - pack - 12, 0x41)]);
    made.writeBundle(corrupt);
    made.writeManifest(describeBundle(made.manifest, corrupt));
    assert.match((await refused(made)), /Git refused the bundle/);
  });
  await t.test("a candidate tree with a .git entry", async (t) => {
    const made = fixture(t);
    const blob = made.guest.git(["hash-object", "-w", "feature.txt"]);
    const tree = execFileSync("git", ["mktree"], { cwd: made.guest.dir, env: cleanGitEnv, input: `100644 blob ${blob}\t.git\n`, encoding: "utf8" }).trim();
    const sha = made.guest.git(["commit-tree", tree, "-p", made.base, "-m", "feat: plant a .git entry"]);
    made.guest.git(["update-ref", REF, sha]);
    made.guest.git(["bundle", "create", "--quiet", join(made.root, "dotgit.bundle"), REF]);
    const bytes = readFileSync(join(made.root, "dotgit.bundle"));
    made.writeBundle(bytes);
    made.writeManifest(describeBundle({ ...made.manifest, candidate: { ref: REF, sha } }, bytes));
    assert.match((await refused(made)), /Git refused the bundle \(fetch exit/);
  });
  await t.test("a manifest identity failure keeps the rejected artifact for diagnostics", async (t) => {
    const made = fixture(t);
    made.writeManifest({ ...made.manifest, task: "issue-7" });
    const outcome = await quarantine(made);
    assert.equal(outcome.accepted, false);
    assert.ok(!outcome.accepted && outcome.quarantine !== null && existsSync(join(outcome.quarantine, "candidate.json")));
  });
});

const sentinelHook = (path: string): string => `#!/bin/sh\ntouch '${path}'\n`;

await test("no guest Git configuration, hook or manifest command executes on the host", async (t) => {
  const markers = mkdtempSync(join(tmpdir(), "artifact-markers-"));
  t.after(() => rmSync(markers, { recursive: true, force: true }));
  const marker = (name: string): string => join(markers, name);
  const made = fixture(t, {
    // A tracked hook file in the candidate is content, not configuration.
    executables: { ".githooks/reference-transaction": sentinelHook(marker("tracked-hook")), ".githooks/post-checkout": sentinelHook(marker("tracked-hook")) },
    plant: (guest) => {
      guest.git(["config", "core.fsmonitor", `touch '${marker("fsmonitor")}'; false`]);
      mkdirSync(join(guest.dir, ".git", "hooks"), { recursive: true });
      for (const hook of ["reference-transaction", "post-checkout", "post-merge"]) {
        writeFileSync(join(guest.dir, ".git", "hooks", hook), sentinelHook(marker("hook")));
        chmodSync(join(guest.dir, ".git", "hooks", hook), 0o755);
      }
    },
  });
  made.writeManifest({ ...made.manifest, command: `touch '${marker("manifest")}'` });
  assert.match((await refused(made)), /unknown key command/);
  made.writeManifest(made.manifest);

  const outcome = await quarantine(made);
  assert.ok(outcome.accepted, outcome.accepted ? "" : outcome.refusals.join("\n"));
  assert.deepEqual(readdirSync(markers), [], "no sentinel fired on the host");
  assert.equal(inQuarantine(outcome.gitDir, ["cat-file", "-t", `${made.candidate}:.githooks/reference-transaction`]), "blob", "the tracked hook arrived as content");
  const config = inQuarantine(outcome.gitDir, ["config", "--local", "--list"]);
  assert.doesNotMatch(config, /fsmonitor|hookspath/i);
  assert.deepEqual(readdirSync(outcome.quarantine).sort(), ["candidate.bundle", "candidate.json", "repo.git"], "no candidate file is checked out");

  made.guest.git(["update-ref", "refs/heads/probe", made.candidate]);
  made.guest.git(["status", "--porcelain"]);
  assert.ok(existsSync(marker("hook")) && existsSync(marker("fsmonitor")), "the planted guest probes are armed");
  made.guest.git(["-c", "core.hooksPath=.githooks", "update-ref", "refs/heads/probe2", made.candidate]);
  assert.ok(existsSync(marker("tracked-hook")), "the tracked hook is armed when Git is told to use it");
});

await test("the host user's Git configuration does not run during quarantine", async (t) => {
  const markers = mkdtempSync(join(tmpdir(), "artifact-home-"));
  t.after(() => rmSync(markers, { recursive: true, force: true }));
  const sentinel = join(markers, "host-config");
  const hook = `f() { touch '${sentinel}'; "$@"; }; f`;
  writeFileSync(join(markers, ".gitconfig"), `[uploadpack]\n\tpackObjectsHook = ${JSON.stringify(hook)}\n`);
  const saved = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.HOME = markers;
  delete process.env.XDG_CONFIG_HOME;
  t.after(() => { process.env.HOME = saved.HOME; if (saved.XDG_CONFIG_HOME !== undefined) process.env.XDG_CONFIG_HOME = saved.XDG_CONFIG_HOME; });
  const made = fixture(t);
  const outcome = await quarantine(made);
  assert.ok(outcome.accepted, outcome.accepted ? "" : outcome.refusals.join("\n"));
  // The hook is armed: with GIT_CONFIG_GLOBAL dropped from quarantine's environment, this test
  // fails because the base fetch runs it. Test code may not set a GIT_ variable, and a -c value
  // did not reach upload-pack in a local fetch (git 2.53), so the probe is not re-armed here.
  assert.equal(existsSync(sentinel), false, "the host user's packObjectsHook ran");
});

await test("Git output over its limit is a refusal that keeps the quarantine", async (t) => {
  const made = fixture(t);
  const outcome = await quarantineCandidate({ artifacts: made.artifacts, source: made.host.dir, expected: made.expected, root: made.root, limits: { ...LIMITS, gitOutputBytes: 1 } });
  assert.ok(!outcome.accepted && outcome.quarantine !== null, "the over-long output was not refused with its quarantine kept");
  assert.match(outcome.refusals.join("\n"), /git \S+ wrote more than 1 bytes in quarantine/);
});

await test("stopping a Git command always settles, whatever the group kill finds", { timeout: 30_000 }, async (t) => {
  const gitDir = mkdtempSync(join(tmpdir(), "quarantine-run-"));
  t.after(() => rmSync(gitDir, { recursive: true, force: true }));
  const failing = (code: string) => (): void => { throw Object.assign(new Error(`kill ${code}`), { code }); };
  // The command sleeps, so the 50 ms deadline always fires before git exits; `git version` with a
  // 0 ms deadline raced the timer and lost on a fast CI runner (run 39133561433).
  const slow = ["-c", "alias.slow=!sleep 0.5", "slow"];
  // The group is reported gone, so the kill must not throw out of the timer.
  await assert.rejects(runGit(gitDir, slow, { timeoutMs: 50, maxOutput: 1 << 20, kill: failing("ESRCH") }), /did not finish -c within 50 ms/);
  // Any other kill failure is the tool's error, reported through the promise.
  await assert.rejects(runGit(gitDir, slow, { timeoutMs: 50, maxOutput: 1 << 20, kill: failing("EPERM") }), /kill EPERM/);
});

await test("output that arrives after Git has exited still settles at once", { timeout: 5_000 }, async (t) => {
  const gitDir = mkdtempSync(join(tmpdir(), "quarantine-run-"));
  t.after(() => rmSync(gitDir, { recursive: true, force: true }));
  // The alias backgrounds its output and exits, so the over-limit output comes after git's exit
  // while the background shell still holds the pipes: the stop must not wait for close.
  const started = Date.now();
  await assert.rejects(runGit(gitDir, ["-c", "alias.late=!(sleep 0.3; echo late-output) & exit 0", "late"], { timeoutMs: 60_000, maxOutput: 0 }), /wrote more than 0 bytes/);
  assert.ok(Date.now() - started < 3_000, `settled after ${String(Date.now() - started)} ms`);
});

await test("output exactly at the cap is kept and one byte over is refused", { timeout: 10_000 }, async (t) => {
  const gitDir = mkdtempSync(join(tmpdir(), "quarantine-run-"));
  t.after(() => rmSync(gitDir, { recursive: true, force: true }));
  const probe = await runGit(gitDir, ["version"], { timeoutMs: 60_000, maxOutput: 1 << 20 });
  const bytes = Buffer.byteLength(`${probe.stdout}\n`);
  assert.equal((await runGit(gitDir, ["version"], { timeoutMs: 60_000, maxOutput: bytes })).stdout, probe.stdout);
  await assert.rejects(runGit(gitDir, ["version"], { timeoutMs: 60_000, maxOutput: bytes - 1 }), new RegExp(`wrote more than ${String(bytes - 1)} bytes`));
});

await test("quarantine's Git environment drops inherited routing and pins config and memory", () => {
  const saved = process.env.GIT_DIR;
  process.env.GIT_DIR = join(tmpdir(), "decoy.git");
  let env: NodeJS.ProcessEnv;
  try {
    env = trustedEnv();
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = saved;
  }
  assert.equal(env.GIT_DIR, undefined);
  // A system gitconfig cannot be planted from a test, so the switch itself is pinned here.
  assert.equal(env.GIT_CONFIG_NOSYSTEM, "1");
  assert.equal(env.GIT_ALLOC_LIMIT, "64m");
});

async function cli(args: readonly string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: await main(args, { output }), out: out.join("\n"), err: err.join("\n") };
}

function cliArgs(made: Run): string[] {
  return ["--artifacts", made.artifacts, "--source", made.host.dir, "--repository", made.expected.repository, "--task", made.expected.task,
    "--base", made.base, "--ref", made.expected.ref, "--quarantine-root", made.root];
}

await test("the quarantine CLI exits 0 for a valid candidate, 1 for a refusal and 2 for bad usage", async (t) => {
  await t.test("valid", async (t) => {
    const made = fixture(t);
    const result = await cli(cliArgs(made));
    assert.equal(result.code, EXIT_OK, result.err);
    assert.match(result.out, new RegExp(`accepted candidate ${made.candidate}`));
    assert.match(result.out, /builder claims are not verification/);
  });
  await t.test("refused", async (t) => {
    const made = fixture(t);
    made.writeManifest({ ...made.manifest, version: 2 });
    const result = await cli(cliArgs(made));
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /version 2/);
    assert.match(result.err, /kept for diagnostics in /);
  });
  await t.test("usage", async () => {
    assert.equal((await cli(["--artifacts"])).code, EXIT_ERROR);
    assert.equal((await cli(["--artifacts", "x", "--bogus", "y"])).code, EXIT_ERROR);
    assert.equal((await cli(["--artifacts", "x"])).code, EXIT_ERROR, "missing required flags");
    assert.equal((await cli(["--help"])).code, EXIT_OK);
  });
  await t.test("an expectation that is not a SHA or a branch ref", async (t) => {
    const made = fixture(t);
    const args = cliArgs(made);
    args[args.indexOf("--base") + 1] = "HEAD";
    assert.equal((await cli(args)).code, EXIT_ERROR);
    const refArgs = cliArgs(made);
    refArgs[refArgs.indexOf("--ref") + 1] = "refs/tags/v1";
    assert.equal((await cli(refArgs)).code, EXIT_ERROR);
  });
});
