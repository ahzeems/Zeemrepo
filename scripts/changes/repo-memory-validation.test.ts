import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG } from "../lib/paths.ts";
import { memoryRefusals } from "./repo-memory-validation.ts";

const RECORD = "wiki/work/projects/Zimi migration.md";
const good = ["status: in-progress", '  - "VERIFIED: npm run check passes (350 tests)"'];

await test("a branch with only exempt or changelog changes needs no record", () => {
  assert.deepEqual(memoryRefusals([CHANGELOG, "package-lock.json", "wiki/sessions/2026-10-09 A.md"], []), []);
});

await test("a branch updating its work record with evidence and status passes", () => {
  assert.deepEqual(memoryRefusals(["wiki/lessons/A.md", RECORD], good), []);
});

await test("refusals name what the record is missing", async (t) => {
  const cases: [string, string[], string[], RegExp][] = [
    ["no work record", ["wiki/lessons/A.md"], [], /updates no work record under wiki\/work\//],
    ["no labelled evidence", ["wiki/lessons/A.md", RECORD], ["status: in-progress", "  - npm run check passes"], /no VERIFIED: or OWNER DECISION: evidence/],
    ["evidence that says it did not happen", ["wiki/lessons/A.md", RECORD], ["status: done", '  - "VERIFIED: pending, not yet run"'], /no VERIFIED: or OWNER DECISION: evidence/],
    ["inference only", ["wiki/lessons/A.md", RECORD], ["status: done", '  - "INFERRED: probably fine"'], /no VERIFIED: or OWNER DECISION: evidence/],
    ["status and next action unchanged", ["wiki/lessons/A.md", RECORD], ['  - "VERIFIED: npm test passes"'], /status and next action are unchanged/],
  ];
  for (const [name, changed, added, expected] of cases) await t.test(name, () => assert.match(memoryRefusals(changed, added).join("\n"), expected));
});

await test("a workflow-critical change needs an operating document or a reasoned exemption", async (t) => {
  await t.test("refused without either", () => {
    assert.match(memoryRefusals([".githooks/pre-push", RECORD], good).join(), /workflow-critical files \(\.githooks\/pre-push\) without updating a decision, reference or runbook/);
  });
  await t.test("passes with a runbook update", () => {
    assert.deepEqual(memoryRefusals(["scripts/lib/git.ts", "wiki/runbooks/Verify a change.md", RECORD], good), []);
  });
  await t.test("passes with [no-doc-change: reason] in the record", () => {
    assert.deepEqual(memoryRefusals(["scripts/lib/git.ts", RECORD], [...good, "[no-doc-change: internal refactor, no behaviour change]"]), []);
  });
  await t.test("the escape hatch quoted in code does not count", () => {
    assert.match(memoryRefusals(["scripts/lib/git.ts", RECORD], [...good, "Write `[no-doc-change: reason]` to opt out."]).join(), /workflow-critical/);
  });
  await t.test("the changelog is not an operating document", () => {
    assert.match(memoryRefusals(["scripts/lib/git.ts", CHANGELOG, RECORD], good).join(), /workflow-critical/);
  });
});
