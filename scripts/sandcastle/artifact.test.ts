import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createCandidate, describeBundle, renameBundleRef, type CandidateFixture, type CandidateOptions } from "../test-support/artifact-fixture.ts";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { isRecord } from "../lib/record.ts";
import { LIMITS, checkArtifacts, parseBundleHeader } from "./artifact.ts";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const bundleOf = (manifest: Record<string, unknown>): Record<string, unknown> => (isRecord(manifest.bundle) ? manifest.bundle : {});

function fixture(t: TestContext, options: CandidateOptions = {}): CandidateFixture {
  const made = createCandidate(options);
  t.after(() => made.cleanup());
  return made;
}

function refusalsOf(made: CandidateFixture, limits = LIMITS): string {
  const result = checkArtifacts(made.artifacts, made.expected, limits);
  assert.ok("refusals" in result, "the artifact was accepted");
  return result.refusals.join("\n");
}

await test("a full candidate's manifest and bundle header agree with the trusted expectation", (t) => {
  const made = fixture(t);
  const result = checkArtifacts(made.artifacts, made.expected);
  assert.ok("manifest" in result, "refusals" in result ? result.refusals.join("\n") : "");
  assert.equal(result.manifest.candidate.sha, made.candidate);
  assert.deepEqual(result.header.refs, [{ sha: made.candidate, ref: made.expected.ref }]);
  assert.deepEqual(result.header.prerequisites, []);
  assert.equal(result.recovery, null);
});

await test("an incremental candidate names its prerequisite in the header and the manifest", (t) => {
  const made = fixture(t, { incremental: true, recovery: "diff --git a/x b/x\n" });
  const result = checkArtifacts(made.artifacts, made.expected);
  assert.ok("manifest" in result, "refusals" in result ? result.refusals.join("\n") : "");
  assert.deepEqual(result.header.prerequisites, [made.base]);
  assert.equal(result.recovery?.toString(), "diff --git a/x b/x\n");
});

await test("manifest identities that differ from the trusted expectation refuse", async (t) => {
  const cases: [string, (m: Record<string, unknown>, made: CandidateFixture) => unknown, RegExp][] = [
    ["another version", (m) => ({ ...m, version: 2 }), /version 2.*not 1/],
    ["another repository", (m) => ({ ...m, repository: "someone/else" }), /repository someone\/else/],
    ["another task", (m) => ({ ...m, task: "issue-7" }), /task issue-7/],
    ["another base", (m) => ({ ...m, base: SHA_A }), /base a{40}/],
    ["another ref", (m, made) => ({ ...m, candidate: { ref: "refs/heads/main", sha: made.candidate } }), /ref refs\/heads\/main/],
    ["a short SHA", (m, made) => ({ ...m, candidate: { ref: made.expected.ref, sha: "abc123" } }), /candidate\.sha/],
    ["an unknown key that could carry a command", (m) => ({ ...m, command: "touch /tmp/pwned" }), /unknown key command/],
    ["a path for the bundle", (m) => ({ ...m, bundle: { ...bundleOf(m), file: "../../outside.bundle" } }), /unknown key bundle\.file/],
    ["a forged verification label", (m) => ({ ...m, verified: true }), /unknown key verified/],
    ["a claim for a phase the builder does not own", (m) => ({ ...m, claims: { implement: "succeeded", verify: "succeeded" } }), /claims\.verify/],
    ["a claim outcome outside the list", (m) => ({ ...m, claims: { review: "approved" } }), /claims\.review/],
    ["a manifest that is not an object", () => [1, 2], /not a JSON object/],
  ];
  for (const [name, change, named] of cases) {
    await t.test(name, (t) => {
      const made = fixture(t);
      made.writeManifest(change(made.manifest, made));
      assert.match(refusalsOf(made), named);
    });
  }
});

