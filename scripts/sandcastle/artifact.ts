// The candidate artifact a disposable Sandcastle run hands back (S13, finding A01): a directory
// holding a versioned manifest, one Git bundle that carries exactly the candidate ref, and
// optional opaque recovery data. Everything in it is untrusted data. This module reads it with
// size limits and checks it against identities the trusted caller supplies; quarantine.ts then
// imports the bundle into a fresh repository. Nothing here runs a command or touches Git.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../lib/record.ts";

export const MANIFEST_FILE = "candidate.json";
export const BUNDLE_FILE = "candidate.bundle";
export const RECOVERY_FILE = "recovery.data";
const ENTRIES: readonly string[] = [MANIFEST_FILE, BUNDLE_FILE, RECOVERY_FILE];
export const MANIFEST_VERSION = 1;

// gitOutputBytes bounds what one quarantine Git command may print (quarantine.ts).
export type Limits = { manifestBytes: number; bundleBytes: number; recoveryBytes: number; prerequisites: number; gitOutputBytes: number };
export const LIMITS: Limits = { manifestBytes: 64 * 1024, bundleBytes: 64 * 1024 * 1024, recoveryBytes: 1024 * 1024, prerequisites: 16, gitOutputBytes: 16 * 1024 * 1024 };
// A header holds a signature, a few capability and prerequisite lines and one ref line.
const HEADER_LIMIT = 64 * 1024;

/** What the trusted caller expects; the manifest must repeat it exactly. */
export type Expected = { repository: string; task: string; base: string; ref: string };

// Builder phases only. Verification and publication are never the builder's to claim.
const PHASES = ["plan", "implement", "review", "merge"] as const;
const CLAIMS = ["succeeded", "failed", "interrupted", "skipped"] as const;
export type Phase = (typeof PHASES)[number];
export type Claim = (typeof CLAIMS)[number];

export type Manifest = {
  version: 1; repository: string; task: string; base: string;
  candidate: { ref: string; sha: string };
  bundle: { sha256: string; bytes: number; prerequisites: string[] };
  recovery: { sha256: string; bytes: number } | null;
  claims: Partial<Record<Phase, Claim>>;
};
export type BundleHeader = { prerequisites: string[]; refs: { sha: string; ref: string }[] };
export type Files = { manifest: Buffer; bundle: Buffer; recovery: Buffer | null };
export type Checked = { manifest: Manifest; header: BundleHeader; recovery: Buffer | null };
export type Refusals = { refusals: string[] };

