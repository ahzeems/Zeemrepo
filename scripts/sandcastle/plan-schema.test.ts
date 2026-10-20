import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { planSchema } from "./plan-schema.ts";

const validate = (value: unknown): ReturnType<typeof planSchema["~standard"]["validate"]> =>
  planSchema["~standard"].validate(value);

await test("planSchema accepts a plan and returns its issues", () => {
  const plan = { issues: [{ id: "42", title: "Fix auth bug", branch: "sandcastle/issue-42" }], blocked: [] };
  assert.deepEqual(validate(plan), { value: plan });
  assert.deepEqual(validate({ issues: [], blocked: [] }), { value: { issues: [], blocked: [] } });
});

const selected = (id: number): Record<string, string> => ({ id: String(id), title: `Issue ${id}`, branch: `sandcastle/issue-${id}` });
const held = (id: number, blockedBy: unknown): unknown => ({ id: String(id), title: `Issue ${id}`, blockedBy });

await test("planSchema keeps the three queue states apart: empty, wholly blocked and eligible", () => {
  assert.deepEqual(validate({ issues: [], blocked: [] }), { value: { issues: [], blocked: [] } });
  assert.deepEqual(validate({ issues: [], blocked: [held(2, ["1"])] }), { value: { issues: [], blocked: [{ id: "2", title: "Issue 2", blockedBy: ["1"] }] } });
  assert.deepEqual(validate({ issues: [selected(1)], blocked: [held(2, ["1", "9"])] }), {
    value: { issues: [{ id: "1", title: "Issue 1", branch: "sandcastle/issue-1" }], blocked: [{ id: "2", title: "Issue 2", blockedBy: ["1", "9"] }] },
  });
});

await test("planSchema refuses a plan that does not say which issues are blocked, or contradicts itself", () => {
  const failing: [string, unknown, string][] = [
    ["no blocked list", { issues: [] }, "blocked"],
    ["a blocked list that is not an array", { issues: [], blocked: {} }, "blocked"],
    ["a blocked entry that is not an object", { issues: [], blocked: ["2"] }, "blocked.0"],
    ["a blocked entry without blockers", { issues: [], blocked: [held(2, [])] }, "blocked.0.blockedBy"],
    ["blockers that are not a list", { issues: [], blocked: [held(2, "1")] }, "blocked.0.blockedBy"],
    ["a blocker that is not an issue number", { issues: [], blocked: [held(2, ["#1"])] }, "blocked.0.blockedBy"],
    ["a numeric blocker", { issues: [], blocked: [held(2, [1])] }, "blocked.0.blockedBy"],
    ["an issue blocked by itself", { issues: [], blocked: [held(2, ["2"])] }, "blocked.0.blockedBy"],
    ["a blocker named twice", { issues: [], blocked: [held(2, ["1", "1"])] }, "blocked.0.blockedBy"],
    ["a blocked id that is not a number", { issues: [], blocked: [{ id: "2a", title: "t", blockedBy: ["1"] }] }, "blocked.0.id"],
    ["a blocked entry with an empty title", { issues: [], blocked: [{ id: "2", title: " ", blockedBy: ["1"] }] }, "blocked.0.title"],
    ["the same issue blocked twice", { issues: [], blocked: [held(2, ["1"]), held(2, ["3"])] }, "blocked.1.id"],
    ["an issue both selected and blocked", { issues: [selected(1), selected(2)], blocked: [held(2, ["1"])] }, "blocked.0.id"],
    ["a selected issue that declares blockers", { issues: [{ ...selected(1), blockedBy: ["3"] }], blocked: [] }, "issues.0.blockedBy"],
  ];
  for (const [name, value, path] of failing) {
    const result = validate(value);
    assert.ok("issues" in result && result.issues.length > 0, name);
    assert.equal("issues" in result ? result.issues[0]?.path.join(".") : undefined, path, name);
  }
});

await test("planSchema reports problems in issues and blocked together", () => {
  const result = validate({ issues: [{ id: "x", title: "t", branch: "sandcastle/issue-x" }], blocked: [held(2, [])] });
  assert.deepEqual("issues" in result ? result.issues.map((problem) => problem.path.join(".")) : [], ["issues.0.id", "blocked.0.blockedBy"]);
});

// The schema checks the dependency metadata the planner declares, never the reasoning behind it:
// whether issue text really means "blocked" is the model's unverified reading of natural language.
await test("planSchema accepts a selected issue whose text claims a blocker the plan does not declare", () => {
  const plan = { issues: [{ id: "4", title: "Blocked by #3 until the API lands", branch: "sandcastle/issue-4" }], blocked: [] };
  assert.deepEqual(validate(plan), { value: plan });
});

