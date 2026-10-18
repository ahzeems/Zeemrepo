import assert from "node:assert/strict";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import {
  anotherCandidate, BASE_TEST, CHECKS, createVerifierCandidate, FAIL, fakeReviewer, fakeRuntime, packageWithTest, PASS,
  type FakeReviewer, type FakeRuntime, type VerifierFixture, type VerifierOptions,
} from "../test-support/verifier-fixture.ts";
import type { Runtime } from "./container-runtime.ts";
import { definitionsDigest, readReceipt, validateReceipt, writeReceipt, type Expectation, type Receipt } from "./verification-receipt.ts";
import {
  checkDefinitions, checkNamesOf, INSTALL_COMMAND, machineryPaths, noReviewer, trustedChecksDigest, verifyCandidate,
  type Reviewer, type Verification,
} from "./verifier-driver.ts";

function fixture(t: TestContext, options: VerifierOptions = {}): VerifierFixture {
  const made = createVerifierCandidate(options);
  t.after(() => made.cleanup());
  return made;
}

type Deps = { runtime?: Runtime; reviewer?: Reviewer };

function verify(made: VerifierFixture, deps: Deps = {}, overrides: { artifacts?: string; run?: string } = {}): Promise<Verification> {
  return verifyCandidate(
    { artifacts: overrides.artifacts ?? made.artifacts, source: made.host.dir, expected: made.expected, run: overrides.run ?? made.run, store: made.store, root: made.root, checks: CHECKS },
    { runtime: deps.runtime ?? fakeRuntime(), reviewer: deps.reviewer ?? fakeReviewer() },
  );
}

function expectation(made: VerifierFixture, candidate: string, run = made.run): Expectation {
  const checks = trustedChecksDigest(made.host.dir, made.base, CHECKS);
  assert.ok("digest" in checks, "the base defines the fixture checks");
  return { repository: made.expected.repository, task: made.expected.task, run, base: made.base, candidate, checksSha256: checks.digest };
}

const validateIn = (made: VerifierFixture, digest: string, expect: Expectation): ReturnType<typeof validateReceipt> =>
  validateReceipt(made.store, digest, expect, { source: made.host.dir, artifacts: made.artifacts });

function digestOf(outcome: Verification): string {
  assert.ok(outcome.status === "passed" || outcome.status === "failed", `expected a receipt, got ${JSON.stringify(outcome)}`);
  return outcome.digest;
}

const receipts = (made: VerifierFixture): string[] => readdirSync(made.store).sort();

