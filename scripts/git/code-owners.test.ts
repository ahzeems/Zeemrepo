import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCodeOwners } from "./code-owners.ts";

await test("parseCodeOwners lists user logins in lower case and skips comments, teams and emails", () => {
  const text = "# Only the owner approves\n* @Owner # trailing\n/docs/ @org/team docs@example.com @second\n\n";
  assert.deepEqual(parseCodeOwners(text), ["owner", "second"]);
});

await test("parseCodeOwners finds no owners in an empty file or one with only patterns", () => {
  assert.deepEqual(parseCodeOwners(""), []);
  assert.deepEqual(parseCodeOwners("*\n/docs/\n"), []);
});
