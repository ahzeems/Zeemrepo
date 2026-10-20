// Verification receipts (S15, findings A01 and A13). The trusted verifier driver writes one JSON
// receipt per completed verification into a host-only store: a private directory that no container
// mounts and no builder can write. A receipt counts only when it is read from that store under its
// own SHA-256 (the file name) and every bound identity matches what the consumer expects. There is
// no signing key (OWNER DECISION, 2026-10-18, relayed by the coordinator: "Host-only store
// (Recommended)"), so the store's location and permissions are the authority; JSON found anywhere
// else, however plausible, is never read.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isRecord, isStringArray } from "../lib/record.ts";
import type { StepResult } from "./container-runtime.ts";

export const RECEIPT_VERSION = 1;
export const ISSUER = "scripts/sandcastle/verifier-driver.ts";
const RECEIPT_BYTES = 1024 * 1024;
export const REVIEW_RESPONSE_BYTES = 64 * 1024;
const DIGEST = /^[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;

export type ReviewerIdentity = { name: string; model: string; version: string };
export type Review = { verdict: "pass" | "fail"; findings: string[] };
export type Receipt = {
  version: 1; issuer: string; issuedAt: string; run: string; repository: string; task: string; base: string;
  candidate: { ref: string; sha: string }; artifact: { manifestSha256: string; bundleSha256: string };
  runner: { sha256: string; runtime: string; image: string };
  checks: { source: "base"; definitionsSha256: string; install: StepResult; results: StepResult[] };
  checkMachinery: { changed: string[]; humanReviewRequired: boolean };
  review: { reviewer: ReviewerIdentity; inputSha256: string; response: string; verdict: "pass" | "fail"; findings: string[] };
  outcome: "passed" | "failed"; reusedFrom: string | null;
};
/** What the consumer independently knows about the candidate it is about to act on. */
export type Expectation = { repository: string; task: string; run: string; base: string; candidate: string; checksSha256: string };
type Refusals = { refusals: string[] };

export const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");

/** The digest of an ordered list of check definitions; the receipt and the consumer derive it the same way. */
export const definitionsDigest = (definitions: readonly { name: string; command: string }[]): string =>
  sha256(JSON.stringify(definitions.map(({ name, command }) => ({ name, command }))));

/** A model's review response, read as untrusted text: exactly a verdict and a list of findings. */
export function parseReview(response: string): Review | { refusal: string } {
  if (Buffer.byteLength(response) > REVIEW_RESPONSE_BYTES) return { refusal: `the review response is over ${String(REVIEW_RESPONSE_BYTES)} bytes` };
  let value: unknown;
  try {
    value = JSON.parse(response);
  } catch {
    return { refusal: "the review response is not JSON" };
  }
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "findings,verdict") return { refusal: "the review response is not exactly {verdict, findings}" };
  if (value.verdict !== "pass" && value.verdict !== "fail") return { refusal: "the review verdict is neither pass nor fail" };
  if (!isStringArray(value.findings)) return { refusal: "the review findings are not a list of strings" };
  return { verdict: value.verdict, findings: value.findings };
}

/** $XDG_STATE_HOME/zeemrepo/verification-receipts, or ~/.local/state/... when that is unset or relative. */
export function defaultStore(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const state = env.XDG_STATE_HOME !== undefined && isAbsolute(env.XDG_STATE_HOME) ? env.XDG_STATE_HOME : join(home, ".local", "state");
  return join(state, "zeemrepo", "verification-receipts");
}