await test("a passing unchanged candidate receives a receipt that validates from the host store", async (t) => {
  const made = fixture(t);
  const runtime = fakeRuntime();
  const reviewer = fakeReviewer();
  const outcome = await verify(made, { runtime, reviewer });
  assert.equal(outcome.status, "passed", JSON.stringify(outcome));
  const digest = digestOf(outcome);
  assert.deepEqual(receipts(made), [`${digest}.json`]);
  const valid = validateIn(made, digest, expectation(made, made.candidate));
  assert.ok("receipt" in valid, JSON.stringify(valid));
  assert.deepEqual(valid.humanReview, []);
  const { receipt } = valid;
  assert.equal(receipt.candidate.sha, made.candidate);
  assert.equal(receipt.base, made.base);
  assert.equal(receipt.runner.image, "sha256:fake-image");
  assert.match(receipt.runner.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(receipt.checks.results.map((step) => [step.name, step.command, step.exit]), [["test", BASE_TEST, 0]]);
  assert.equal(receipt.checks.install.command, INSTALL_COMMAND);
  assert.equal(receipt.review.reviewer.name, "fake-reviewer");
  assert.equal(reviewer.inputs.length, 1, "the reviewer ran once");
  assert.match(reviewer.inputs[0]?.diff ?? "", /\+\+\+ b\/feature\.txt/);
});

await test("the runtime gets only the candidate's tracked tree, never artifact, recovery or Git state", async (t) => {
  const made = fixture(t, { recovery: "implementer session state" });
  const runtime = fakeRuntime();
  await verify(made, { runtime });
  const entries = runtime.calls[0]?.entries ?? [];
  assert.deepEqual([...entries].filter((entry) => !entry.endsWith("/")).sort(), ["README.md", "check/feature.mjs", "feature.txt", "package-lock.json", "package.json"]);
  for (const forbidden of [/\.git/, /candidate\.json/, /candidate\.bundle/, /recovery/]) assert.ok(!entries.some((entry) => forbidden.test(entry)), String(forbidden));
});

await test("builder-written success cannot stand in for verification: claims are ignored and a failing check fails", async (t) => {
  const made = fixture(t, { claims: { implement: "succeeded", review: "succeeded", merge: "succeeded" } });
  const outcome = await verify(made, { runtime: fakeRuntime((step) => (step.name === "test" ? 1 : 0)) });
  assert.equal(outcome.status, "failed");
  const digest = digestOf(outcome);
  const refused = validateIn(made, digest, expectation(made, made.candidate));
  assert.ok("refusals" in refused);
  assert.match(refused.refusals.join("\n"), /outcome is failed/);
});

await test("checks come from the base: a candidate rewriting its check to a no-op still runs the base command and is flagged", async (t) => {
  const made = fixture(t, { files: { "package.json": packageWithTest("exit 0"), "feature.txt": "broken\n" } });
  const runtime = fakeRuntime((step) => (step.command === BASE_TEST ? 1 : 0));
  const outcome = await verify(made, { runtime });
  assert.deepEqual(runtime.calls[0]?.steps.map((step) => step.command), [INSTALL_COMMAND, BASE_TEST]);
  assert.equal(outcome.status, "failed");
  const receipt = readReceipt(made.store, digestOf(outcome));
  assert.ok("receipt" in receipt);
  assert.deepEqual(receipt.receipt.checkMachinery.changed, ["package.json"]);
  assert.equal(receipt.receipt.checkMachinery.humanReviewRequired, true);
});

await test("a passing candidate that changes check machinery validates only with that machinery named for human review", async (t) => {
  const made = fixture(t, { files: { "feature.txt": "ok\n", "scripts/helper.ts": "export {};\n", "eslint.config.ts": "export default [];\n" } });
  const reviewer = fakeReviewer();
  const digest = digestOf(await verify(made, { reviewer }));
  assert.deepEqual(reviewer.inputs[0]?.checkMachinery, ["eslint.config.ts", "scripts/helper.ts"]);
  const valid = validateIn(made, digest, expectation(made, made.candidate));
  assert.ok("receipt" in valid);
  assert.deepEqual(valid.humanReview, ["eslint.config.ts", "scripts/helper.ts"]);
});

await test("check machinery covers manifests, scripts, configs, hooks, CI, evals, the sandbox and Git attributes", () => {
  const top = ["README.md", "wiki", "docs", "feature.txt", "package.json", "scripts"];
  const changed = ["package.json", "package-lock.json", ".npmrc", ".nvmrc", "tsconfig.json", "eslint.config.ts", "scripts/a/b.ts", "evals/x.py",
    "config/governance-alignment.json", ".sandcastle/Dockerfile", ".githooks/pre-push", ".github/workflows/check.yml", "wiki/.gitattributes",
    ".claude/skills/import-baseline.json", "README.md", "wiki/Home.md", "feature.txt", "docs/scripts/note.md"];
  assert.deepEqual(machineryPaths(changed, top), changed.slice(0, 14));
});

await test("inputs that can shadow a check's own modules are flagged: new top-level paths, Python files and import hooks", () => {
  const top = ["README.md", "wiki", "docs", "scripts"];
  const shadowing = ["unittest/__init__.py", "unittest/__main__.py", "sitecustomize.py", "docs/usercustomize.py", "pyproject.toml", "setup.cfg",
    "docs/conftest.py", "docs/tool.py", "loader.mjs", "tool.ini", ".gitignore", "wiki/.gitignore", "newdir/notes.txt", "docs/x.pth", "node_modules/eslint/index.js"];
  assert.deepEqual(machineryPaths(shadowing, top), shadowing);
  assert.deepEqual(machineryPaths(["docs/guide.md", "wiki/Home.md", "README.md"], top), []);
});

await test("a candidate shipping a unittest package that would shadow the base eval is flagged for human review", async (t) => {
  const made = fixture(t, { files: { "feature.txt": "ok\n", "unittest/__init__.py": "", "unittest/__main__.py": "import sys\nsys.exit(0)\n" } });
  const reviewer = fakeReviewer();
  const digest = digestOf(await verify(made, { reviewer }));
  const valid = validateIn(made, digest, expectation(made, made.candidate));
  assert.ok("receipt" in valid);
  assert.deepEqual(valid.humanReview, ["unittest/__init__.py", "unittest/__main__.py"]);
});

await test("a reviewer's fail verdict fails the candidate and its receipt refuses", async (t) => {
  const made = fixture(t);
  const outcome = await verify(made, { reviewer: fakeReviewer(FAIL) });
  assert.equal(outcome.status, "failed");
  const refused = validateIn(made, digestOf(outcome), expectation(made, made.candidate));
  assert.ok("refusals" in refused);
});

await test("a malformed reviewer response is refused without a receipt", async (t) => {
  for (const response of ["not json", JSON.stringify({ verdict: "maybe", findings: [] }), JSON.stringify({ verdict: "pass" }), JSON.stringify({ verdict: "pass", findings: [1] }),
    JSON.stringify({ verdict: "pass", findings: [], trusted: true }), JSON.stringify({ verdict: "pass", findings: ["x".repeat(64 * 1024)] })]) {
    const made = fixture(t);
    const outcome = await verify(made, { reviewer: fakeReviewer(response) });
    assert.equal(outcome.status, "refused", response);
    assert.match(outcome.status === "refused" ? outcome.refusals.join("\n") : "", /review/);
    assert.deepEqual(receipts(made), [], response);
  }
});

await test("no reviewer is a blocked result, never a pass, and issues no receipt", async (t) => {
  const made = fixture(t);
  const runtime = fakeRuntime();
  const outcome = await verify(made, { runtime, reviewer: noReviewer });
  assert.equal(outcome.status, "blocked");
  assert.match(outcome.status === "blocked" ? outcome.reasons.join("\n") : "", /no reviewer/);
  assert.equal(runtime.calls.length, 0);
  assert.deepEqual(receipts(made), []);
});

await test("an absent container runtime is a blocked result and issues no receipt", async (t) => {
  const made = fixture(t);
  const absent: Runtime = { identity: () => null, run: () => assert.fail("an absent runtime ran") };
  const outcome = await verify(made, { runtime: absent });
  assert.equal(outcome.status, "blocked");
  assert.match(outcome.status === "blocked" ? outcome.reasons.join("\n") : "", /container runtime/);
  assert.deepEqual(receipts(made), []);
});

await test("a runtime refusal (an unsafe container) refuses without a receipt", async (t) => {
  const made = fixture(t);
  const unsafe: Runtime = { identity: () => ({ runtime: "fake", image: "sha256:x" }), run: () => ({ refusals: ["the container has mounts"] }) };
  const outcome = await verify(made, { runtime: unsafe });
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.refusals.join("\n") : "", /mounts/);
  assert.deepEqual(receipts(made), []);
});

