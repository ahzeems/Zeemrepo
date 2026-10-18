import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { CHECKS, createVerifierCandidate, fakeReviewer, fakeRuntime, type VerifierFixture } from "../test-support/verifier-fixture.ts";
import {
  defaultStore, prepareStore, readReceipt, storedReceipts, storeRefusals, validateReceipt, writeReceipt, type Expectation, type Receipt,
} from "./verification-receipt.ts";
import { trustedChecksDigest, verifyCandidate } from "./verifier-driver.ts";

type Issued = VerifierFixture & { digest: string; expect: Expectation };

async function issued(t: TestContext): Promise<Issued> {
  const made = createVerifierCandidate();
  t.after(() => made.cleanup());
  const outcome = await verifyCandidate(
    { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store: made.store, root: made.root, checks: CHECKS },
    { runtime: fakeRuntime(), reviewer: fakeReviewer() },
  );
  assert.equal(outcome.status, "passed", JSON.stringify(outcome));
  const checks = trustedChecksDigest(made.host.dir, made.base, CHECKS);
  assert.ok("digest" in checks);
  const expect: Expectation = { repository: made.expected.repository, task: made.expected.task, run: made.run, base: made.base, candidate: made.candidate, checksSha256: checks.digest };
  return { ...made, digest: outcome.status === "passed" ? outcome.digest : "", expect };
}

const sha256 = (text: string | Buffer): string => createHash("sha256").update(text).digest("hex");
/** Validation as a consumer runs it: the store from host configuration, refused under the trusted source or artifacts. */
const validateIn = (made: VerifierFixture, digest: string, expect: Expectation): ReturnType<typeof validateReceipt> =>
  validateReceipt(made.store, digest, expect, { source: made.host.dir, artifacts: made.artifacts });
const refusalsOf = (result: ReturnType<typeof validateReceipt>): string => ("refusals" in result ? result.refusals.join("\n") : "");

function stored(made: Issued): Receipt {
  const read = readReceipt(made.store, made.digest);
  assert.ok("receipt" in read);
  return read.receipt;
}

/** Writes `bytes` into the store under their own digest, as a host-level forger who recomputes the name would. */
function plant(made: Issued, bytes: string): string {
  const digest = sha256(bytes);
  writeFileSync(join(made.store, `${digest}.json`), bytes, { mode: 0o600 });
  return digest;
}

await test("every bound identity must match: wrong repository, task, run, base, candidate or check state refuses", async (t) => {
  const made = await issued(t);
  assert.ok("receipt" in validateIn(made, made.digest, made.expect));
  const other = "f".repeat(40);
  const wrong: [string, Partial<Expectation>, RegExp][] = [
    ["repository", { repository: "Zimfra/other" }, /repository/],
    ["task", { task: "issue-43" }, /task/],
    ["run", { run: "run-9" }, /run/],
    ["base", { base: other }, /base/],
    ["candidate", { candidate: other }, /candidate/],
    ["check state", { checksSha256: "0".repeat(64) }, /check definitions/],
  ];
  for (const [name, change, named] of wrong) assert.match(refusalsOf(validateIn(made, made.digest, { ...made.expect, ...change })), named, name);
});

await test("a tampered receipt in the store no longer matches its digest and refuses", async (t) => {
  const made = await issued(t);
  const path = join(made.store, `${made.digest}.json`);
  writeFileSync(path, readFileSync(path, "utf8").replace('"outcome":"passed"', '"outcome":"passed" '));
  assert.match(refusalsOf(validateIn(made, made.digest, made.expect)), /digest/);
});

await test("a store copied under the trusted source, or planted in the artifact directory, does not count", async (t) => {
  const made = await issued(t);
  const copied = join(made.host.dir, "receipts");
  cpSync(made.store, copied, { recursive: true });
  chmodSync(copied, 0o700);
  const trusted = { source: made.host.dir, artifacts: made.artifacts };
  assert.match(refusalsOf(validateReceipt(copied, made.digest, made.expect, trusted)), /inside/);
  const forged = { ...stored(made), run: "run-forged" };
  const bytes = `${JSON.stringify(forged)}\n`;
  writeFileSync(join(made.artifacts, `${sha256(bytes)}.json`), bytes, { mode: 0o600 });
  chmodSync(made.artifacts, 0o700);
  assert.match(refusalsOf(validateReceipt(made.artifacts, sha256(bytes), { ...made.expect, run: "run-forged" }, trusted)), /inside/);
  assert.match(refusalsOf(validateIn(made, sha256(bytes), { ...made.expect, run: "run-forged" })), /no receipt/);
  assert.ok("refusals" in validateIn(made, "not-a-digest", made.expect));
});

await test("a receipt with a repeated key is refused, even when the last value would pass", async (t) => {
  const made = await issued(t);
  const text = JSON.stringify(stored(made));
  const repeated = plant(made, `{"outcome":"failed",${text.slice(1)}\n`);
  assert.match(refusalsOf(validateIn(made, repeated, made.expect)), /canonical/);
});