await test("malformed and oversized data refuse", async (t) => {
  await t.test("malformed JSON", (t) => {
    const made = fixture(t);
    made.writeManifest("{ \"version\": 1,");
    assert.match(refusalsOf(made), /candidate\.json is not valid JSON/);
  });
  await t.test("an oversized manifest", (t) => {
    const made = fixture(t);
    assert.match(refusalsOf(made, { ...LIMITS, manifestBytes: 64 }), /candidate\.json is over 64 bytes/);
  });
  await t.test("an oversized bundle", (t) => {
    const made = fixture(t);
    assert.match(refusalsOf(made, { ...LIMITS, bundleBytes: 32 }), /candidate\.bundle is over 32 bytes/);
  });
  await t.test("oversized recovery data", (t) => {
    const made = fixture(t, { recovery: "x".repeat(100) });
    assert.match(refusalsOf(made, { ...LIMITS, recoveryBytes: 10 }), /recovery\.data is over 10 bytes/);
  });
  await t.test("too many prerequisites", (t) => {
    const made = fixture(t);
    made.writeManifest({ ...made.manifest, bundle: { ...bundleOf(made.manifest), prerequisites: [SHA_A, SHA_B] } });
    assert.match(refusalsOf(made, { ...LIMITS, prerequisites: 1 }), /more than 1 prerequisite/);
  });
  await t.test("a bundle whose digest does not match", (t) => {
    const made = fixture(t);
    const bytes = made.bundle();
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    made.writeBundle(bytes);
    assert.match(refusalsOf(made), /candidate\.bundle has sha256 [0-9a-f]{64}, but the manifest says/);
  });
  await t.test("recovery data the manifest does not describe", (t) => {
    const made = fixture(t);
    writeFileSync(join(made.artifacts, "recovery.data"), "unannounced");
    assert.match(refusalsOf(made), /recovery\.data is present, but the manifest does not describe it/);
  });
  await t.test("recovery data the manifest describes but is missing", (t) => {
    const made = fixture(t);
    made.writeManifest({ ...made.manifest, recovery: { sha256: "0".repeat(64), bytes: 1 } });
    assert.match(refusalsOf(made), /describes recovery\.data, but it is missing/);
  });
});

