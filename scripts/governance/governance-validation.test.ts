import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGovernance, configProblems, globToRegExp, normalizeText, readConfig } from "./governance-validation.ts";

const claim = { id: "self-merge-gate", pattern: "npm\\s+run\\s+gate", supersededBy: "PR-only landing (zimi-audit rule 5)" };
const exclude = [{ glob: "CHANGELOG.md", reason: "history" }];
const valid = { surfaces: ["**"], exclude, staleClaims: [claim], allowed: [] };
const check = (text: string, allowed: unknown[] = [], path = "README.md") => checkGovernance([{ path, text }], { staleClaims: [claim], allowed: readConfig({ ...valid, allowed }).allowed });

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
    ["exclude without a reason", { ...valid, exclude: [{ glob: "x/**" }] }, /exclude\[0\] needs a glob and a reason/],
    ["allowance without reason", { ...valid, allowed: [{ path: "README.md", contains: "npm run gate here", claims: [claim.id] }] }, /needs a non-empty path, contains, reason and claims/],
    ["allowance without claims", { ...valid, allowed: [{ path: "README.md", contains: "npm run gate here", reason: "x" }] }, /needs a non-empty path, contains, reason and claims/],
    ["allowance too short", { ...valid, allowed: [{ path: "README.md", contains: "gate", reason: "historical", claims: [claim.id] }] }, /under 8 characters/],
    ["allowance naming an unknown claim", { ...valid, allowed: [{ path: "README.md", contains: "npm run gate here", reason: "x", claims: ["nope"] }] }, /unknown claim nope/],
  ];
  for (const [name, config, expected] of cases) await t.test(name, () => assert.match(configProblems(config).join("\n"), expected));
});

await test("finds a stale claim with its line, however it is written", async (t) => {
  const cases: [string, string, number][] = [
    ["plain", "ok\nRun NPM RUN GATE to land.\n", 2],
    ["wrapped across lines", "To land, run npm run\ngate.\n", 1],
    ["double spaces", "Run npm  run   gate.\n", 1],
    ["zero-width characters", "Run npm​ run gate.\n", 1],
    ["full-width letters", "Run ｎｐｍ run gate.\n", 1],
    ["after a byte-order mark", "﻿Run npm run gate.\n", 1],
  ];
  for (const [name, text, line] of cases) {
    await t.test(name, () => assert.deepEqual(check(text).violations.map((violation) => [violation.claim, violation.line]), [["self-merge-gate", line]]));
  }
});

await test("normalizeText folds look-alikes and curly quotes", () => {
  assert.equal(normalizeText("today’s “heading”‍"), "today's \"heading\"");
});

await test("an allowance excuses only the quoted span, for the named claims", async (t) => {
  const history = { path: "README.md", contains: "Zimi historically ran npm run gate", reason: "history", claims: [claim.id] };
  await t.test("excuses the quoted sentence", () => {
    const result = check("Zimi historically ran npm run gate.\n", [history]);
    assert.deepEqual(result.violations, []);
    assert.deepEqual(result.unusedAllowances, []);
  });
  await t.test("does not launder a new claim on the same line", () => {
    assert.equal(check("Zimi historically ran npm run gate; now run npm run gate too.\n", [history]).violations.length, 1);
  });
  await t.test("does not excuse another file", () => {
    assert.equal(check("Zimi historically ran npm run gate.\n", [history], "docs/other.md").violations.length, 1);
  });
  await t.test("a narrowed allowance does not excuse another claim", () => {
    const result = check("Zimi historically ran npm run gate.\n", [{ ...history, claims: ["other-claim"] }]);
    assert.equal(result.violations.length, 1);
    assert.equal(result.unusedAllowances.length, 1);
  });
  await t.test("every matching allowance is marked used, and an unmatched one is reported", () => {
    const twin = { ...history, contains: "historically ran npm run gate", reason: "history twin" };
    const stale = { ...history, contains: "never appears in the file" };
    const result = check("Zimi historically ran npm run gate.\n", [history, twin, stale]);
    assert.deepEqual(result.unusedAllowances.map((entry) => entry.contains), ["never appears in the file"]);
  });
});

await test("a superseded wiki note is reported as history only when it names its replacement", () => {
  const config = { staleClaims: [claim], allowed: [] };
  const replaced = "---\nstatus: superseded\nsuperseded_by: \"[[ADR-0002 New]]\"\n---\nRun npm run gate.\n";
  const result = checkGovernance([{ path: "wiki/decisions/ADR-0001 Old.md", text: replaced }], config);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.history, ["wiki/decisions/ADR-0001 Old.md"]);
  const noReplacement = "---\nstatus: superseded\n---\nRun npm run gate.\n";
  assert.equal(checkGovernance([{ path: "wiki/decisions/ADR-0001 Old.md", text: noReplacement }], config).violations.length, 1);
  assert.equal(checkGovernance([{ path: ".claude/skills/x/SKILL.md", text: replaced }], config).violations.length, 1);
  const duplicated = "---\nstatus: active\nstatus: superseded\nsuperseded_by: \"[[ADR-0002 New]]\"\n---\nRun npm run gate.\n";
  assert.equal(checkGovernance([{ path: "wiki/decisions/ADR-0001 Old.md", text: duplicated }], config).violations.length, 1,
    "frontmatter wiki:lint rejects (a duplicate key) cannot declare the note history");
});

await test("globToRegExp matches exact paths, stars, odd characters and newlines", () => {
  assert.ok(globToRegExp("README.md").test("README.md"));
  assert.ok(!globToRegExp("README.md").test("docs/README.md"));
  assert.ok(globToRegExp("wiki/**/*.md").test("wiki/a.md"));
  assert.ok(globToRegExp("wiki/**/*.md").test("wiki/x/y/a.md"));
  assert.ok(!globToRegExp("scripts/*.ts").test("scripts/lib/a.ts"));
  assert.ok(globToRegExp("scripts/**").test("scripts/fixtures/a/b.md"));
  assert.ok(globToRegExp("wiki/**/*.md").test("wiki/a\nb/x.md"));
  assert.ok(!globToRegExp("a?.md").test("a.md"));
  assert.ok(globToRegExp("a?.md").test("a?.md"));
});

await test("line numbers and allowances stay aligned around astral and case-changing characters", () => {
  const emoji = "\u{1F600}".repeat(20);
  assert.deepEqual(check(`${emoji}\nok\nRun npm run gate.\n`).violations.map((violation) => violation.line), [3]);
  const allowed = [{ path: "README.md", contains: "Zimi historically ran npm run gate", reason: "history", claims: [claim.id] }];
  const result = check("\u0130\u0130\u0130\u0130\u0130 intro. Zimi historically ran npm run gate.\n", allowed);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.unusedAllowances, []);
});