await test("reviewer mutation invalidates the verdict even when the file is re-hashed", async (t) => {
  const made = await issued(t);
  const receipt = stored(made);
  const verdictOnly = plant(made, `${JSON.stringify({ ...receipt, review: { ...receipt.review, verdict: "fail" } })}\n`);
  assert.match(refusalsOf(validateIn(made, verdictOnly, made.expect)), /review/);
  const response = JSON.stringify({ verdict: "pass", findings: ["edited"] });
  const responseOnly = plant(made, `${JSON.stringify({ ...receipt, review: { ...receipt.review, response } })}\n`);
  assert.match(refusalsOf(validateIn(made, responseOnly, made.expect)), /review/);
});

await test("missing review, a changed check, a failing step or a builder-chosen outcome refuses", async (t) => {
  const made = await issued(t);
  const receipt = stored(made);
  const withoutReview = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "review"));
  const cases: [string, unknown, RegExp][] = [
    ["missing review", withoutReview, /review/],
    ["changed check command", { ...receipt, checks: { ...receipt.checks, results: receipt.checks.results.map((step) => ({ ...step, command: "exit 0" })) } }, /check definitions/],
    ["failing step claimed passed", { ...receipt, checks: { ...receipt.checks, results: receipt.checks.results.map((step) => ({ ...step, exit: 1 })) } }, /outcome/],
    ["failed install claimed passed", { ...receipt, checks: { ...receipt.checks, install: { ...receipt.checks.install, exit: 1 } } }, /outcome/],
    ["unknown key", { ...receipt, trusted: true }, /unknown key/],
    ["wrong issuer", { ...receipt, issuer: "candidate" }, /issuer/],
    ["wrong version", { ...receipt, version: 2 }, /version/],
    ["not an object", [receipt], /object/],
    ["human review hidden", { ...receipt, checkMachinery: { changed: ["package.json"], humanReviewRequired: false } }, /human review/],
  ];
  for (const [name, value, named] of cases) assert.match(refusalsOf(validateIn(made, plant(made, `${JSON.stringify(value)}\n`), made.expect)), named, name);
  assert.match(refusalsOf(validateIn(made, plant(made, "not json"), made.expect)), /JSON/);
});

await test("a receipt file that is a link, writable by others or oversized is refused", async (t) => {
  const made = await issued(t);
  const path = join(made.store, `${made.digest}.json`);
  chmodSync(path, 0o666);
  assert.match(refusalsOf(validateIn(made, made.digest, made.expect)), /writable/);
  chmodSync(path, 0o600);
  const target = join(made.root, "target.json");
  renameSync(path, target);
  symlinkSync(target, path);
  assert.match(refusalsOf(validateIn(made, made.digest, made.expect)), /regular file/);
  const big = plant(made, `${" ".repeat(2 * 1024 * 1024)}{}`);
  assert.match(refusalsOf(validateIn(made, big, made.expect)), /over/);
});

await test("the store must be a private directory of this user outside the trusted source and artifacts", (t) => {
  const root = mkdtempSync(join(tmpdir(), "receipt-store-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = join(root, "nested", "receipts");
  assert.deepEqual(prepareStore(store, []), []);
  chmodSync(store, 0o755);
  assert.match(storeRefusals(store, []).join("\n"), /private/);
  chmodSync(store, 0o700);
  assert.match(storeRefusals("relative/store", []).join("\n"), /absolute/);
  assert.match(storeRefusals(join(root, "absent"), []).join("\n"), /not a directory/);
  const link = join(root, "link");
  symlinkSync(store, link);
  assert.match(storeRefusals(link, []).join("\n"), /not a directory/);
  assert.match(storeRefusals(store, [root]).join("\n"), /inside/);
  assert.match(storeRefusals(store, [join(store, "x")]).join("\n"), /inside/);
  const sibling = join(root, "nested", "receipts-other");
  mkdirSync(sibling, { mode: 0o700 });
  assert.deepEqual(storeRefusals(sibling, [store]), []);
});

await test("the default store is host state outside any checkout", () => {
  assert.equal(defaultStore({ XDG_STATE_HOME: "/state" }, "/home/agent"), "/state/zeemrepo/verification-receipts");
  assert.equal(defaultStore({}, "/home/agent"), "/home/agent/.local/state/zeemrepo/verification-receipts");
  assert.equal(defaultStore({ XDG_STATE_HOME: "relative" }, "/home/agent"), "/home/agent/.local/state/zeemrepo/verification-receipts");
});

await test("writing is content-addressed and idempotent; listing returns only valid receipts", async (t) => {
  const made = await issued(t);
  const receipt = stored(made);
  assert.equal(writeReceipt(made.store, receipt), made.digest);
  plant(made, "not json");
  writeFileSync(join(made.store, "notes.txt"), "x");
  assert.deepEqual(storedReceipts(made.store).map((entry) => entry.digest), [made.digest]);
});