await test("planSchema refuses a plan with the wrong shape, naming where", () => {
  const failing: [string, unknown, string][] = [
    ["a non-object", "nope", ""],
    ["null", null, ""],
    ["no issues list", {}, "issues"],
    ["issues that is not an array", { issues: "x" }, "issues"],
    ["an issue that is not an object", { issues: [1] }, "issues.0"],
    ["a numeric id", { issues: [{ id: 42, title: "t", branch: "sandcastle/issue-42" }] }, "issues.0.id"],
    ["a missing title", { issues: [{ id: "1", branch: "sandcastle/issue-1" }] }, "issues.0.title"],
    ["a missing branch", { issues: [{ id: "1", title: "t" }] }, "issues.0.branch"],
    ["an id that is not a number", { issues: [{ id: "1; rm", title: "t", branch: "sandcastle/issue-1" }] }, "issues.0.id"],
    ["a branch outside sandcastle/issue-N", { issues: [{ id: "1", title: "t", branch: "main" }] }, "issues.0.branch"],
    ["a branch that starts with a dash", { issues: [{ id: "1", title: "t", branch: "--all" }] }, "issues.0.branch"],
    ["a branch that names another issue", { issues: [{ id: "1", title: "t", branch: "sandcastle/issue-2" }] }, "issues.0.branch"],
    ["an id with a leading zero", { issues: [{ id: "007", title: "t", branch: "sandcastle/issue-007" }] }, "issues.0.id"],
    ["an empty title", { issues: [{ id: "1", title: "  ", branch: "sandcastle/issue-1" }] }, "issues.0.title"],
    ["the same issue twice", { issues: [{ id: "1", title: "t", branch: "sandcastle/issue-1" }, { id: "1", title: "u", branch: "sandcastle/issue-1" }] }, "issues.1.id"],
    ["a branch with a path suffix", { issues: [{ id: "1", title: "t", branch: "sandcastle/issue-1/../x" }] }, "issues.0.branch"],
  ];
  for (const [name, value, path] of failing) {
    const result = validate(value);
    assert.ok("issues" in result && result.issues.length > 0, name);
    assert.equal("issues" in result ? result.issues[0]?.path.join(".") : undefined, path, name);
  }
});

await test("planSchema normalises a title instead of refusing the plan", () => {
  const titled = (title: string): unknown => {
    const result = validate({ issues: [{ id: "3", title, branch: "sandcastle/issue-3" }], blocked: [] });
    return "value" in result ? result.value.issues[0]?.title : result;
  };
  assert.equal(titled("Fix `foo` crash"), "Fix 'foo' crash");
  assert.equal(titled("  two\nlines\r\n here "), "two lines here");
  assert.equal(titled("bell\u0007 and \u001b[31mred"), "bell and [31mred");
  assert.equal(titled("x".repeat(250)), "x".repeat(200));
  assert.equal(titled("a\u202Eb\u200Bc"), "abc", "bidi and zero-width format characters are removed");
  assert.equal(titled("\u{1F600}".repeat(250)), "\u{1F600}".repeat(200), "cut by code point, never inside a surrogate pair");
});

// Sandcastle's extractObject (dist/index.js, 0.12.0) treats a truthy `issues` on the result as
// a validation failure and otherwise returns `value`; extractStructuredOutput is not exported, so
// the test applies that same contract to the schema's results.
await test("planSchema results follow the contract Sandcastle's Output.object reads", () => {
  const plan = { issues: [{ id: "7", title: "t", branch: "sandcastle/issue-7" }], blocked: [] };
  const accepted = validate(plan);
  assert.ok("value" in accepted && !("issues" in accepted), "a plan must not carry a top-level issues key on success");
  assert.deepEqual(accepted.value, plan);
  for (const bad of [{ issues: [{ id: "x", title: "t", branch: "sandcastle/issue-x" }] }, { issues: 3 }, null]) {
    const refused = validate(bad);
    assert.ok("issues" in refused && refused.issues.length > 0 && !("value" in refused));
  }
});

// The prompt is the only place the planner learns the contract, so its examples must pass the schema
// and it must not tell the planner to pick a blocked issue when nothing is eligible.
await test("the plan prompt's example plans pass the schema and it never waives a dependency", () => {
  const prompt = readFileSync(new URL("../../.sandcastle/plan-prompt.md", import.meta.url), "utf8");
  const examples = [...prompt.matchAll(/<plan>\s*(\{[\s\S]*?\})\s*<\/plan>/g)].map(([, body]) => body ?? "");
  assert.ok(examples.length >= 2, "the prompt shows an eligible and an empty or blocked example");
  for (const body of examples) {
    const parsed: unknown = JSON.parse(body);
    assert.ok("value" in validate(parsed), body);
  }
  assert.ok(examples.some((body) => /"blocked":\s*\[\s*\{/.test(body)), "one example declares a blocked issue");
  // A phrase list cannot catch every rewording of the old waiver, so the prompt must also keep
  // the positive rule: blocked issues are listed, never selected, even when all are blocked.
  assert.doesNotMatch(prompt, /fewest|weakest|least[- ]blocked|highest-priority|If every issue is blocked, include/i);
  assert.match(prompt, /An issue appears in exactly one of the two lists\. Never move a blocked issue into `issues`[^.]*even when every issue is blocked/);
  assert.match(prompt, /an empty `issues` list is a valid plan/);
});
