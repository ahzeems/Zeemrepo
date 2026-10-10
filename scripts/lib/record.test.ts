import assert from "node:assert/strict";
import { test } from "node:test";
import { isRecord, isStringArray, stringValue } from "./record.ts";

await test("isRecord", async (t) => {
  await t.test("accepts non-array objects", () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord({ a: 1 }), true);
  });
  await t.test("rejects arrays, null and primitives", () => {
    for (const value of [[], null, undefined, "x", 1, true]) assert.equal(isRecord(value), false);
  });
});

await test("isStringArray requires every item to be a string", () => {
  assert.equal(isStringArray(["a", "b"]), true);
  assert.equal(isStringArray([]), true);
  assert.equal(isStringArray(["a", 1]), false);
  assert.equal(isStringArray("a"), false);
});

await test("stringValue returns strings and blanks everything else", () => {
  assert.equal(stringValue("x"), "x");
  assert.equal(stringValue(1), "");
  assert.equal(stringValue(null), "");
});
