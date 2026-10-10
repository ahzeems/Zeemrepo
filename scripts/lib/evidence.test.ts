import assert from "node:assert/strict";
import { test } from "node:test";
import { EVIDENCE_LABEL, STRONG_EVIDENCE } from "./evidence.ts";

await test("an evidence item starts with a label, one space and the claim", () => {
  for (const item of ["VERIFIED: npm test passes", "INFERRED: from the log", "UNKNOWN: not run", "OWNER DECISION: \"yes\" (2026-10-10)"]) {
    assert.ok(EVIDENCE_LABEL.test(item), item);
  }
  for (const item of ["VERIFIED:npm test", "VERIFIED:  ", "Verified: x", "PROBABLY: x", "x VERIFIED: y"]) assert.ok(!EVIDENCE_LABEL.test(item), item);
});

await test("only what was run or read, or what the owner said, is strong evidence", () => {
  assert.ok(STRONG_EVIDENCE.test("VERIFIED: npm test passes"));
  assert.ok(STRONG_EVIDENCE.test("OWNER DECISION: \"yes\""));
  for (const item of ["INFERRED: probably", "UNKNOWN: not run", "VERIFIED:x"]) assert.ok(!STRONG_EVIDENCE.test(item), item);
});
