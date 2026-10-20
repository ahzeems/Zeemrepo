import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createRepo, type RepoFixture } from "./repo-fixture.ts";

// A trusted host repository holding the base, and a guest repository that built a candidate on
// it and exported it as a Sandcastle artifact directory. Everything lives in disposable temp
// directories; the bundle and manifest are generated, never checked in.
export const REPOSITORY = "Zimfra/software_testing";
export const TASK = "issue-42";
export const REF = `refs/heads/sandcastle/${TASK}`;

export type CandidateFixture = {
  host: RepoFixture;
  guest: RepoFixture;
  artifacts: string;
  base: string;
  candidate: string;
  manifest: Record<string, unknown>;
  expected: { repository: string; task: string; base: string; ref: string };
  writeManifest(manifest: unknown): void;
  writeBundle(bytes: Buffer): void;
  bundle(): Buffer;
  cleanup(): void;
};

export type CandidateOptions = {
  incremental?: boolean;
  recovery?: string;
  bundleRefs?: readonly string[];
  /** Extra tracked files in the candidate commit, committed executable. */
  executables?: Readonly<Record<string, string>>;
  plant?: (guest: RepoFixture) => void;
};

export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function guestOn(host: RepoFixture, base: string): RepoFixture {
  const guest = createRepo("artifact-guest-");
  guest.git(["fetch", "--quiet", host.dir, "main"]);
  guest.git(["reset", "--quiet", "--hard", base]);
  return guest;
}

export function createCandidate(options: CandidateOptions = {}): CandidateFixture {
  const host = createRepo("artifact-host-");
  host.write("README.md", "base\n");
  const base = host.commit("base");
  const guest = guestOn(host, base);
  guest.write("feature.txt", "candidate work\n");
  for (const [path, content] of Object.entries(options.executables ?? {})) {
    guest.write(path, content);
    chmodSync(join(guest.dir, path), 0o755);
  }
  const candidate = guest.commit("feat: candidate work");
  guest.git(["update-ref", REF, candidate]);
  options.plant?.(guest);
  const artifacts = mkdtempSync(join(tmpdir(), "artifact-out-"));
  const bundlePath = join(artifacts, "candidate.bundle");
  const refs = options.bundleRefs ?? [REF];
  const spec = options.incremental === true ? [`^${base}`, ...refs] : refs;
  guest.git(["bundle", "create", "--quiet", bundlePath, ...spec]);
  const bytes = readFileSync(bundlePath);
  const manifest: Record<string, unknown> = {
    version: 1, repository: REPOSITORY, task: TASK, base,
    candidate: { ref: REF, sha: candidate },
    bundle: { sha256: sha256(bytes), bytes: bytes.length, prerequisites: options.incremental === true ? [base] : [] },
    claims: { implement: "succeeded", review: "succeeded" },
  };
  if (options.recovery !== undefined) {
    const recovery = Buffer.from(options.recovery);
    writeFileSync(join(artifacts, "recovery.data"), recovery);
    manifest.recovery = { sha256: sha256(recovery), bytes: recovery.length };
  }
  const writeManifest = (value: unknown): void => writeFileSync(join(artifacts, "candidate.json"), typeof value === "string" ? value : JSON.stringify(value));
  writeManifest(manifest);
  live.add(cleanup);
  return {
    host, guest, artifacts, base, candidate, manifest,
    expected: { repository: REPOSITORY, task: TASK, base, ref: REF },
    writeManifest,
    writeBundle: (next) => writeFileSync(bundlePath, next),
    bundle: () => readFileSync(bundlePath),
    cleanup,
  };
  function cleanup(): void {
    live.delete(cleanup);
    host.cleanup();
    guest.cleanup();
    rmSync(artifacts, { recursive: true, force: true });
  }
}

// A test file stopped for a timeout never runs its t.after hooks, so fixtures are also removed
// when the process exits or is signalled. One stuck in a blocking system call still leaks them.
const live = new Set<() => void>();
const removeAll = (): void => { for (const cleanup of [...live]) cleanup(); };
process.on("exit", removeAll);
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    removeAll();
    process.kill(process.pid, signal);
  });
}

function objectHeader(type: number, size: number): Buffer {
  const bytes = [(type << 4) | (size & 0x0f)];
  for (let rest = size >>> 4; rest > 0; rest >>>= 7) {
    bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) | 0x80;
    bytes.push(rest & 0x7f);
  }
  return Buffer.from(bytes);
}

function varint(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value;
  do {
    bytes.push((rest & 0x7f) | (rest >= 0x80 ? 0x80 : 0));
    rest = Math.floor(rest / 0x80);
  } while (rest > 0);
  return Buffer.from(bytes);
}

const BOMB_BASE_BYTES = 0x10000;

/** A v2 bundle naming `sha` at `ref` whose pack holds a 64 KiB blob and `deltas` deltas that each
 * copy it about `copies` times, so a few hundred bytes inflate to copies x 64 KiB per delta inside
 * index-pack. Each delta copies once fewer than the last, so no two results are the same object. */
export function deltaBomb(ref: string, sha: string, copies: number, deltas = 1): Buffer {
  const base = Buffer.alloc(BOMB_BASE_BYTES, 0x61);
  const baseId = createHash("sha1").update(`blob ${String(base.length)}\0`).update(base).digest();
  const objects = Array.from({ length: deltas }, (_, index) => {
    // 0x80 alone is "copy 0x10000 bytes from offset 0" of the base.
    const delta = Buffer.concat([varint(base.length), varint(base.length * (copies - index)), Buffer.alloc(copies - index, 0x80)]);
    return Buffer.concat([objectHeader(7, delta.length), baseId, deflateSync(delta)]);
  });
  const count = Buffer.alloc(4);
  count.writeUInt32BE(1 + deltas);
  const pack = Buffer.concat([
    Buffer.from("PACK"), Buffer.from([0, 0, 0, 2]), count,
    objectHeader(3, base.length), deflateSync(base), ...objects,
  ]);
  const trailer = createHash("sha1").update(pack).digest();
  return Buffer.concat([Buffer.from(`# v2 git bundle\n${sha} ${ref}\n\n`), pack, trailer]);
}

/** A bundle of `bundled` whose header line is renamed to `ref`, so a branch line can name a tag. */
export function renameBundleRef(bytes: Buffer, bundled: string, ref: string): Buffer {
  const end = bytes.indexOf("\n\n");
  const header = bytes.subarray(0, end).toString("utf8").replace(` ${bundled}`, ` ${ref}`);
  return Buffer.concat([Buffer.from(header), bytes.subarray(end)]);
}

/** The manifest with `bundle` re-described for new bundle bytes, so only the property under test differs. */
export function describeBundle(manifest: Record<string, unknown>, bytes: Buffer, prerequisites?: readonly string[]): Record<string, unknown> {
  const bundle = typeof manifest.bundle === "object" && manifest.bundle !== null ? manifest.bundle : {};
  return { ...manifest, bundle: { ...bundle, sha256: sha256(bytes), bytes: bytes.length, ...(prerequisites === undefined ? {} : { prerequisites }) } };
}