await test("a candidate quarantine refuses is not verified", async (t) => {
  const made = fixture(t);
  writeFileSync(join(made.artifacts, "extra.txt"), "x");
  const runtime = fakeRuntime();
  const outcome = await verify(made, { runtime });
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.refusals.join("\n") : "", /unexpected entry/);
  assert.equal(runtime.calls.length, 0);
});

await test("a receipt store inside the trusted source or the artifact directory is refused", async (t) => {
  const made = fixture(t);
  for (const store of [join(made.host.dir, "receipts"), join(made.artifacts)]) {
    const outcome = await verifyCandidate(
      { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store, root: made.root, checks: CHECKS },
      { runtime: fakeRuntime(), reviewer: fakeReviewer() },
    );
    assert.equal(outcome.status, "refused", store);
    assert.match(outcome.status === "refused" ? outcome.refusals.join("\n") : "", /receipt store/);
  }
});

await test("unchanged inputs reuse trusted stored evidence: a new run gets its own receipt without rerunning", async (t) => {
  const made = fixture(t);
  const first = digestOf(await verify(made));
  const runtime = fakeRuntime();
  const reviewer = fakeReviewer();
  const second = await verify(made, { runtime, reviewer }, { run: "run-2" });
  assert.equal(second.status, "passed");
  assert.ok(second.status === "passed" && second.reused);
  assert.equal(runtime.calls.length, 0, "nothing was rerun");
  assert.equal(reviewer.inputs.length, 0, "the reviewer was not asked again");
  const digest = digestOf(second);
  const valid = validateIn(made, digest, expectation(made, made.candidate, "run-2"));
  assert.ok("receipt" in valid, JSON.stringify(valid));
  assert.equal(valid.receipt.reusedFrom, first);
  assert.ok("refusals" in validateIn(made, first, expectation(made, made.candidate, "run-2")), "the first receipt does not cover the new run");
});

