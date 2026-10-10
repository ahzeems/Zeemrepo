import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { baselineHistoryErrors, provenanceErrors, provenanceHash, readBaseline } from "./provenance.ts";

const SKILL = "---\nname: alpha\ndescription: Alpha.\n---\n\nBody.\n";
const QUOTE = "Authorize all (Recommended)";

function repo(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), "provenance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".claude/skills/alpha"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), SKILL);
  writeFileSync(join(root, "docs/approval.md"), `The owner chose "${QUOTE}" for alpha and beta.\n`);
  return root;
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: "alpha", source: "zimi@9fb36b2", sourceSha256: provenanceHash(SKILL), installedSha256: provenanceHash(SKILL), ...overrides };
}

function check(root: string, entries: unknown[]): string[] {
  const errors: string[] = [];
  writeFileSync(join(root, ".claude/skills/import-baseline.json"), JSON.stringify({ skills: entries }));
  const baseline = readBaseline(root, errors);
  return [...errors, ...baseline.flatMap((item) => provenanceErrors(root, item))];
}

await test("provenanceHash ignores a byte-order mark and CRLF line endings", () => {
  assert.equal(provenanceHash("﻿a\r\nb\n"), provenanceHash("a\nb\n"));
  assert.match(provenanceHash("x"), /^[a-f0-9]{64}$/);
});

await test("readBaseline returns nothing when there is no baseline file", (t) => {
  assert.deepEqual(readBaseline(repo(t), []), []);
});

await test("a skill matching its accepted installation passes", (t) => {
  assert.deepEqual(check(repo(t), [entry()]), []);
});

await test("an unrecorded edit to a baseline skill is refused", (t) => {
  const root = repo(t);
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), SKILL + "Edited.\n");
  assert.match(check(root, [entry()]).join("\n"), /does not match its recorded provenance/);
});

await test("an approved revision with a resolvable record passes", (t) => {
  const root = repo(t);
  const revised = SKILL + "Revised.\n";
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revised);
  const revision = { sha256: provenanceHash(revised), approval: { record: "docs/approval.md", quote: QUOTE }, reason: "Migration edits." };
  assert.deepEqual(check(root, [entry({ revisions: [revision] })]), []);
});

await test("an approval record in a folder whose name starts with .. is still inside the repository", (t) => {
  const root = repo(t);
  const revised = SKILL + "Revised.\n";
  mkdirSync(join(root, "..notes"));
  writeFileSync(join(root, "..notes/approval.md"), readFileSync(join(root, "docs/approval.md"), "utf8"));
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revised);
  const revision = { sha256: provenanceHash(revised), approval: { record: "..notes/approval.md", quote: QUOTE }, reason: "Migration edits." };
  assert.deepEqual(check(root, [entry({ revisions: [revision] })]), []);
});

await test("a revision's approval must resolve to a record that holds the quote and names the skill", async (t) => {
  const revised = SKILL + "Revised.\n";
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["missing record", { record: "docs/none.md", quote: QUOTE }, /does not exist/],
    ["record outside the repository", { record: "../outside.md", quote: QUOTE }, /does not exist/],
    ["quote not in record", { record: "docs/approval.md", quote: "Something else entirely" }, /does not contain its approval quote/],
  ];
  for (const [name, approval, expected] of cases) {
    await t.test(name, (t) => {
      const root = repo(t);
      writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revised);
      const revision = { sha256: provenanceHash(revised), approval, reason: "Migration edits." };
      assert.match(check(root, [entry({ revisions: [revision] })]).join("\n"), expected);
    });
  }
  await t.test("record naming the skill only inside a longer word", (t) => {
    const root = repo(t);
    writeFileSync(join(root, "docs/approval.md"), `"${QUOTE}" for alphabet only.\n`);
    writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revised);
    const revision = { sha256: provenanceHash(revised), approval: { record: "docs/approval.md", quote: QUOTE }, reason: "Migration edits." };
    assert.match(check(root, [entry({ revisions: [revision] })]).join("\n"), /does not name the skill/);
  });
});

await test("malformed entries are refused", async (t) => {
  const cases: [string, unknown, RegExp][] = [
    ["missing hashes", { name: "alpha", source: "x" }, /needs sourceSha256 and installedSha256/],
    ["missing source", entry({ source: "" }), /needs a source/],
    ["skill with no directory", entry({ name: "ghost" }), /no installed SKILL\.md/],
    ["revision without approval", entry({ revisions: [{ sha256: "a".repeat(64), reason: "x" }] }), /approval record path and a verbatim quote/],
    ["revision with a bad hash", entry({ revisions: [{ sha256: "nope", reason: "x", approval: { record: "docs/approval.md", quote: QUOTE } }] }), /64-character sha256/],
    ["revisions not a list", entry({ revisions: "x" }), /revisions must be a list/],
  ];
  for (const [name, value, expected] of cases) {
    await t.test(name, (t) => assert.match(check(repo(t), [value]).join("\n"), expected));
  }
  await t.test("corrupt JSON", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/import-baseline.json"), "{");
    const errors: string[] = [];
    readBaseline(root, errors);
    assert.match(errors.join("\n"), /import-baseline\.json is invalid/);
  });
  await t.test("duplicate names", (t) => assert.match(check(repo(t), [entry(), entry()]).join("\n"), /duplicate skill name/));
});

const landed = { skills: [{ name: "alpha", sourceSha256: "a".repeat(64), installedSha256: "b".repeat(64), revisions: [{ sha256: "c".repeat(64) }] }] };

await test("history: appending a revision keeps landed provenance intact", () => {
  const current = { skills: [{ ...landed.skills[0], revisions: [{ sha256: "c".repeat(64) }, { sha256: "d".repeat(64) }] }] };
  assert.deepEqual(baselineHistoryErrors(landed, current), []);
});

await test("history: rewriting or removing landed provenance is refused", () => {
  const base = landed.skills[0] ?? {};
  assert.match(baselineHistoryErrors(landed, { skills: [] }).join(), /landed baseline entry was removed/);
  assert.match(baselineHistoryErrors(landed, { skills: [{ ...base, installedSha256: "e".repeat(64) }] }).join(), /installedSha256 was rewritten/);
  assert.match(baselineHistoryErrors(landed, { skills: [{ ...base, revisions: [] }] }).join(), /revision 1 was changed or removed/);
});

await test("history: a landed source cannot be rewritten", () => {
  const withSource = { skills: [{ ...landed.skills[0], source: "Zimi at 9fb36b2" }] };
  const rewritten = { skills: [{ ...landed.skills[0], source: "somewhere else" }] };
  assert.match(baselineHistoryErrors(withSource, rewritten).join(), /landed source was rewritten/);
});

await test("history: unreadable landed history is unverified, never a pass", () => {
  assert.match(baselineHistoryErrors("not json", landed).join(), /history is unverified/);
});
