import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { WIKI_SCHEMA } from "../lib/paths.ts";
import { MEMORY_TYPES, allowedList } from "./schema.ts";

await test("allowedList reads backticked entries between marker comments", () => {
  const schema = "intro `outside`\n<!-- tags:start -->\n- `area/git`\n- `kind/pitfall`\n<!-- tags:end -->\n`after`";
  assert.deepEqual([...allowedList(schema, "tags")], ["area/git", "kind/pitfall"]);
});

await test("allowedList is empty when the markers are missing", () => {
  assert.equal(allowedList("- `area/git`", "tags").size, 0);
});

await test("the repository schema allows only Claude Code and humans as authors", () => {
  const schema = readFileSync(join(import.meta.dirname, "../..", WIKI_SCHEMA), "utf8");
  assert.deepEqual([...allowedList(schema, "agents")].sort(), ["claude-code", "human"]);
  assert.ok(allowedList(schema, "tags").size > 10);
});

await test("every memory type has its own folder", () => {
  const folders = [...MEMORY_TYPES.values()].map((spec) => spec.folder);
  assert.equal(new Set(folders).size, folders.length);
});

await test("allowedList reads only list items, not backticks in prose between the markers", () => {
  const schema = "<!-- tags:start -->\nUse a tag like `made/up` in prose.\n- `area/git`\n-   `kind/pitfall`  \n<!-- tags:end -->";
  assert.deepEqual([...allowedList(schema, "tags")], ["area/git", "kind/pitfall"]);
});