await test("an integration producing a new SHA needs new verification", async (t) => {
  const made = fixture(t);
  digestOf(await verify(made));
  const integrated = anotherCandidate(made, { "feature.txt": "ok\n", "merged.txt": "from main\n" });
  t.after(() => rmSync(integrated, { recursive: true, force: true }));
  const runtime = fakeRuntime();
  const outcome = await verify(made, { runtime }, { artifacts: integrated, run: "run-2" });
  assert.equal(outcome.status, "passed");
  assert.ok(outcome.status === "passed" && !outcome.reused);
  assert.equal(runtime.calls.length, 1, "the new SHA was verified again");
});

await test("a changed runner image, reviewer or failed stored evidence is not reused", async (t) => {
  const made = fixture(t);
  await verify(made);
  const otherImage = fakeRuntime(() => 0, "sha256:other-image");
  const image = await verify(made, { runtime: otherImage }, { run: "run-image" });
  assert.ok(image.status === "passed" && !image.reused, "a new image reruns");
  assert.equal(otherImage.calls.length, 1);
  const runtime = fakeRuntime();
  const reviewer = await verify(made, { runtime, reviewer: fakeReviewer(PASS, { name: "fake-reviewer", model: "fake-model", version: "2" }) }, { run: "run-reviewer" });
  assert.ok(reviewer.status === "passed" && !reviewer.reused, "a new reviewer version reruns");
  assert.equal(runtime.calls.length, 1);
  const failing = fixture(t);
  await verify(failing, { runtime: fakeRuntime(() => 1) });
  const again: FakeRuntime = fakeRuntime();
  const retry = await verify(failing, { runtime: again }, { run: "run-2" });
  assert.equal(retry.status, "passed");
  assert.equal(again.calls.length, 1, "a failed receipt is never reused");
});

await test("check definitions are read from the base and refuse missing or delegating scripts", () => {
  const pkg = JSON.stringify({ scripts: { test: "node --test", lint: "npm run other", check: "npm run lint && npm test" } });
  const read = checkDefinitions(pkg, ["test"]);
  assert.ok("definitions" in read);
  assert.deepEqual(read.definitions, [{ name: "test", command: "node --test" }]);
  const refused = checkDefinitions(pkg, ["lint", "missing", "check"]);
  assert.ok("refusals" in refused);
  assert.match(refused.refusals.join("\n"), /lint .*delegates/);
  assert.match(refused.refusals.join("\n"), /missing/);
  assert.match(refused.refusals.join("\n"), /check .*delegates/);
  const sneaky = { a: "node --run lint", b: "bun run lint", c: "\"$npm_execpath\" run lint", d: "n\"p\"m run lint", e: "'npx' eslint", f: "pn\\pm test", g: "corepack yarn" };
  const delegated = checkDefinitions(JSON.stringify({ scripts: sneaky }), Object.keys(sneaky));
  assert.ok("refusals" in delegated);
  assert.equal(delegated.refusals.filter((line) => /delegates/.test(line)).length, Object.keys(sneaky).length, delegated.refusals.join("\n"));
  assert.ok("refusals" in checkDefinitions("not json", ["test"]));
  assert.ok("refusals" in checkDefinitions(JSON.stringify({ scripts: { test: 1 } }), ["test"]));
});

