import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownReferences } from "./markdown-references.ts";

await test("collects relative link and image targets, not external ones", () => {
  const refs = markdownReferences("[a](../x/SKILL.md) [b](https://example.com) [c](mailto:x) ![i](img.png) [d](//cdn/x)");
  assert.deepEqual(refs.links, ["../x/SKILL.md"]);
  assert.deepEqual(refs.images, ["img.png"]);
});

await test("reference-style and angle-bracket links resolve to their real targets", () => {
  const refs = markdownReferences("[a][ref] [b](<with space.md>)\n\n[ref]: target.md\n");
  assert.deepEqual(refs.links.sort(), ["target.md", "with%20space.md"].sort());
});

await test("links in code, comments and frontmatter are not citations", () => {
  const source = "---\ndescription: \"[x](front.md)\"\n---\n`[a](inline.md)`\n\n```\n[b](fenced.md)\n```\n\n<!-- [c](comment.md) -->\n";
  assert.deepEqual(markdownReferences(source).links, []);
});

await test("headings become GitHub-style slugs, with numbered duplicates", () => {
  const refs = markdownReferences("# Hello, World!\n## Hello, World!\n### Use `code` here\n");
  assert.deepEqual([...refs.headings], ["hello-world", "hello-world-1", "use-code-here"]);
});

await test("an image inside a link counts as an image, and the outer link as a link", () => {
  const refs = markdownReferences("[![alt [inner](nested.md)](pic.png)](outer.md)");
  assert.deepEqual(refs.links, ["outer.md"]);
  assert.deepEqual(refs.images, ["pic.png"]);
});