await test("a bundle header that disagrees with the manifest refuses", async (t) => {
  await t.test("a different candidate SHA", (t) => {
    const made = fixture(t);
    made.writeManifest({ ...made.manifest, candidate: { ref: made.expected.ref, sha: made.base } });
    assert.match(refusalsOf(made), new RegExp(`bundle ref ${made.expected.ref} is ${made.candidate}, but the manifest says ${made.base}`));
  });
  await t.test("an unexpected extra ref", (t) => {
    const made = fixture(t, { bundleRefs: ["refs/heads/sandcastle/issue-42", "refs/heads/main"] });
    assert.match(refusalsOf(made), /carries ref refs\/heads\/main, which is not the candidate ref/);
  });
  await t.test("the candidate ref twice at the same SHA", (t) => {
    const made = fixture(t);
    const line = `${made.candidate} ${made.expected.ref}\n`;
    const bytes = made.bundle();
    const at = bytes.indexOf(line);
    const doubled = Buffer.concat([bytes.subarray(0, at), Buffer.from(line), bytes.subarray(at)]);
    made.writeBundle(doubled);
    made.writeManifest(describeBundle(made.manifest, doubled));
    assert.match(refusalsOf(made), /carries the candidate ref refs\/heads\/sandcastle\/issue-42 more than once/);
  });
  await t.test("only another ref", (t) => {
    const made = fixture(t, { bundleRefs: ["refs/heads/main"] });
    assert.match(refusalsOf(made), /does not carry the candidate ref/);
  });
  await t.test("prerequisites the manifest does not list", (t) => {
    const made = fixture(t, { incremental: true });
    made.writeManifest(describeBundle(made.manifest, made.bundle(), []));
    assert.match(refusalsOf(made), /prerequisites .* do not match the manifest's/);
  });
});

await test("bundle headers are parsed strictly", () => {
  const header = (text: string): Buffer => Buffer.concat([Buffer.from(text), Buffer.from("PACK")]);
  const ok = parseBundleHeader(header(`# v2 git bundle\n-${SHA_A} base\n${SHA_B} refs/heads/x\n\n`));
  assert.deepEqual(ok, { header: { prerequisites: [SHA_A], refs: [{ sha: SHA_B, ref: "refs/heads/x" }] } });
  const v3 = parseBundleHeader(header(`# v3 git bundle\n@object-format=sha1\n${SHA_B} refs/heads/x\n\n`));
  assert.ok("header" in v3);
  const refused: [string, string, RegExp][] = [
    ["an unknown signature", `# v9 git bundle\n${SHA_B} refs/heads/x\n\n`, /signature/],
    ["a partial bundle filter", `# v3 git bundle\n@object-format=sha1\n@filter=blob:none\n${SHA_B} refs/heads/x\n\n`, /capability @filter=blob:none/],
    ["another object format", `# v3 git bundle\n@object-format=sha256\n${SHA_B} refs/heads/x\n\n`, /capability @object-format=sha256/],
    ["a malformed line", `# v2 git bundle\nnot a ref line\n\n`, /malformed header line/],
    ["no end of header", `# v2 git bundle\n${SHA_B} refs/heads/x\n`, /header does not end/],
    ["an object format line in a v2 bundle", `# v2 git bundle\n@object-format=sha1\n${SHA_B} refs/heads/x\n\n`, /capability @object-format=sha1/],
    ["a header past 64 KiB", `# v2 git bundle\n-${SHA_A} ${"x".repeat(70 * 1024)}\n${SHA_B} refs/heads/x\n\n`, /does not end within 65536 bytes/],
  ];
  for (const [name, text, named] of refused) {
    const result = parseBundleHeader(Buffer.from(text));
    assert.ok("refusals" in result, name);
    assert.match(result.refusals.join("\n"), named, name);
  }
});

await test("unsafe entries in the artifact directory refuse", async (t) => {
  const cases: [string, (made: CandidateFixture) => void, RegExp][] = [
    ["a symlinked bundle", (made) => {
      renameSync(join(made.artifacts, "candidate.bundle"), join(made.artifacts, "real"));
      symlinkSync(join(made.artifacts, "real"), join(made.artifacts, "candidate.bundle"));
    }, /candidate\.bundle is not a regular file/],
    ["a symlinked manifest pointing outside", (made) => {
      renameSync(join(made.artifacts, "candidate.json"), join(made.guest.dir, "manifest.json"));
      symlinkSync(join(made.guest.dir, "manifest.json"), join(made.artifacts, "candidate.json"));
    }, /candidate\.json is not a regular file/],
    ["a Git directory", (made) => mkdirSync(join(made.artifacts, ".git")), /unexpected entry \.git/],
    ["a hooks directory", (made) => { mkdirSync(join(made.artifacts, "hooks")); writeFileSync(join(made.artifacts, "hooks", "post-checkout"), "#!/bin/sh\n"); }, /unexpected entry hooks/],
    ["a guest Git config", (made) => writeFileSync(join(made.artifacts, "config"), "[core]\n\tfsmonitor = touch /tmp/x\n"), /unexpected entry config/],
    ["a traversal-like name", (made) => writeFileSync(join(made.artifacts, "..candidate.bundle"), ""), /unexpected entry \.\.candidate\.bundle/],
    ["a name with a newline", (made) => writeFileSync(join(made.artifacts, "candidate.json\nx"), ""), /unexpected entry "candidate\.json\\nx"/],
    ["an executable bundle", (made) => chmodSync(join(made.artifacts, "candidate.bundle"), 0o755), /candidate\.bundle is executable/],
    ["a missing bundle", (made) => renameSync(join(made.artifacts, "candidate.bundle"), join(made.guest.dir, "moved.bundle")), /candidate\.bundle is missing/],
  ];
  for (const [name, plant, named] of cases) {
    await t.test(name, (t) => {
      const made = fixture(t);
      plant(made);
      assert.match(refusalsOf(made), named);
    });
  }
  await t.test("an artifact path that is a symlink", (t) => {
    const made = fixture(t);
    const link = join(made.guest.dir, "artifacts-link");
    symlinkSync(made.artifacts, link);
    const result = checkArtifacts(link, made.expected);
    assert.ok("refusals" in result);
    assert.match(result.refusals.join("\n"), /is not a directory/);
  });
  await t.test("a FIFO in place of the bundle, opened without blocking", (t) => {
    const made = fixture(t);
    renameSync(join(made.artifacts, "candidate.bundle"), join(made.guest.dir, "moved.bundle"));
    execFileSync("mkfifo", [join(made.artifacts, "candidate.bundle")], { env: cleanGitEnv });
    assert.match(refusalsOf(made), /candidate\.bundle is not a regular file/);
  });
  await t.test("a FIFO is refused without being opened", async (t) => {
    const made = fixture(t);
    const fifo = join(made.artifacts, "candidate.bundle");
    const opened = join(made.guest.dir, "opened");
    renameSync(fifo, join(made.guest.dir, "moved.bundle"));
    execFileSync("mkfifo", [fifo], { env: cleanGitEnv });
    // The writer's open blocks until a reader opens the FIFO; only then does it leave a marker.
    const writer = spawn("sh", ["-c", `exec 3>'${fifo}' && touch '${opened}'`], { env: cleanGitEnv, stdio: "ignore" });
    t.after(() => writer.kill("SIGKILL"));
    await new Promise((done) => setTimeout(done, 200));
    assert.match(refusalsOf(made), /candidate\.bundle is not a regular file/);
    await new Promise((done) => setTimeout(done, 300));
    assert.equal(existsSync(opened), false, "the FIFO was opened");
  });
  await t.test("an unreadable manifest refuses instead of failing the tool", (t) => {
    const made = fixture(t);
    chmodSync(join(made.artifacts, "candidate.json"), 0o000);
    assert.match(refusalsOf(made), /candidate\.json cannot be read/);
  });
});

await test("a file exactly at its size limit is accepted", (t) => {
  const made = fixture(t, { recovery: "0123456789" });
  const manifestBytes = Buffer.byteLength(JSON.stringify(made.manifest));
  const result = checkArtifacts(made.artifacts, made.expected, { ...LIMITS, manifestBytes, bundleBytes: made.bundle().length, recoveryBytes: 10 });
  assert.ok("manifest" in result, "refusals" in result ? result.refusals.join("\n") : "");
});

await test("refusal text escapes control, format and bidi characters from the artifact", async (t) => {
  // Terminal escapes, then the bidi and format characters that reorder or hide text on screen.
  const escape = "\u001b]0;pwned\u0007\u001b[2K\u009b\u202e24-eussi\u2066\u2067\u2068\u2069\u200e\u200f\u061c\u2028\u2029\u200b\ufeff";
  const cases: [string, (made: CandidateFixture) => void][] = [
    ["a manifest string", (made) => made.writeManifest({ ...made.manifest, task: escape })],
    ["an unknown key", (made) => made.writeManifest({ ...made.manifest, [escape]: 1 })],
    ["a claim key", (made) => made.writeManifest({ ...made.manifest, claims: { [escape]: "succeeded" } })],
    ["a claim value", (made) => made.writeManifest({ ...made.manifest, claims: { review: escape } })],
    ["a bundle header ref", (made) => {
      const bytes = renameBundleRef(made.bundle(), made.expected.ref, `refs/heads/${escape}`);
      made.writeBundle(bytes);
      made.writeManifest(describeBundle(made.manifest, bytes));
    }],
  ];
  for (const [name, plant] of cases) {
    await t.test(name, (t) => {
      const made = fixture(t);
      plant(made);
      const result = checkArtifacts(made.artifacts, made.expected);
      assert.ok("refusals" in result, "the artifact was accepted");
      for (const line of result.refusals) assert.doesNotMatch(line, /[\p{Cc}\p{Cf}\u2028\u2029]/u, `raw control or format character in: ${JSON.stringify(line)}`);
      assert.match(result.refusals.join("\n"), /\\u001b/);
      assert.match(result.refusals.join("\n"), /\\u202e/);
    });
  }
});
