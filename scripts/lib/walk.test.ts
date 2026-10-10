import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { walk } from "./walk.ts";

await test("walk", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "walk-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ["a.md", "b.txt", "sub/c.md", "dist/f.md", ".hidden/d.md", ".dot.md", "node_modules/e.md", ".git/config"]) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), "");
  }
  symlinkSync(join(root, "a.md"), join(root, "link.md"));
  const rel = (paths: readonly string[]): string[] => paths.map((path) => relative(root, path)).sort();

  await t.test("returns files, skipping dot entries, .git and node_modules", () => {
    assert.deepEqual(rel(walk(root).files), ["a.md", "b.txt", "dist/f.md", "sub/c.md"]);
  });

  await t.test("does not hide build-output directory names, which git may track", () => {
    assert.ok(rel(walk(root).files).includes("dist/f.md"));
  });

  await t.test("includes dot entries on request, but still never .git or node_modules", () => {
    assert.deepEqual(rel(walk(root, { includeDot: true }).files), [".dot.md", ".hidden/d.md", "a.md", "b.txt", "dist/f.md", "sub/c.md"]);
  });

  await t.test("skips the named directories at any depth", () => {
    assert.deepEqual(rel(walk(root, { skipDirs: new Set(["sub"]) }).files), ["a.md", "b.txt", "dist/f.md", "node_modules/e.md"]);
  });

  await t.test("reports symbolic links instead of following them", () => {
    assert.deepEqual(rel(walk(root).symlinks), ["link.md"]);
  });

  await t.test("returns nothing for a directory that does not exist", () => {
    assert.deepEqual(walk(join(root, "missing")), { files: [], symlinks: [] });
  });
});

await test("skipAtRoot skips a name only directly under the walked directory", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "walk-root-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of ["dist/a.md", "sub/dist/b.md"]) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), "x\n");
  }
  const files = walk(dir, { skipAtRoot: new Set(["dist"]) }).files.map((file) => relative(dir, file));
  assert.deepEqual(files, ["sub/dist/b.md"]);
});
