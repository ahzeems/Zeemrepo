import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { readStandards } from "./skill-standards.ts";

const valid = { descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: ["bro"] };

function read(t: TestContext, config: unknown): ReturnType<typeof readStandards> {
  const root = mkdtempSync(join(tmpdir(), "skill-standards-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (config !== undefined) {
    mkdirSync(join(root, "config"));
    writeFileSync(join(root, "config/skill-standards.json"), typeof config === "string" ? config : JSON.stringify(config));
  }
  return readStandards(root);
}

await test("reads a valid standards file", (t) => {
  assert.deepEqual(read(t, valid), valid);
});

await test("explains every malformed standards file", async (t) => {
  const cases: [string, unknown, RegExp][] = [
    ["missing", undefined, /missing/],
    ["not JSON", "{", /not valid JSON/],
    ["not an object", [], /must be an object/],
    ["non-numeric limits", { ...valid, bodyLimit: "6000" }, /numeric descriptionLimit and bodyLimit/],
    ["no allowances list", { ...valid, allowances: undefined }, /allowances list/],
    ["no userOnly list", { ...valid, userOnly: [1] }, /userOnly list/],
    ["allowance without a skill", { ...valid, allowances: [{ rule: "bodyLimit", reason: "a long enough reason" }] }, /names a skill and a rule/],
    ["allowance without a real reason", { ...valid, allowances: [{ skill: "x", rule: "bodyLimit", reason: "short" }] }, /needs a reason/],
    ["allowance for an unknown rule", { ...valid, allowances: [{ skill: "x", rule: "made-up", reason: "a long enough reason" }] }, /unknown rule/],
    ["retired routes field", { ...valid, routes: ["AGENTS.md"] }, /unknown field "routes"/],
  ];
  for (const [name, config, expected] of cases) {
    await t.test(name, (t) => {
      const result = read(t, config);
      if (typeof result !== "string") assert.fail(`expected an error message, got ${JSON.stringify(result)}`);
      assert.match(result, expected);
    });
  }
});
