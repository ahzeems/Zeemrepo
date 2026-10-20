import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { baselineHistoryErrors, provenanceErrors, provenanceHash, readBaseline } from "./provenance.ts";

const SKILL = "---\nname: alpha\ndescription: Alpha.\n---\n\nBody.\n";
const COMPANION = "# Format\n\nKeep it short.\n";
const QUOTE = "Authorize all (Recommended)";
const APPROVAL = { record: "docs/approval.md", quote: QUOTE };

function repo(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), "provenance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".claude/skills/alpha/references"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), SKILL);
  writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), COMPANION);
  writeFileSync(join(root, "docs/approval.md"), `The owner chose "${QUOTE}" for alpha and beta.\n`);
  return root;
}

const files = (overrides: Record<string, string> = {}): Record<string, string> => ({
  "SKILL.md": provenanceHash(SKILL), "references/format.md": provenanceHash(COMPANION), ...overrides,
});

const inventory = (basis: string, fileHashes: unknown, approval: unknown = APPROVAL): Record<string, unknown> => ({
  basis, files: fileHashes, approval, reason: "Hashes of the files as installed.",
});

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "alpha", source: "example@0000000", sourceSha256: provenanceHash(SKILL), installedSha256: provenanceHash(SKILL),
    inventory: [inventory("migration-baseline", files())], ...overrides,
  };
}

function check(root: string, entries: unknown[]): string[] {
  const errors: string[] = [];
  writeFileSync(join(root, ".claude/skills/import-baseline.json"), JSON.stringify({ skills: entries }));
  const baseline = readBaseline(root, errors);
  return [...errors, ...baseline.flatMap((item) => provenanceErrors(root, item))];
}

const revisedSkill = SKILL + "Revised.\n";

// A repository whose SKILL.md carries an approved legacy revision, inventoried at that text.
function revisedEntry(approval: Record<string, string> = APPROVAL): Record<string, unknown> {
  const revision = { sha256: provenanceHash(revisedSkill), approval, reason: "Migration edits." };
  return entry({ revisions: [revision], inventory: [inventory("migration-baseline", files({ "SKILL.md": provenanceHash(revisedSkill) }))] });
}

await test("provenanceHash ignores a byte-order mark and CRLF line endings", () => {
  assert.equal(provenanceHash("﻿a\r\nb\n"), provenanceHash("a\nb\n"));
  assert.match(provenanceHash("x"), /^[a-f0-9]{64}$/);
});

await test("readBaseline returns nothing when there is no baseline file", (t) => {
  assert.deepEqual(readBaseline(repo(t), []), []);
});

await test("a complete approved inventory of entry point and companions passes", (t) => {
  assert.deepEqual(check(repo(t), [entry()]), []);
});

await test("an unrecorded edit to a baseline skill is refused", (t) => {
  const root = repo(t);
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), SKILL + "Edited.\n");
  assert.match(check(root, [entry()]).join("\n"), /alpha: SKILL\.md does not match its approved inventory/);
});

await test("imported companions are covered by the inventory", async (t) => {
  await t.test("a companion-only edit is refused", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), COMPANION + "Edited.\n");
    assert.match(check(root, [entry()]).join("\n"), /alpha: references\/format\.md does not match its approved inventory/);
  });
  await t.test("an added file is refused", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/extra.md"), "More instructions.\n");
    assert.match(check(root, [entry()]).join("\n"), /alpha: extra\.md is not in the approved inventory/);
  });
  await t.test("an added file in a dot folder is refused", (t) => {
    const root = repo(t);
    mkdirSync(join(root, ".claude/skills/alpha/.hidden"));
    writeFileSync(join(root, ".claude/skills/alpha/.hidden/agent.md"), "More instructions.\n");
    assert.match(check(root, [entry()]).join("\n"), /alpha: \.hidden\/agent\.md is not in the approved inventory/);
  });
  await t.test("a deleted companion is refused", (t) => {
    const root = repo(t);
    unlinkSync(join(root, ".claude/skills/alpha/references/format.md"));
    assert.match(check(root, [entry()]).join("\n"), /alpha: references\/format\.md is in the approved inventory but missing/);
  });
});

