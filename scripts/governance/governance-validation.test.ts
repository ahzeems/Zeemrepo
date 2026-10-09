import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGovernance, configProblems, globToRegExp, readConfig } from "./governance-validation.ts";

const claim = { id: "self-merge-gate", pattern: "npm run gate", supersededBy: "PR-only landing (zimi-audit rule 5)" };
const valid = { surfaces: ["README.md"], exclude: [], staleClaims: [claim], allowed: [] };

await test("configProblems accepts a valid config and explains each defect", async (t) => {
  assert.deepEqual(configProblems(valid), []);
  const cases: [string, unknown, RegExp][] = [
    ["not an object", [], /must be an object/],
    ["no claims", { ...valid, staleClaims: [] }, /at least one claim/],
    ["claim without pattern", { ...valid, staleClaims: [{ id: "x" }] }, /non-empty id and pattern/],
    ["bad regex", { ...valid, staleClaims: [{ ...claim, pattern: "(" }] }, /not a valid regular expression/],
    ["no supersededBy", { ...valid, staleClaims: [{ id: "x", pattern: "y" }] }, /supersededBy/],
    ["duplicate claim ids", { ...valid, staleClaims: [claim, claim] }, /duplicate claim id/],
    ["no surfaces", { ...valid, surfaces: [] }, /surfaces must list/],
    ["exclude not a list", { ...valid, exclude: "x" }, /exclude must be a list/],
    ["allowance without reason", { ...valid, allowed: [{ path: "README.md", contains: "npm run gate here" }] }, /needs a non-empty path, contains, and reason/],
    ["allowance too short", { ...valid, allowed: [{ path: "README.md", contains: "gate", reason: "historical" }] }, /under 8 characters/],
    ["allowance naming an unknown claim", { ...valid, allowed: [{ path: "README.md", contains: "npm run gate here", reason: "x", claims: ["nope"] }] }, /unknown claim nope/],
  ];
  for (const [name, config, expected] of cases) await t.test(name, () => assert.match(configProblems(config).join("\n"), expected));
});

await test("readConfig returns typed values from a valid config", () => {
  assert.deepEqual(readConfig(valid), { surfaces: ["README.md"], exclude: [], staleClaims: [claim], allowed: [] });
});

await test("checkGovernance finds stale claims line by line, case-insensitively", () => {
  const result = checkGovernance([{ path: "README.md", text: "ok\nRun NPM RUN GATE to land.\n" }], { staleClaims: [claim], allowed: [] });
  assert.deepEqual(result.violations, [{ path: "README.md", line: 2, claim: "self-merge-gate", text: "Run NPM RUN GATE to land." }]);
});

await test("an allowance excuses one quoted line for the named claims, and an unused one is reported", () => {
  const allowed = [
    { path: "README.md", contains: "historically ran npm run gate", reason: "history" },
    { path: "README.md", contains: "never appears in the file", reason: "stale" },
  ];
  const result = checkGovernance([{ path: "README.md", text: "Zimi historically ran npm run gate.\nRun npm run gate.\n" }], { staleClaims: [claim], allowed });
  assert.deepEqual(result.violations.map((violation) => violation.line), [2]);
  assert.deepEqual(result.unusedAllowances.map((entry) => entry.contains), ["never appears in the file"]);
});

await test("an allowance narrowed to other claims does not excuse this one", () => {
  const allowed = [{ path: "README.md", contains: "historically ran npm run gate", reason: "history", claims: ["other"] }];
  const result = checkGovernance([{ path: "README.md", text: "Zimi historically ran npm run gate.\n" }], { staleClaims: [claim], allowed });
  assert.equal(result.violations.length, 1);
  assert.equal(result.unusedAllowances.length, 1);
});

await test("a superseded wiki note is history, but a governing file cannot opt out", () => {
  const superseded = "---\nstatus: superseded\n---\nRun npm run gate.\n";
  const config = { staleClaims: [claim], allowed: [] };
  assert.equal(checkGovernance([{ path: "wiki/decisions/ADR-0001 Old.md", text: superseded }], config).violations.length, 0);
  assert.equal(checkGovernance([{ path: ".claude/skills/x/SKILL.md", text: superseded }], config).violations.length, 1);
});

await test("globToRegExp matches exact paths, single and double stars", () => {
  assert.ok(globToRegExp("README.md").test("README.md"));
  assert.ok(!globToRegExp("README.md").test("docs/README.md"));
  assert.ok(globToRegExp("wiki/**/*.md").test("wiki/a.md"));
  assert.ok(globToRegExp("wiki/**/*.md").test("wiki/x/y/a.md"));
  assert.ok(!globToRegExp("scripts/*.ts").test("scripts/lib/a.ts"));
  assert.ok(globToRegExp("scripts/**").test("scripts/fixtures/a/b.md"));
});