const real = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};
const within = (inner: string, outer: string): boolean => {
  const path = relative(real(outer), real(inner));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

/** Refusals unless `dir` is an absolute, real, private directory of this user, apart from every `forbidden` path. `label` names the store in them. */
export function storeRefusals(dir: string, forbidden: readonly string[], label = "receipt store"): string[] {
  if (!isAbsolute(dir)) return [`the ${label} ${dir} is not an absolute path`];
  let info;
  try {
    info = lstatSync(dir);
  } catch {
    info = null;
  }
  if (info === null || !info.isDirectory()) return [`the ${label} ${dir} is not a directory`];
  const refusals: string[] = [];
  if (info.uid !== process.getuid?.()) refusals.push(`the ${label} ${dir} is not owned by this user`);
  if ((info.mode & 0o077) !== 0) refusals.push(`the ${label} ${dir} is not private (mode ${(info.mode & 0o777).toString(8)})`);
  return [...refusals, ...placementRefusals(dir, forbidden, label)];
}

function placementRefusals(dir: string, forbidden: readonly string[], label: string): string[] {
  return forbidden.filter((path) => within(dir, path) || within(path, dir))
    .map((path) => `the ${label} ${dir} is inside, or contains, ${path}, which a builder or container can reach`);
}

/** Creates the store privately when it is missing, then checks it. */
export function prepareStore(dir: string, forbidden: readonly string[], label = "receipt store"): string[] {
  if (!isAbsolute(dir)) return storeRefusals(dir, forbidden, label);
  const placed = placementRefusals(dir, forbidden, label);
  if (placed.length > 0) return placed;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return storeRefusals(dir, forbidden, label);
}

/** Writes the receipt under the SHA-256 of its bytes and returns that digest; an identical receipt is already there. */
export function writeReceipt(dir: string, receipt: Receipt): string {
  const bytes = `${JSON.stringify(receipt)}\n`;
  const digest = sha256(bytes);
  try {
    writeFileSync(join(dir, `${digest}.json`), bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (!(isRecord(error) && error.code === "EEXIST")) throw error;
  }
  return digest;
}

/** The bytes of a regular file this user owns and no one else can write, up to `limit`; otherwise why not. */
export function readPrivate(path: string, limit: number): Buffer | string {
  let fd: number;
  try {
    if (!lstatSync(path).isFile()) return "is not a regular file";
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    return isRecord(error) && error.code === "ENOENT" ? "does not exist" : "is not a regular file";
  }
  try {
    const info = fstatSync(fd);
    if (!info.isFile()) return "is not a regular file";
    if (info.uid !== process.getuid?.() || (info.mode & 0o022) !== 0) return "is writable by another user";
    if (info.size > limit) return `is over ${String(limit)} bytes`;
    const bytes = Buffer.alloc(info.size);
    let read = 0;
    for (let got = -1; read < info.size && got !== 0; read += got) got = readSync(fd, bytes, read, info.size - read, read);
    return bytes.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/** The receipt stored under `digest`, refused unless its bytes hash to it and it is well formed. */
export function readReceipt(dir: string, digest: string): { receipt: Receipt } | Refusals {
  if (!DIGEST.test(digest)) return { refusals: [`${digest} is not a receipt digest`] };
  const store = storeRefusals(dir, []);
  if (store.length > 0) return { refusals: store };
  const bytes = readPrivate(join(dir, `${digest}.json`), RECEIPT_BYTES);
  if (typeof bytes === "string") return { refusals: [bytes === "does not exist" ? `there is no receipt ${digest} in the store` : `the receipt ${digest} ${bytes}`] };
  if (sha256(bytes) !== digest) return { refusals: [`the receipt's content does not match its digest ${digest}; it was changed after issue`] };
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { refusals: [`the receipt ${digest} is not JSON`] };
  }
  // The driver writes JSON.stringify output; anything else, such as a repeated key whose last
  // value JSON.parse would keep, was not written by the driver.
  if (`${JSON.stringify(value)}\n` !== bytes.toString("utf8")) return { refusals: [`the receipt ${digest} is not in the driver's canonical form (a repeated key or changed formatting)`] };
  const parsed = receiptFrom(value);
  return "refusals" in parsed ? parsed : { receipt: parsed.receipt };
}

const text = (value: unknown): value is string => typeof value === "string";
const keysAre = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).sort().join(",") === [...keys].sort().join(",");

function stepFrom(value: unknown): StepResult | null {
  if (!isRecord(value) || !keysAre(value, ["name", "command", "exit", "outputSha256", "outputBytes"])) return null;
  const { name, command, exit, outputSha256, outputBytes } = value;
  if (!text(name) || !text(command) || !(exit === null || Number.isInteger(exit)) || !text(outputSha256) || !DIGEST.test(outputSha256) || !Number.isSafeInteger(outputBytes)) return null;
  return { name, command, exit: exit === null ? null : Number(exit), outputSha256, outputBytes: Number(outputBytes) };
}

function shapeRefusals(value: Record<string, unknown>): string[] {
  const keys = ["version", "issuer", "issuedAt", "run", "repository", "task", "base", "candidate", "artifact", "runner", "checks", "checkMachinery", "review", "outcome", "reusedFrom"];
  const refusals = [
    ...Object.keys(value).filter((key) => !keys.includes(key)).map((key) => `unknown key ${key} in the receipt`),
    ...keys.filter((key) => !(key in value)).map((key) => `the receipt has no ${key}`),
  ];
  if (value.version !== RECEIPT_VERSION) refusals.push(`the receipt is version ${JSON.stringify(value.version) ?? "undefined"}, not ${String(RECEIPT_VERSION)}`);
  if (value.issuer !== ISSUER) refusals.push(`the receipt names issuer ${JSON.stringify(value.issuer) ?? "undefined"}, not ${ISSUER}`);
  for (const key of ["issuedAt", "run", "repository", "task"]) if (!text(value[key])) refusals.push(`${key} in the receipt is not a string`);
  if (!(text(value.base) && SHA.test(value.base))) refusals.push("base in the receipt is not a full SHA-1");
  if (!(value.reusedFrom === null || (text(value.reusedFrom) && DIGEST.test(value.reusedFrom)))) refusals.push("reusedFrom in the receipt is not a receipt digest");
  if (value.outcome !== "passed" && value.outcome !== "failed") refusals.push("the receipt outcome is neither passed nor failed");
  return refusals;
}

function partsRefusals(value: Record<string, unknown>): string[] {
  const { candidate, artifact, runner, checks, checkMachinery, review } = value;
  const refusals: string[] = [];
  if (!(isRecord(candidate) && keysAre(candidate, ["ref", "sha"]) && text(candidate.ref) && text(candidate.sha) && SHA.test(candidate.sha))) refusals.push("the receipt's candidate is malformed");
  if (!(isRecord(artifact) && keysAre(artifact, ["manifestSha256", "bundleSha256"]) && [artifact.manifestSha256, artifact.bundleSha256].every((d) => text(d) && DIGEST.test(d)))) refusals.push("the receipt's artifact is malformed");
  if (!(isRecord(runner) && keysAre(runner, ["sha256", "runtime", "image"]) && text(runner.sha256) && DIGEST.test(runner.sha256) && text(runner.runtime) && text(runner.image))) refusals.push("the receipt's runner is malformed");
  if (!(isRecord(checks) && keysAre(checks, ["source", "definitionsSha256", "install", "results"]) && checks.source === "base" && text(checks.definitionsSha256)
    && stepFrom(checks.install) !== null && Array.isArray(checks.results) && checks.results.every((step) => stepFrom(step) !== null))) refusals.push("the receipt's checks are malformed");
  if (!(isRecord(checkMachinery) && keysAre(checkMachinery, ["changed", "humanReviewRequired"]) && isStringArray(checkMachinery.changed) && typeof checkMachinery.humanReviewRequired === "boolean")) {
    refusals.push("the receipt's checkMachinery is malformed");
  }
  if (!(isRecord(review) && keysAre(review, ["reviewer", "inputSha256", "response", "verdict", "findings"]) && isRecord(review.reviewer) && keysAre(review.reviewer, ["name", "model", "version"])
    && [review.reviewer.name, review.reviewer.model, review.reviewer.version, review.inputSha256, review.response].every(text) && isStringArray(review.findings))) refusals.push("the receipt has no well-formed review");
  return refusals;
}

function receiptFrom(value: unknown): { receipt: Receipt } | Refusals {
  if (!isRecord(value)) return { refusals: ["the receipt is not a JSON object"] };
  const refusals = [...shapeRefusals(value), ...partsRefusals(value)];
  if (refusals.length > 0) return { refusals };
  // Every field was checked above; the guard only gives the checked value its static type.
  const receipt: unknown = value;
  return isReceipt(receipt) ? { receipt } : { refusals: ["the receipt is malformed"] };
}

const isReceipt = (value: unknown): value is Receipt => isRecord(value) && value.version === RECEIPT_VERSION;

/** What the receipt claims must follow from its own evidence: the outcome, the review and the machinery flag. */
function consistencyRefusals(receipt: Receipt): string[] {
  const refusals: string[] = [];
  const { checks, review, checkMachinery } = receipt;
  if (definitionsDigest(checks.results) !== checks.definitionsSha256) refusals.push("the receipt's check commands do not match its check definitions digest");
  const parsed = parseReview(review.response);
  if ("refusal" in parsed) refusals.push(`the receipt's review response is invalid: ${parsed.refusal}`);
  else if (parsed.verdict !== review.verdict || JSON.stringify(parsed.findings) !== JSON.stringify(review.findings)) refusals.push("the receipt's review verdict or findings differ from the reviewer's response");
  const passed = checks.install.exit === 0 && checks.results.every((step) => step.exit === 0) && review.verdict === "pass";
  if ((receipt.outcome === "passed") !== passed) refusals.push(`the receipt's outcome ${receipt.outcome} does not follow from its checks and review`);
  if (checkMachinery.humanReviewRequired !== checkMachinery.changed.length > 0) refusals.push("the receipt's human review flag does not follow from the changed check machinery");
  return refusals;
}

function bindingRefusals(receipt: Receipt, expected: Expectation): string[] {
  const pairs: [string, string, string][] = [
    ["repository", receipt.repository, expected.repository], ["task", receipt.task, expected.task], ["run", receipt.run, expected.run],
    ["base", receipt.base, expected.base], ["candidate", receipt.candidate.sha, expected.candidate],
    ["check definitions", receipt.checks.definitionsSha256, expected.checksSha256],
  ];
  return pairs.filter(([, actual, wanted]) => actual !== wanted).map(([name, actual, wanted]) => `the receipt binds ${name} ${actual}, not ${wanted}`);
}

/**
 * The receipt under `digest`, if it authorizes the expected candidate. `dir` must be the host's
 * configured store (defaultStore()), never a path taken from an artifact or a guest; it is refused
 * when it lies inside, or contains, the consumer's trusted source or artifact directory. Then: read from the store, its own
 * digest, well formed, consistent, bound to every expected identity and passed. `humanReview` lists
 * changed check machinery; while it is not empty the receipt alone does not authorize publication.
 */
export function validateReceipt(dir: string, digest: string, expected: Expectation, trusted: { source: string; artifacts: string }): { receipt: Receipt; humanReview: string[] } | Refusals {
  const placed = storeRefusals(dir, [trusted.source, trusted.artifacts]);
  if (placed.length > 0) return { refusals: placed };
  const read = readReceipt(dir, digest);
  if ("refusals" in read) return read;
  const { receipt } = read;
  const refusals = [...consistencyRefusals(receipt), ...bindingRefusals(receipt, expected)];
  if (receipt.outcome !== "passed") refusals.push(`the receipt's outcome is ${receipt.outcome}`);
  return refusals.length > 0 ? { refusals } : { receipt, humanReview: [...receipt.checkMachinery.changed] };
}

/** Every receipt in the store that reads back under its own digest and is self-consistent. */
export function storedReceipts(dir: string): { digest: string; receipt: Receipt }[] {
  if (storeRefusals(dir, []).length > 0) return [];
  return readdirSync(dir).filter((name) => /^[0-9a-f]{64}\.json$/.test(name)).sort().flatMap((name) => {
    const digest = name.slice(0, -".json".length);
    const read = readReceipt(dir, digest);
    return "receipt" in read && consistencyRefusals(read.receipt).length === 0 ? [{ digest, receipt: read.receipt }] : [];
  });
}
