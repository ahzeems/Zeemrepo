import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFrontmatter } from "./frontmatter.ts";

function invalidReason(text: string): string {
  const parsed = parseFrontmatter(text);
  assert.equal(parsed.kind, "invalid");
  return parsed.reason;
}

await test("parseFrontmatter: ok", async (t) => {
  await t.test("returns parsed data and the body after the closing delimiter", () => {
    const parsed = parseFrontmatter("---\ntitle: A\ntags:\n  - x\n---\n# Body\n");
    assert.deepEqual(parsed, { kind: "ok", data: { title: "A", tags: ["x"] }, body: "# Body\n" });
  });

  await t.test("accepts Windows line endings and normalizes the body", () => {
    assert.deepEqual(parseFrontmatter("---\r\ntitle: A\r\n---\r\nline\r\n"), { kind: "ok", data: { title: "A" }, body: "line\n" });
  });

  await t.test("accepts a UTF-8 byte order mark", () => {
    assert.deepEqual(parseFrontmatter("\uFEFF---\ntitle: A\n---\n"), { kind: "ok", data: { title: "A" }, body: "" });
  });

  await t.test("accepts frontmatter that ends the file", () => {
    assert.deepEqual(parseFrontmatter("---\ntitle: A\n---"), { kind: "ok", data: { title: "A" }, body: "" });
  });

  await t.test("accepts an empty block as empty data", () => {
    assert.deepEqual(parseFrontmatter("---\n---\nbody\n"), { kind: "ok", data: {}, body: "body\n" });
  });

  await t.test("accepts aliases within the expansion cap", () => {
    assert.deepEqual(parseFrontmatter("---\nbase: &b x\ncopy: *b\n---\n"), { kind: "ok", data: { base: "x", copy: "x" }, body: "" });
  });
});

await test("parseFrontmatter: none", () => {
  assert.deepEqual(parseFrontmatter("# Just a heading\n"), { kind: "none" });
  assert.deepEqual(parseFrontmatter(""), { kind: "none" });
});

await test("parseFrontmatter: invalid, never mistaken for none", async (t) => {
  await t.test("an opened but unterminated block", () => {
    assert.match(invalidReason("---\ntitle: A\n"), /unterminated/);
  });

  await t.test("trailing text on the closing fence", () => {
    assert.match(invalidReason("---\ntitle: A\n--- \n"), /unterminated/);
  });

  await t.test("duplicate keys", () => {
    assert.match(invalidReason("---\nstatus: done\nstatus: open\n---\n"), /YAML/);
  });

  await t.test("a document that is not a mapping", () => {
    assert.match(invalidReason("---\n- a\n- b\n---\n"), /mapping/);
  });

  await t.test("malformed YAML", () => {
    assert.match(invalidReason("---\ntitle: [unclosed\n---\n"), /YAML/);
  });

  await t.test("alias expansion beyond the cap", () => {
    const anchors = ["a: &a [x, x, x, x, x, x, x, x, x, x]"];
    for (let level = 1; level <= 6; level += 1) {
      const previous = String.fromCharCode(96 + level);
      const next = String.fromCharCode(97 + level);
      anchors.push(`${next}: &${next} [${Array(10).fill(`*${previous}`).join(", ")}]`);
    }
    assert.match(invalidReason(`---\n${anchors.join("\n")}\n---\n`), /alias/i);
  });
});