await test("files the inventory cannot hash never pass", async (t) => {
  await t.test("a symbolic link is refused", (t) => {
    const root = repo(t);
    symlinkSync("/etc/hostname", join(root, ".claude/skills/alpha/linked.md"));
    assert.match(check(root, [entry()]).join("\n"), /alpha: linked\.md is a symbolic link/);
  });
  await t.test("a symbolic link standing in for an inventoried companion is refused", (t) => {
    const root = repo(t);
    const outside = join(root, "docs/format.md");
    writeFileSync(outside, COMPANION);
    unlinkSync(join(root, ".claude/skills/alpha/references/format.md"));
    symlinkSync(outside, join(root, ".claude/skills/alpha/references/format.md"));
    const errors = check(root, [entry()]).join("\n");
    assert.match(errors, /references\/format\.md is a symbolic link/);
    assert.match(errors, /references\/format\.md is in the approved inventory but missing/);
  });
  await t.test("an unreadable file is refused", (t) => {
    const root = repo(t);
    const companion = join(root, ".claude/skills/alpha/references/format.md");
    chmodSync(companion, 0o000);
    assert.match(check(root, [entry()]).join("\n"), /alpha: references\/format\.md cannot be read/);
  });
  await t.test("a file that is not UTF-8 text is refused", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), Buffer.from([0xff, 0xfe, 0x00, 0xc3]));
    assert.match(check(root, [entry()]).join("\n"), /alpha: references\/format\.md is not UTF-8 text/);
  });
});

await test("the first inventory continues the SKILL.md provenance chain", async (t) => {
  await t.test("an inventory whose SKILL.md hash skips the recorded chain is refused", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
    const errors = check(root, [entry({ inventory: [inventory("migration-baseline", files({ "SKILL.md": provenanceHash(revisedSkill) }))] })]);
    assert.match(errors.join("\n"), /alpha: the first inventory must record SKILL\.md at its recorded provenance hash/);
  });
  await t.test("a legacy revision appended after the inventory is refused, pointing to inventory revisions", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
    const revision = { sha256: provenanceHash(revisedSkill), approval: APPROVAL, reason: "Late legacy edit." };
    const later = inventory("revision", files({ "SKILL.md": provenanceHash(revisedSkill) }));
    const errors = check(root, [entry({ revisions: [revision], inventory: [inventory("migration-baseline", files()), later] })]).join("\n");
    assert.match(errors, /alpha: the first inventory must record SKILL\.md at its recorded provenance hash/);
    assert.match(errors, /record new changes as inventory revisions, not legacy revisions/);
  });
  await t.test("an approved legacy revision followed by a matching inventory passes", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
    assert.deepEqual(check(root, [revisedEntry()]), []);
  });
});

await test("an authorized later inventory revision passes, and needs its own approval", async (t) => {
  const edited = COMPANION + "Edited with approval.\n";
  const later = (approval: unknown): Record<string, unknown> => entry({
    inventory: [inventory("migration-baseline", files()), inventory("revision", files({ "references/format.md": provenanceHash(edited) }), approval)],
  });
  await t.test("approved", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), edited);
    assert.deepEqual(check(root, [later(APPROVAL)]), []);
  });
  await t.test("approval quote missing from the record", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), edited);
    assert.match(check(root, [later({ record: "docs/approval.md", quote: "Something else entirely" })]).join("\n"), /alpha: inventory 2 approval record does not contain its approval quote/);
  });
  await t.test("no approval", (t) => {
    const root = repo(t);
    writeFileSync(join(root, ".claude/skills/alpha/references/format.md"), edited);
    assert.match(check(root, [later(null)]).join("\n"), /alpha: inventory 2 needs an approval record path and a verbatim quote/);
  });
});

await test("an approval record in a folder whose name starts with .. is still inside the repository", (t) => {
  const root = repo(t);
  mkdirSync(join(root, "..notes"));
  writeFileSync(join(root, "..notes/approval.md"), readFileSync(join(root, "docs/approval.md"), "utf8"));
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
  assert.deepEqual(check(root, [revisedEntry({ record: "..notes/approval.md", quote: QUOTE })]), []);
});

await test("a revision's approval must resolve to a record that holds the quote and names the skill", async (t) => {
  const cases: [string, Record<string, string>, RegExp][] = [
    ["missing record", { record: "docs/none.md", quote: QUOTE }, /does not exist/],
    ["record outside the repository", { record: "../outside.md", quote: QUOTE }, /does not exist/],
    ["quote not in record", { record: "docs/approval.md", quote: "Something else entirely" }, /does not contain its approval quote/],
  ];
  for (const [name, approval, expected] of cases) {
    await t.test(name, (t) => {
      const root = repo(t);
      writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
      assert.match(check(root, [revisedEntry(approval)]).join("\n"), expected);
    });
  }
  await t.test("record naming the skill only inside a longer word", (t) => {
    const root = repo(t);
    writeFileSync(join(root, "docs/approval.md"), `"${QUOTE}" for alphabet only.\n`);
    writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), revisedSkill);
    assert.match(check(root, [revisedEntry()]).join("\n"), /does not name the skill/);
  });
});