await test("the checks are the leaves of the base's own check:base", async (t) => {
  const pkg = readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf8");
  const names = checkNamesOf(pkg);
  assert.ok("names" in names, JSON.stringify(names));
  assert.deepEqual(names.names, ["lint", "typecheck", "test", "evals:test", "wiki:lint", "skills:lint", "governance:check", "rules:check", "wiki:compliance"]);
  assert.ok("definitions" in checkDefinitions(pkg, names.names));
  for (const chain of ["npm run lint || true", "npm run lint && node x.js", "npm run lint; npm test"]) {
    assert.ok("refusals" in checkNamesOf(JSON.stringify({ scripts: { "check:base": chain } })), chain);
  }
  assert.ok("refusals" in checkNamesOf(JSON.stringify({ scripts: {} })));
  const made = fixture(t);
  const runtime = fakeRuntime();
  const outcome = await verifyCandidate(
    { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store: made.store, root: made.root },
    { runtime, reviewer: fakeReviewer() },
  );
  assert.equal(outcome.status, "passed", JSON.stringify(outcome));
  assert.deepEqual(runtime.calls[0]?.steps.map((step) => step.name), ["install", "test"], "the fixture base's check:base is npm test");
  assert.ok("digest" in trustedChecksDigest(made.host.dir, made.base));
});

await test("every link of a multi-link check:base runs, and a failure in a later link fails the receipt", async (t) => {
  const basePackage = JSON.stringify({ name: "verifier-fixture", version: "0.0.0", private: true, scripts: { a: "node a.mjs", test: BASE_TEST, "check:base": "npm run a && npm test" } });
  const made = fixture(t, { basePackage });
  const runtime = fakeRuntime((step) => (step.name === "test" ? 1 : 0));
  const outcome = await verifyCandidate(
    { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store: made.store, root: made.root },
    { runtime, reviewer: fakeReviewer() },
  );
  assert.deepEqual(runtime.calls[0]?.steps.map((step) => [step.name, step.command]), [["install", INSTALL_COMMAND], ["a", "node a.mjs"], ["test", BASE_TEST]]);
  assert.equal(outcome.status, "failed");
  const receipt = readReceipt(made.store, digestOf(outcome));
  assert.ok("receipt" in receipt);
  assert.deepEqual(receipt.receipt.checks.results.map((step) => [step.name, step.exit]), [["a", 0], ["test", 1]]);
  const consumer = trustedChecksDigest(made.host.dir, made.base);
  assert.ok("digest" in consumer);
  assert.equal(consumer.digest, definitionsDigest([{ name: "a", command: "node a.mjs" }, { name: "test", command: BASE_TEST }]), "the consumer derives both links on its own");
});

await test("a stored receipt differing in repository, task, base, check definitions or runner is not reused", async (t) => {
  const variants: [string, (receipt: Receipt) => Receipt][] = [
    ["repository", (r) => ({ ...r, repository: "Zimfra/other" })],
    ["task", (r) => ({ ...r, task: "issue-43" })],
    ["base", (r) => ({ ...r, base: "e".repeat(40) })],
    ["runner", (r) => ({ ...r, runner: { ...r.runner, sha256: "0".repeat(64) } })],
    ["check definitions", (r) => {
      const results = r.checks.results.map((step) => ({ ...step, command: "node other.mjs" }));
      return { ...r, checks: { ...r.checks, results, definitionsSha256: definitionsDigest(results) } };
    }],
  ];
  for (const [name, change] of variants) {
    const made = fixture(t);
    const first = digestOf(await verify(made));
    const read = readReceipt(made.store, first);
    assert.ok("receipt" in read);
    rmSync(join(made.store, `${first}.json`));
    writeReceipt(made.store, change(read.receipt));
    const runtime = fakeRuntime();
    const again = await verify(made, { runtime }, { run: "run-2" });
    assert.ok(again.status === "passed" && !again.reused, name);
    assert.equal(runtime.calls.length, 1, `${name}: the candidate was verified again`);
  }
});

await test("a reviewer that throws is a tool failure, not a pass", async (t) => {
  const made = fixture(t);
  const broken: FakeReviewer = { ...fakeReviewer(), review: () => Promise.reject(new Error("model unavailable")) };
  await assert.rejects(verify(made, { reviewer: broken }), /model unavailable/);
  assert.deepEqual(receipts(made), []);
});
