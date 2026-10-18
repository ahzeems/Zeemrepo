import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Runtime, RuntimeResult, Step, StepRun } from "../sandcastle/container-runtime.ts";
import type { ReviewerIdentity } from "../sandcastle/verification-receipt.ts";
import type { Reviewer, ReviewInput } from "../sandcastle/verifier-driver.ts";
import { cleanGitEnv, createRepo, type RepoFixture } from "./repo-fixture.ts";

// A trusted host repository whose base commit defines one check, `test`, and a guest that built a
// candidate on it and exported it as a Sandcastle artifact. The fake runtime and reviewer stand in
// for the container and the model; nothing here runs candidate content.
export const REPOSITORY = "Zimfra/software_testing";
export const TASK = "issue-42";
export const REF = `refs/heads/sandcastle/${TASK}`;
export const CHECKS = ["test"] as const;
export const BASE_TEST = "node check/feature.mjs";

const PACKAGE = (test: string): string => `${JSON.stringify({ name: "verifier-fixture", version: "0.0.0", private: true, scripts: { test, "check:base": "npm test" } }, null, 2)}\n`;
const LOCK = `${JSON.stringify({ name: "verifier-fixture", version: "0.0.0", lockfileVersion: 3, requires: true, packages: { "": { name: "verifier-fixture", version: "0.0.0" } } }, null, 2)}\n`;
const FEATURE_CHECK = `import { readFileSync } from "node:fs";\nif (readFileSync("feature.txt", "utf8") !== "ok\\n") { console.error("feature.txt is not ok"); process.exit(1); }\nconsole.log("feature ok");\n`;

/** The base's package.json with its test script replaced, as a candidate rewriting its check would write it. */
export const packageWithTest = (test: string): string => PACKAGE(test);

export type VerifierFixture = {
  host: RepoFixture; artifacts: string; store: string; root: string;
  base: string; candidate: string; run: string;
  expected: { repository: string; task: string; base: string; ref: string };
  cleanup(): void;
};

export type VerifierOptions = { basePackage?: string; files?: Readonly<Record<string, string>>; run?: string; claims?: Record<string, string>; recovery?: string };

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function guestOn(host: RepoFixture, base: string): RepoFixture {
  const guest = createRepo("verifier-guest-");
  guest.git(["fetch", "--quiet", host.dir, "main"]);
  guest.git(["reset", "--quiet", "--hard", base]);
  return guest;
}

function exportArtifact(guest: RepoFixture, base: string, candidate: string, options: VerifierOptions): string {
  const artifacts = mkdtempSync(join(tmpdir(), "verifier-artifact-"));
  guest.git(["update-ref", REF, candidate]);
  guest.git(["bundle", "create", "--quiet", join(artifacts, "candidate.bundle"), REF]);
  const bytes = readFileSync(join(artifacts, "candidate.bundle"));
  const manifest: Record<string, unknown> = {
    version: 1, repository: REPOSITORY, task: TASK, base, candidate: { ref: REF, sha: candidate },
    bundle: { sha256: sha256(bytes), bytes: bytes.length, prerequisites: [] },
    claims: options.claims ?? { implement: "succeeded", review: "succeeded" },
  };
  if (options.recovery !== undefined) {
    const recovery = Buffer.from(options.recovery);
    writeFileSync(join(artifacts, "recovery.data"), recovery);
    manifest.recovery = { sha256: sha256(recovery), bytes: recovery.length };
  }
  writeFileSync(join(artifacts, "candidate.json"), JSON.stringify(manifest));
  return artifacts;
}

/** A base with one check and a candidate on it; `files` replaces the candidate's default change. */
export function createVerifierCandidate(options: VerifierOptions = {}): VerifierFixture {
  const host = createRepo("verifier-host-");
  host.write("package.json", options.basePackage ?? PACKAGE(BASE_TEST));
  host.write("package-lock.json", LOCK);
  host.write("check/feature.mjs", FEATURE_CHECK);
  host.write("README.md", "base\n");
  const base = host.commit("base");
  const guest = guestOn(host, base);
  for (const [path, content] of Object.entries(options.files ?? { "feature.txt": "ok\n" })) guest.write(path, content);
  const candidate = guest.commit("feat: candidate work");
  const artifacts = exportArtifact(guest, base, candidate, options);
  guest.cleanup();
  const store = mkdtempSync(join(tmpdir(), "verifier-store-"));
  chmodSync(store, 0o700);
  const root = mkdtempSync(join(tmpdir(), "verifier-quarantine-"));
  const cleanup = (): void => { for (const dir of [host.dir, artifacts, store, root]) rmSync(dir, { recursive: true, force: true }); };
  return {
    host, artifacts, store, root, base, candidate, run: options.run ?? "run-1",
    expected: { repository: REPOSITORY, task: TASK, base, ref: REF }, cleanup,
  };
}

/** A new artifact directory for another candidate on the same base, as an integration producing a new SHA would make. */
export function anotherCandidate(made: VerifierFixture, files: Readonly<Record<string, string>>): string {
  const guest = guestOn(made.host, made.base);
  for (const [path, content] of Object.entries(files)) guest.write(path, content);
  const candidate = guest.commit("feat: integrated candidate");
  const artifacts = exportArtifact(guest, made.base, candidate, {});
  guest.cleanup();
  return artifacts;
}

export type FakeRuntime = Runtime & { calls: { entries: string[]; steps: Step[] }[] };

/** A runtime that records what it was handed and reports `exit(step)` without executing anything. */
export function fakeRuntime(exit: (step: Step) => number | null = () => 0, image = "sha256:fake-image"): FakeRuntime {
  const calls: { entries: string[]; steps: Step[] }[] = [];
  return {
    calls,
    identity: () => ({ runtime: "fake", image }),
    run: (tarPath: string, steps: readonly Step[]): RuntimeResult => {
      const entries = execFileSync("tar", ["-t", "-f", tarPath], { encoding: "utf8", env: cleanGitEnv }).split("\n").filter((line) => line !== "");
      calls.push({ entries, steps: [...steps] });
      const results: StepRun[] = steps.map((step) => {
        const output = Buffer.from(`${step.name} output\n`);
        return { name: step.name, command: step.command, exit: exit(step), outputSha256: sha256(output), outputBytes: output.length, output };
      });
      return { results };
    },
  };
}

export const FAKE_REVIEWER: ReviewerIdentity = { name: "fake-reviewer", model: "fake-model", version: "1" };
export const PASS = JSON.stringify({ verdict: "pass", findings: [] });
export const FAIL = JSON.stringify({ verdict: "fail", findings: ["the change breaks the feature"] });

export type FakeReviewer = Reviewer & { inputs: ReviewInput[] };

/** A reviewer that answers with a fixed model response, as recorded model output would. */
export function fakeReviewer(response: string | ((input: ReviewInput) => string) = PASS, identity: ReviewerIdentity = FAKE_REVIEWER): FakeReviewer {
  const inputs: ReviewInput[] = [];
  return {
    inputs, identity,
    review: (input) => {
      inputs.push(input);
      return Promise.resolve(typeof response === "string" ? response : response(input));
    },
  };
}