await test("malformed entries are refused", async (t) => {
  const cases: [string, unknown, RegExp][] = [
    ["missing hashes", { name: "alpha", source: "x" }, /needs sourceSha256 and installedSha256/],
    ["missing source", entry({ source: "" }), /needs a source/],
    ["skill with no directory", entry({ name: "ghost" }), /no installed SKILL\.md/],
    ["revision without approval", entry({ revisions: [{ sha256: "a".repeat(64), reason: "x" }] }), /approval record path and a verbatim quote/],
    ["revision with a bad hash", entry({ revisions: [{ sha256: "nope", reason: "x", approval: APPROVAL }] }), /64-character sha256/],
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

await test("a malformed inventory is refused, never a pass", async (t) => {
  const baselineOf = (fileHashes: Record<string, string>): unknown => entry({ inventory: [inventory("migration-baseline", fileHashes)] });
  const cases: [string, unknown, RegExp][] = [
    ["no inventory", entry({ inventory: undefined }), /alpha: baseline entry needs an inventory of its installed files/],
    ["empty inventory", entry({ inventory: [] }), /alpha: baseline entry needs an inventory of its installed files/],
    ["inventory not a list", entry({ inventory: "x" }), /alpha: baseline entry needs an inventory of its installed files/],
    ["inventory revision not an object", entry({ inventory: ["x"] }), /alpha: inventory 1 must be an object/],
    ["files not an object", entry({ inventory: [inventory("migration-baseline", "x")] }), /alpha: inventory 1 needs files listing SKILL\.md/],
    ["files without SKILL.md", baselineOf({ "references/format.md": provenanceHash(COMPANION) }), /alpha: inventory 1 needs files listing SKILL\.md/],
    ["bad file hash", baselineOf(files({ "references/format.md": "nope" })), /alpha: inventory 1 file references\/format\.md needs a 64-character sha256/],
    ["parent path", baselineOf(files({ "../beta/SKILL.md": "a".repeat(64) })), /alpha: inventory 1 file \.\.\/beta\/SKILL\.md is not a safe relative path/],
    ["absolute path", baselineOf(files({ "/etc/hostname": "a".repeat(64) })), /inventory 1 file \/etc\/hostname is not a safe relative path/],
    ["dot segment", baselineOf(files({ "./SKILL.md": "a".repeat(64) })), /inventory 1 file \.\/SKILL\.md is not a safe relative path/],
    ["empty segment", baselineOf(files({ "references//format.md": "a".repeat(64) })), /is not a safe relative path/],
    ["backslash", baselineOf(files({ "references\\format.md": "a".repeat(64) })), /is not a safe relative path/],
    ["unknown basis", entry({ inventory: [inventory("upstream", files())] }), /alpha: inventory 1 basis must be migration-baseline or import/],
    ["first basis a revision", entry({ inventory: [inventory("revision", files())] }), /alpha: inventory 1 basis must be migration-baseline or import/],
    ["later basis a baseline", entry({ inventory: [inventory("migration-baseline", files()), inventory("migration-baseline", files())] }), /alpha: inventory 2 basis must be revision/],
    ["missing reason", entry({ inventory: [{ ...inventory("migration-baseline", files()), reason: " " }] }), /alpha: inventory 1 needs a reason/],
  ];
  for (const [name, value, expected] of cases) {
    await t.test(name, (t) => assert.match(check(repo(t), [value]).join("\n"), expected));
  }
  await t.test("a later import is a first inventory too", (t) => {
    assert.deepEqual(check(repo(t), [entry({ inventory: [inventory("import", files())] })]), []);
  });
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
  const withSource = { skills: [{ ...landed.skills[0], source: "example at 0000000" }] };
  const rewritten = { skills: [{ ...landed.skills[0], source: "somewhere else" }] };
  assert.match(baselineHistoryErrors(withSource, rewritten).join(), /landed source was rewritten/);
});

await test("history: a landed inventory is append-only", () => {
  const first = inventory("migration-baseline", { "SKILL.md": "c".repeat(64) });
  const withInventory = { skills: [{ ...landed.skills[0], inventory: [first] }] };
  const appended = { skills: [{ ...landed.skills[0], inventory: [first, inventory("revision", { "SKILL.md": "d".repeat(64) })] }] };
  assert.deepEqual(baselineHistoryErrors(withInventory, appended), []);
  assert.deepEqual(baselineHistoryErrors(landed, withInventory), []);
  const rewritten = { skills: [{ ...landed.skills[0], inventory: [inventory("migration-baseline", { "SKILL.md": "e".repeat(64) })] }] };
  assert.match(baselineHistoryErrors(withInventory, rewritten).join(), /alpha: landed inventory 1 was changed or removed/);
  assert.match(baselineHistoryErrors(withInventory, landed).join(), /alpha: landed inventory 1 was changed or removed/);
});

await test("history: unreadable landed history is unverified, never a pass", () => {
  assert.match(baselineHistoryErrors("not json", landed).join(), /history is unverified/);
});
