import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { listFiles, unpairedSources } from "./test-pairing.ts";

await test("unpairedSources", async (t) => {
  await t.test("accepts sources that each have a sibling test", () => {
    assert.deepEqual(unpairedSources(["lib/git.ts", "lib/git.test.ts"]), []);
  });

  await t.test("reports a source with no sibling test", () => {
    assert.deepEqual(unpairedSources(["wiki/lint.ts", "lib/git.ts", "lib/git.test.ts"]), ["wiki/lint.ts"]);
  });

  await t.test("does not accept a test in another directory as the pair", () => {
    assert.deepEqual(unpairedSources(["wiki/lint.ts", "lint.test.ts"]), ["wiki/lint.ts"]);
  });

  await t.test("exempts fixtures and test-support helpers", () => {
    assert.deepEqual(unpairedSources(["fixtures/broken/x.ts", "test-support/repo-fixture.ts"]), []);
  });

  await t.test("ignores non-TypeScript files", () => {
    assert.deepEqual(unpairedSources(["wiki/schema.json", "README.md"]), []);
  });
});

await test("listFiles walks nested directories with forward-slash paths", () => {
  const root = mkdtempSync(join(tmpdir(), "test-pairing-"));
  try {
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "top.ts"), "");
    writeFileSync(join(root, "a", "b", "deep.ts"), "");
    assert.deepEqual(listFiles(root).sort(), ["a/b/deep.ts", "top.ts"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("every script in this repository has a sibling test", () => {
  const scripts = join(import.meta.dirname, "..");
  assert.deepEqual(unpairedSources(listFiles(scripts)), []);
});
