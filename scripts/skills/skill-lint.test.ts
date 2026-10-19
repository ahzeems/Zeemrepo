import assert from "node:assert/strict";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { createRepo } from "../test-support/repo-fixture.ts";
import { main } from "./skill-lint.ts";
import { provenanceHash } from "./provenance.ts";

const fixtures = join(import.meta.dirname, "../fixtures");

function run(args: string[], cwd?: string): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { output, ...(cwd === undefined ? {} : { cwd }) }), out: out.join("\n"), err: err.join("\n") };
}

await test("the valid fixture library passes", () => {
  const result = run(["--root", join(fixtures, "valid/skill-lint")]);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /skills-lint: 1 skill\(s\) OK/);
});

await test("the broken fixture library fails, listing each problem", () => {
  const result = run(["--root", join(fixtures, "broken/skill-lint")]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /name must equal the directory name/);
  assert.match(result.err, /cites a path that does not exist/);
  assert.match(result.err, /example: references\/format\.md does not match its approved inventory/);
  assert.match(result.err, /example: references\/added\.md is not in the approved inventory/);
});

await test("rejects unknown arguments", () => {
  assert.throws(() => run(["--bogus"]), /usage/i);
});

const SKILL = "---\nname: alpha\ndescription: Use when testing.\n---\n\nBody.\n";
const COMPANION = "# Format\n";
const QUOTE = "S21 baseline approved, go ahead";
const APPROVAL = { record: "docs/approval.md", quote: QUOTE };
type Inventory = { basis: string; files: Record<string, string>; approval: typeof APPROVAL; reason: string };
const inventory = (basis: string, companion = COMPANION): Inventory => ({
  basis, files: { "SKILL.md": provenanceHash(SKILL), "references/format.md": provenanceHash(companion) }, approval: APPROVAL, reason: "Files as installed.",
});
const baseline = (installed: string, inventories: Inventory[] = [inventory("migration-baseline")]): string =>
  JSON.stringify({ skills: [{ name: "alpha", source: "example@0000000", sourceSha256: "a".repeat(64), installedSha256: installed, inventory: inventories }] });

function branchWithBaseline(t: TestContext): ReturnType<typeof createRepo> {
  const repo = createRepo("skill-lint-history-");
  t.after(() => repo.cleanup());
  repo.write("config/skill-standards.json", JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  repo.write(".claude/skills/alpha/SKILL.md", SKILL);
  repo.write(".claude/skills/alpha/references/format.md", COMPANION);
  repo.write("docs/approval.md", `The owner wrote "${QUOTE}" for alpha.\n`);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL)));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  return repo;
}

await test("history: a branch keeping landed provenance passes", (t) => {
  const repo = branchWithBaseline(t);
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_OK, result.err);
});

await test("history: a branch rewriting landed provenance is refused", (t) => {
  const repo = branchWithBaseline(t);
  repo.write(".claude/skills/alpha/SKILL.md", SKILL + "Edited.\n");
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL + "Edited.\n")));
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /landed installedSha256 was rewritten/);
});

await test("history: a companion-only edit without an approved revision is refused", (t) => {
  const repo = branchWithBaseline(t);
  repo.write(".claude/skills/alpha/references/format.md", COMPANION + "Edited.\n");
  repo.commit("edit companion");
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /alpha: references\/format\.md does not match its approved inventory/);
});

await test("history: an added or deleted imported file is refused", (t) => {
  const repo = branchWithBaseline(t);
  repo.git(["rm", "--quiet", ".claude/skills/alpha/references/format.md"]);
  repo.write(".claude/skills/alpha/extra.md", "More instructions.\n");
  repo.commit("swap companions");
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /references\/format\.md is in the approved inventory but missing/);
  assert.match(result.err, /extra\.md is not in the approved inventory/);
});

await test("history: an appended, approved inventory revision passes", (t) => {
  const repo = branchWithBaseline(t);
  const edited = COMPANION + "Edited.\n";
  repo.write(".claude/skills/alpha/references/format.md", edited);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL), [inventory("migration-baseline"), inventory("revision", edited)]));
  repo.commit("approved companion revision");
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_OK, result.err);
});

await test("history: rewriting a landed inventory to cover an edit is refused", (t) => {
  const repo = branchWithBaseline(t);
  const edited = COMPANION + "Edited.\n";
  repo.write(".claude/skills/alpha/references/format.md", edited);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL), [inventory("migration-baseline", edited)]));
  repo.commit("rewrite landed inventory");
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /alpha: landed inventory 1 was changed or removed/);
});

await test("history: no baseline at the base yet is not an error", (t) => {
  const repo = createRepo("skill-lint-first-");
  t.after(() => repo.cleanup());
  repo.write("config/skill-standards.json", JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.write(".claude/skills/alpha/SKILL.md", SKILL);
  repo.write(".claude/skills/alpha/references/format.md", COMPANION);
  repo.write("docs/approval.md", `The owner wrote "${QUOTE}" for alpha.\n`);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL)));
  repo.commit("add baseline");
  assert.equal(run([], repo.dir).code, EXIT_OK);
});

await test("history: a corrupt landed baseline is unverified, never a pass", (t) => {
  const repo = createRepo("skill-lint-corrupt-");
  t.after(() => repo.cleanup());
  repo.write("config/skill-standards.json", JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  repo.write(".claude/skills/alpha/SKILL.md", SKILL);
  repo.write(".claude/skills/import-baseline.json", "{ not json");
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("corrupt base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL)));
  repo.commit("fix baseline");
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /history is unverified/);
});

await test("history: outside a git checkout it says it was not checked", async (t) => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const root = mkdtempSync(join(tmpdir(), "skill-lint-nogit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, ".claude/skills/alpha"), { recursive: true });
  writeFileSync(join(root, "config/skill-standards.json"), JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), SKILL);
  const result = run(["--root", root]);
  assert.equal(result.code, EXIT_OK);
  assert.match(result.out, /not a git checkout; provenance history not checked/);
});
