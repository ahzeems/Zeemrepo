import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownTokens } from "./markdown.ts";

const types = (source: string): string[] => markdownTokens(source).map((token) => token.type);

await test("a comment spanning lines is one HTML block, not the Markdown inside it", () => {
  assert.deepEqual(types("<!--\n## Hidden\n\n[x](y.md)\n-->\n"), ["html_block"]);
});

await test("fenced and indented code are code tokens", () => {
  assert.deepEqual(types("```\n## Hidden\n```\n"), ["fence"]);
  assert.deepEqual(types("    ## Hidden\n"), ["code_block"]);
});

await test("a visible heading carries its tag, nesting level and source text", () => {
  const [open, inline] = markdownTokens("## Fix ##\n");
  assert.equal(open?.tag, "h2");
  assert.equal(open?.level, 0);
  assert.equal(inline?.content, "Fix");
});
