import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { WIKI_SCHEMA } from "../lib/paths.ts";
import { MEMORY_TYPES, allowedList, missingSections } from "./schema.ts";

await test("allowedList reads backticked entries between marker comments", () => {
  const schema = "intro `outside`\n<!-- tags:start -->\n- `area/git`\n- `kind/pitfall`\n<!-- tags:end -->\n`after`";
  assert.deepEqual([...allowedList(schema, "tags")], ["area/git", "kind/pitfall"]);
});

await test("allowedList is empty when the markers are missing", () => {
  assert.equal(allowedList("- `area/git`", "tags").size, 0);
});

await test("the repository schema documents open author identities and controlled tags", () => {
  const schema = readFileSync(join(import.meta.dirname, "../..", WIKI_SCHEMA), "utf8");
  assert.match(schema, /any provider or harness/);
  assert.match(schema, /kebab-case/);
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

// A required section is a visible, top-level level-2 heading whose source text is exactly the
// section name. Examples in comments, fences or indented code are not sections.
await test("missingSections: visible level-2 headings satisfy the requirement", async (t) => {
  await t.test("ATX headings, with or without a closing sequence or trailing spaces", () => {
    assert.deepEqual(missingSections("## Fix\n\ntext\n\n## How to apply ##\n\n##   Goal   \n", ["Fix", "How to apply", "Goal"]), []);
  });
  await t.test("a setext level-2 heading is the same heading", () => {
    assert.deepEqual(missingSections("Intro.\n\nFix\n---\n", ["Fix"]), []);
  });
  await t.test("a heading that follows a fenced example still counts", () => {
    assert.deepEqual(missingSections("```md\n## Example\n```\n\n## Fix\n", ["Fix"]), []);
  });
});

await test("missingSections: hidden or different headings do not satisfy the requirement", async (t) => {
  const cases: [string, string][] = [
    ["a one-line HTML comment", "<!-- ## Fix -->\n"],
    ["a multi-line HTML comment", "<!--\n## Fix\n-->\n"],
    ["a backtick fence", "```\n## Fix\n```\n"],
    ["a tilde fence", "~~~markdown\n## Fix\n~~~\n"],
    ["an indented code block", "Text.\n\n    ## Fix\n"],
    ["a level-3 heading", "### Fix\n"],
    ["a level-1 heading", "# Fix\n"],
    ["a setext level-1 heading", "Fix\n===\n"],
    ["a heading inside a blockquote", "> ## Fix\n"],
    ["a heading inside a list item", "- ## Fix\n"],
    ["inline formatting around the name", "## **Fix**\n"],
    ["a longer heading that starts with the name", "## Fix later\n"],
    ["escaped heading markers", "\\## Fix\n"],
    ["an unclosed fence at end of file", "## X\n```\nFix"],
  ];
  for (const [name, body] of cases) {
    await t.test(name, () => {
      assert.deepEqual(missingSections(body, ["Fix"]), ["Fix"]);
    });
  }
});
