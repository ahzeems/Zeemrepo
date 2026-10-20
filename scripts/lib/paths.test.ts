import assert from "node:assert/strict";
import { test } from "node:test";
import * as paths from "./paths.ts";

await test("repository paths are relative, forward-slash, and directories end in a slash", () => {
  for (const [name, value] of Object.entries(paths)) {
    if (name.endsWith("_PATTERN")) continue;
    assert.equal(typeof value, "string", name);
    const path = String(value);
    assert.ok(!path.startsWith("/") && !path.startsWith("./"), `${name} is not repository-relative: ${path}`);
    assert.ok(!path.includes("\\"), `${name} uses a backslash: ${path}`);
    assert.equal(name.endsWith("_DIR"), path.endsWith("/"), `${name}: directories, and only directories, end in /`);
  }
});

await test("only _PATTERN exports are patterns, and each is anchored at both ends", () => {
  for (const [name, value] of Object.entries(paths)) {
    assert.equal(value instanceof RegExp, name.endsWith("_PATTERN"), name);
    if (!(value instanceof RegExp)) continue;
    assert.ok(value.source.startsWith("^") && value.source.endsWith("$"), `${name} is not anchored`);
    assert.equal(value.flags, "", `${name} takes no flags, so ^ and $ anchor the whole path and case counts`);
  }
});

await test("work records live inside the wiki", () => {
  assert.ok(paths.WORK_DIR.startsWith(paths.WIKI_DIR));
});

await test("a changelog fragment is a dated, lower-case kebab-case Markdown file directly in the changelog folder", () => {
  for (const path of [`${paths.CHANGELOG_DIR}2026-10-17-afk-change.md`, `${paths.CHANGELOG_DIR}2026-10-17-s07.md`]) {
    assert.ok(paths.CHANGELOG_FRAGMENT_PATTERN.test(path), path);
  }
  for (const path of [
    "changelog/notes.md", "changelog/2026-10-17.md", "changelog/2026-10-17-.md", "changelog/2026-10-17-Upper.md",
    "changelog/2026-10-17-a--b.md", "changelog/2026-10-17-change.py", "changelog/sub/2026-10-17-change.md",
    "CHANGELOG/2026-10-17-change.md", "wiki/changelog/2026-10-17-change.md", "changelog/26-10-17-change.md",
    "changelog/2026-10-17-change.md.ts", "changelog/2026-10-17-change.md\nscripts/x.ts",
  ]) {
    assert.ok(!paths.CHANGELOG_FRAGMENT_PATTERN.test(path), path);
  }
});
