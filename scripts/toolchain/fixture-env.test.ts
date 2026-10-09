import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

// A test that spawns git without scrubbing GIT_* acts on the real repository when it runs
// under a hook (wiki lesson "Hook-run checks must preserve Git state"). Every direct git
// spawn outside scripts/lib/git.ts must pass cleanGitEnv in the same call.
const root = join(import.meta.dirname, "../..");
// git.ts scrubs per call; this file holds the samples below.
const ALLOWED = new Set(["scripts/lib/git.ts", "scripts/toolchain/fixture-env.test.ts"]);
const SPAWN = /\b(?:execFileSync|execFile|spawnSync|spawn)\(\s*"git"[^;]*?\)/gs;

function unscrubbedGitSpawns(source: string): string[] {
  return [...source.matchAll(SPAWN)].map((match) => match[0]).filter((call) => !call.includes("cleanGitEnv"));
}

function typescriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "fixtures" ? [] : typescriptFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

await test("the spawn check catches an unscrubbed git call and passes a scrubbed one", () => {
  assert.equal(unscrubbedGitSpawns('execFileSync("git", ["init"], { cwd: dir });').length, 1);
  assert.equal(unscrubbedGitSpawns('spawnSync(\n  "git", args, { cwd });').length, 1);
  assert.equal(unscrubbedGitSpawns('execFileSync("git", ["init"], { cwd: dir, env: cleanGitEnv });').length, 0);
  assert.equal(unscrubbedGitSpawns('execFileSync("node", ["x.ts"]);').length, 0);
});

await test("every direct git spawn in scripts passes cleanGitEnv", () => {
  const offenders = typescriptFiles(join(root, "scripts"))
    .map((path) => relative(root, path).replace(/\\/g, "/"))
    .filter((path) => !ALLOWED.has(path))
    .flatMap((path) => unscrubbedGitSpawns(readFileSync(join(root, path), "utf8")).map((call) => `${path}: ${call.split("\n")[0] ?? ""}`));
  assert.deepEqual(offenders, []);
});