export const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const isPhase = (key: string): key is Phase => PHASES.some((phase) => phase === key);
const isClaim = (value: unknown): value is Claim => CLAIMS.some((claim) => claim === value);
// Artifact text reaches an operator's terminal, so controls (escape sequences that retitle a
// window or erase lines), format characters (bidi overrides and isolates, zero-width marks) and
// the line and paragraph separators are printed as \uXXXX.
const UNPRINTABLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const escaped = (code: number): string => (code > 0xffff ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, "0")}`);
export const printable = (text: string): string => text.replace(UNPRINTABLE, (c) => escaped(c.codePointAt(0) ?? 0));
const shown = (name: string): string => (/^[\x21-\x7e]+$/.test(name) ? name : printable(JSON.stringify(name)));
export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

type Entry = { bytes: Buffer | null; refusals: string[] };

const errorCode = (error: unknown): unknown => (typeof error === "object" && error !== null && "code" in error ? error.code : undefined);

const notRegular = (name: string): Entry => ({ bytes: null, refusals: [`${name} is not a regular file`] });

// lstat refuses a link, FIFO or device before anything opens it, since opening some devices has
// side effects. An entry swapped in after that is still caught: O_NOFOLLOW refuses a link (ELOOP),
// O_NONBLOCK keeps a FIFO from blocking the open, and readEntry re-checks the open descriptor.
function openEntry(path: string, name: string, required: boolean): number | Entry {
  try {
    if (!lstatSync(path).isFile()) return notRegular(name);
    return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { bytes: null, refusals: required ? [`${name} is missing`] : [] };
    if (code === "ELOOP") return notRegular(name);
    if (code === "EACCES" || code === "EPERM") return { bytes: null, refusals: [`${name} cannot be read`] };
    throw error;
  }
}

function readEntry(dir: string, name: string, limit: number, required: boolean): Entry {
  const fd = openEntry(join(dir, name), name, required);
  if (typeof fd !== "number") return fd;
  try {
    const info = fstatSync(fd);
    if (!info.isFile()) return notRegular(name);
    if ((info.mode & 0o111) !== 0) return { bytes: null, refusals: [`${name} is executable`] };
    const size = info.size;
    if (size > limit) return { bytes: null, refusals: [`${name} is over ${String(limit)} bytes`] };
    const bytes = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const got = readSync(fd, bytes, read, size - read, read);
      if (got === 0) break;
      read += got;
    }
    return { bytes: bytes.subarray(0, read), refusals: [] };
  } finally {
    closeSync(fd);
  }
}

/** The artifact directory's three files, bounded; any other entry, link or executable refuses. */
export function readArtifacts(dir: string, limits: Limits = LIMITS): { files: Files } | Refusals {
  let info;
  try {
    info = lstatSync(dir);
  } catch {
    info = null;
  }
  if (info === null || !info.isDirectory()) return { refusals: [`the artifact path ${dir} is not a directory`] };
  const unexpected = readdirSync(dir).filter((name) => !ENTRIES.includes(name)).sort().map((name) => `unexpected entry ${shown(name)} in the artifact directory`);
  const manifest = readEntry(dir, MANIFEST_FILE, limits.manifestBytes, true);
  const bundle = readEntry(dir, BUNDLE_FILE, limits.bundleBytes, true);
  const recovery = readEntry(dir, RECOVERY_FILE, limits.recoveryBytes, false);
  const refusals = [...unexpected, ...manifest.refusals, ...bundle.refusals, ...recovery.refusals];
  if (refusals.length > 0 || manifest.bytes === null || bundle.bytes === null) return { refusals };
  return { files: { manifest: manifest.bytes, bundle: bundle.bytes, recovery: recovery.bytes } };
}

function keyRefusals(value: Record<string, unknown>, path: string, required: readonly string[], optional: readonly string[] = []): string[] {
  const prefix = path === "" ? "" : `${path}.`;
  const unknown = Object.keys(value).filter((key) => !required.includes(key) && !optional.includes(key)).map((key) => `unknown key ${prefix}${printable(key)} in the manifest`);
  const missing = required.filter((key) => !(key in value)).map((key) => `the manifest has no ${prefix}${key}`);
  return [...unknown, ...missing];
}

function objectAt(value: Record<string, unknown>, key: string): Record<string, unknown> | string {
  const child = value[key];
  return isRecord(child) ? child : `${key} in the manifest is not a JSON object`;
}

const quoted = (value: unknown): string => printable(typeof value === "string" ? value : JSON.stringify(value) ?? "undefined");

function identityRefusals(value: Record<string, unknown>, candidate: Record<string, unknown>, expected: Expected): string[] {
  const refusals: string[] = [];
  if (value.version !== MANIFEST_VERSION) refusals.push(`${MANIFEST_FILE} is version ${quoted(value.version)}, not ${String(MANIFEST_VERSION)}`);
  const pairs: [string, unknown, string][] = [
    ["repository", value.repository, expected.repository], ["task", value.task, expected.task],
    ["base", value.base, expected.base], ["ref", candidate.ref, expected.ref],
  ];
  for (const [name, actual, wanted] of pairs) if (actual !== wanted) refusals.push(`the manifest names ${name} ${quoted(actual)}, not ${wanted}`);
  if (typeof candidate.sha !== "string" || !SHA.test(candidate.sha)) refusals.push("candidate.sha in the manifest is not a full lowercase SHA-1");
  return refusals;
}

function digestRefusals(value: Record<string, unknown>, path: string): string[] {
  const refusals: string[] = [];
  if (typeof value.sha256 !== "string" || !DIGEST.test(value.sha256)) refusals.push(`${path}.sha256 in the manifest is not a lowercase SHA-256`);
  if (typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 0) refusals.push(`${path}.bytes in the manifest is not a byte count`);
  return refusals;
}

function bundleRefusals(bundle: Record<string, unknown>, limits: Limits): string[] {
  const refusals = digestRefusals(bundle, "bundle");
  const prerequisites = bundle.prerequisites;
  if (!Array.isArray(prerequisites) || !prerequisites.every((sha) => typeof sha === "string" && SHA.test(sha))) {
    return [...refusals, "bundle.prerequisites in the manifest is not a list of full SHA-1s"];
  }
  if (prerequisites.length > limits.prerequisites) refusals.push(`the manifest lists more than ${String(limits.prerequisites)} prerequisite(s)`);
  if (new Set(prerequisites).size !== prerequisites.length) refusals.push("bundle.prerequisites in the manifest repeats a commit");
  return refusals;
}

function claimRefusals(claims: Record<string, unknown>): string[] {
  return Object.entries(claims).flatMap(([key, value]) => {
    if (!isPhase(key)) return [`claims.${printable(key)} is not a builder phase; the builder can claim only ${PHASES.join(", ")}`];
    return isClaim(value) ? [] : [`claims.${key} is ${quoted(value)}, not one of ${CLAIMS.join(", ")}`];
  });
}

type Parts = Partial<Record<"candidate" | "bundle" | "claims" | "recovery", Record<string, unknown>>>;

function nested(value: Record<string, unknown>): { parts: Parts; refusals: string[] } {
  const parts: Parts = {};
  const refusals: string[] = [];
  const keys = ["candidate", "bundle", "claims", "recovery"] as const;
  for (const key of keys.filter((name) => name !== "recovery" || name in value)) {
    const child = objectAt(value, key);
    if (typeof child === "string") refusals.push(child);
    else parts[key] = child;
  }
  return { parts, refusals };
}

function manifestFrom(value: Record<string, unknown>, parts: Parts): Manifest {
  const text = (record: Record<string, unknown> | undefined, key: string): string => String(record?.[key]);
  const count = (record: Record<string, unknown> | undefined): number => Number(record?.bytes);
  const prerequisites = parts.bundle?.prerequisites;
  const claims: Partial<Record<Phase, Claim>> = {};
  for (const [key, claim] of Object.entries(parts.claims ?? {})) if (isPhase(key) && isClaim(claim)) claims[key] = claim;
  return {
    version: MANIFEST_VERSION, repository: text(value, "repository"), task: text(value, "task"), base: text(value, "base"),
    candidate: { ref: text(parts.candidate, "ref"), sha: text(parts.candidate, "sha") },
    bundle: { sha256: text(parts.bundle, "sha256"), bytes: count(parts.bundle), prerequisites: Array.isArray(prerequisites) ? prerequisites.map(String) : [] },
    recovery: parts.recovery === undefined ? null : { sha256: text(parts.recovery, "sha256"), bytes: count(parts.recovery) },
    claims,
  };
}

/** The parsed manifest, refused unless every key is known, well-formed and names the expected identities. */
export function readManifest(bytes: Buffer, expected: Expected, limits: Limits = LIMITS): { manifest: Manifest } | Refusals {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { refusals: [`${MANIFEST_FILE} is not valid JSON`] };
  }
  if (!isRecord(value)) return { refusals: [`${MANIFEST_FILE} is not a JSON object`] };
  const { parts, refusals } = nested(value);
  refusals.unshift(...keyRefusals(value, "", ["version", "repository", "task", "base", "candidate", "bundle", "claims"], ["recovery"]));
  const { candidate, bundle, claims, recovery } = parts;
  if (candidate !== undefined) refusals.push(...keyRefusals(candidate, "candidate", ["ref", "sha"]), ...identityRefusals(value, candidate, expected));
  if (bundle !== undefined) refusals.push(...keyRefusals(bundle, "bundle", ["sha256", "bytes", "prerequisites"]), ...bundleRefusals(bundle, limits));
  if (recovery !== undefined) refusals.push(...keyRefusals(recovery, "recovery", ["sha256", "bytes"]), ...digestRefusals(recovery, "recovery"));
  if (claims !== undefined) refusals.push(...claimRefusals(claims));
  return refusals.length > 0 ? { refusals } : { manifest: manifestFrom(value, parts) };
}

function headerLine(line: string, version: string, header: BundleHeader): string | null {
  if (line.startsWith("@")) return version === "3" && line === "@object-format=sha1" ? null : `the bundle declares capability ${printable(line)}, which is not accepted`;
  const prerequisite = /^-([0-9a-f]{40})(?: .*)?$/.exec(line);
  if (prerequisite?.[1] !== undefined) {
    header.prerequisites.push(prerequisite[1]);
    return null;
  }
  const ref = /^([0-9a-f]{40}) (\S+)$/.exec(line);
  if (ref?.[1] === undefined || ref[2] === undefined) return `malformed header line ${printable(JSON.stringify(line))} in the bundle`;
  header.refs.push({ sha: ref[1], ref: ref[2] });
  return null;
}

/** The bundle's header, read without Git: v2 or v3 with SHA-1 objects, prerequisites and refs. */
export function parseBundleHeader(bytes: Buffer): { header: BundleHeader } | Refusals {
  const end = bytes.subarray(0, HEADER_LIMIT).indexOf("\n\n");
  if (end === -1) return { refusals: [`the bundle header does not end within ${String(HEADER_LIMIT)} bytes`] };
  const [signature = "", ...lines] = bytes.subarray(0, end).toString("utf8").split("\n");
  const version = /^# v([23]) git bundle$/.exec(signature)?.[1];
  if (version === undefined) return { refusals: [`the bundle signature ${printable(JSON.stringify(signature))} is not a v2 or v3 git bundle`] };
  const header: BundleHeader = { prerequisites: [], refs: [] };
  const refusals = lines.map((line) => headerLine(line, version, header)).filter((refusal) => refusal !== null);
  return refusals.length > 0 ? { refusals } : { header };
}

function headerRefusals(header: BundleHeader, manifest: Manifest): string[] {
  const { ref, sha } = manifest.candidate;
  const refusals = header.refs.filter((line) => line.ref !== ref).map((line) => `the bundle carries ref ${printable(line.ref)}, which is not the candidate ref ${ref}`);
  const matching = header.refs.filter((line) => line.ref === ref);
  if (matching.length === 0) refusals.push(`the bundle does not carry the candidate ref ${ref}`);
  if (matching.length > 1) refusals.push(`the bundle carries the candidate ref ${ref} more than once`);
  for (const line of matching) if (line.sha !== sha) refusals.push(`the bundle ref ${ref} is ${line.sha}, but the manifest says ${sha}`);
  const listed = [...manifest.bundle.prerequisites].sort().join(", ");
  const carried = [...header.prerequisites].sort().join(", ");
  if (listed !== carried) refusals.push(`the bundle's prerequisites [${carried}] do not match the manifest's [${listed}]`);
  return refusals;
}

function fileRefusals(name: string, bytes: Buffer, described: { sha256: string; bytes: number }): string[] {
  const refusals: string[] = [];
  if (bytes.length !== described.bytes) refusals.push(`${name} is ${String(bytes.length)} bytes, but the manifest says ${String(described.bytes)}`);
  const digest = sha256(bytes);
  if (digest !== described.sha256) refusals.push(`${name} has sha256 ${digest}, but the manifest says ${described.sha256}`);
  return refusals;
}

function recoveryRefusals(recovery: Buffer | null, described: Manifest["recovery"]): string[] {
  if (recovery === null) return described === null ? [] : [`the manifest describes ${RECOVERY_FILE}, but it is missing`];
  if (described === null) return [`${RECOVERY_FILE} is present, but the manifest does not describe it`];
  return fileRefusals(RECOVERY_FILE, recovery, described);
}

/** The files read by readArtifacts, checked against the expectation and each other. */
export function validateArtifacts(files: Files, expected: Expected, limits: Limits = LIMITS): Checked | Refusals {
  const read = readManifest(files.manifest, expected, limits);
  if ("refusals" in read) return read;
  const { manifest } = read;
  const parsed = parseBundleHeader(files.bundle);
  const refusals = [
    ...fileRefusals(BUNDLE_FILE, files.bundle, manifest.bundle),
    ...recoveryRefusals(files.recovery, manifest.recovery),
    ...("refusals" in parsed ? parsed.refusals : headerRefusals(parsed.header, manifest)),
  ];
  if (refusals.length > 0 || "refusals" in parsed) return { refusals };
  return { manifest, header: parsed.header, recovery: files.recovery };
}

export function checkArtifacts(dir: string, expected: Expected, limits: Limits = LIMITS): Checked | Refusals {
  const read = readArtifacts(dir, limits);
  return "refusals" in read ? read : validateArtifacts(read.files, expected, limits);
}
