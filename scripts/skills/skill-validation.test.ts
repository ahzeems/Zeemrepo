import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { provenanceHash } from "./provenance.ts";
import { validateSkills } from "./skill-validation.ts";

type Standards = { descriptionLimit: number; bodyLimit: number; allowances: unknown[]; userOnly: string[] };
const standards: Standards = { descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] };
const skill = (name: string, extra = "", body = "Do the thing.\n"): string => `---\nname: ${name}\ndescription: Use when testing.${extra}\n---\n\n${body}`;

function library(t: TestContext, skills: Record<string, string>, config: Partial<Standards> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "skill-validation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "config"));
  writeFileSync(join(root, "config/skill-standards.json"), JSON.stringify({ ...standards, ...config }));
  for (const [path, text] of Object.entries(skills)) {
    mkdirSync(join(root, ".claude/skills", path, ".."), { recursive: true });
    writeFileSync(join(root, ".claude/skills", path), text);
  }
  return root;
}

const errorsOf = (root: string): string => validateSkills(root).errors.join("\n");

await test("a well-formed skill passes", (t) => {
  const result = validateSkills(library(t, { "alpha/SKILL.md": skill("alpha") }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.skillCount, 1);
});

await test("structure", async (t) => {
  const cases: [string, Record<string, string>, RegExp][] = [
    ["name differs from directory", { "alpha/SKILL.md": skill("beta") }, /name must equal the directory name, found beta/],
    ["no SKILL.md", { "alpha/notes.md": "x" }, /alpha: no SKILL\.md/],
    ["no frontmatter", { "alpha/SKILL.md": "Just prose.\n" }, /alpha: missing YAML frontmatter/],
    ["broken frontmatter", { "alpha/SKILL.md": "---\nname: alpha\n" }, /alpha: unterminated/],
    ["empty description", { "alpha/SKILL.md": "---\nname: alpha\ndescription: \"\"\n---\n" }, /a description is required/],
    ["over-long description", { "alpha/SKILL.md": skill("alpha", " " + "x".repeat(160)) }, /description is \d+ characters, over the 160 standard/],
    ["over-long body", { "alpha/SKILL.md": skill("alpha", "", "x".repeat(6001)) }, /body is 6001 characters, over the 6000 budget/],
    ["unknown frontmatter key", { "alpha/SKILL.md": skill("alpha", "\nallowed-tools: Bash") }, /frontmatter carries allowed-tools/],
  ];
  for (const [name, skills, expected] of cases) await t.test(name, (t) => assert.match(errorsOf(library(t, skills)), expected));
});

await test("citations", async (t) => {
  await t.test("a cited path that does not exist is reported", (t) => {
    assert.match(errorsOf(library(t, { "alpha/SKILL.md": skill("alpha", "", "See [x](references/gone.md).\n") })), /cites a path that does not exist: references\/gone\.md/);
  });
  await t.test("a percent-encoded path resolves", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "See [x](references/a%20b.md).\n"), "alpha/references/a b.md": "# A\n" });
    assert.equal(errorsOf(root), "");
  });
  await t.test("a heading fragment must exist in the target", (t) => {
    const root = library(t, {
      "alpha/SKILL.md": skill("alpha", "", "See [x](../beta/SKILL.md#steps) and [y](../beta/SKILL.md#missing).\n"),
      "beta/SKILL.md": skill("beta", "", "## Steps\n"),
    });
    assert.match(errorsOf(root), /cites a heading that does not exist: \.\.\/beta\/SKILL\.md#missing/);
    assert.doesNotMatch(errorsOf(root), /#steps/);
  });
  await t.test("a malformed encoding is reported", (t) => {
    assert.match(errorsOf(library(t, { "alpha/SKILL.md": skill("alpha", "", "See [x](a%E0%A4%A.md).\n") })), /malformed path/);
  });
  await t.test("external links and code examples are not checked", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "[x](https://example.com) `[y](gone.md)`\n") });
    assert.equal(errorsOf(root), "");
  });
});

await test("user-only skills and model invocation must agree both ways", async (t) => {
  await t.test("a listed user-only skill with the flag passes", (t) => {
    const root = library(t, { "bro/SKILL.md": skill("bro", "\ndisable-model-invocation: true") }, { userOnly: ["bro"] });
    assert.equal(errorsOf(root), "");
  });
  await t.test("a listed user-only skill without the flag is refused", (t) => {
    assert.match(errorsOf(library(t, { "bro/SKILL.md": skill("bro") }, { userOnly: ["bro"] })), /bro: user-only skill needs disable-model-invocation: true/);
  });
  await t.test("the flag on an unlisted skill is refused, so the list stays the single source", (t) => {
    assert.match(errorsOf(library(t, { "tdd/SKILL.md": skill("tdd", "\ndisable-model-invocation: true") })), /tdd: disable-model-invocation is set but the skill is not in userOnly/);
  });
  await t.test("a user-only name with no installed skill is a configuration error", (t) => {
    assert.match(errorsOf(library(t, { "alpha/SKILL.md": skill("alpha") }, { userOnly: ["ghost"] })), /ghost: user-only skill is not installed/);
  });
});

await test("no em dashes anywhere in a skill's files", (t) => {
  const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "One — two.\n"), "alpha/references/r.md": "ok\nthree — four\n" });
  const errors = errorsOf(root);
  assert.match(errors, /alpha\/SKILL\.md: line 6: em dash/);
  assert.match(errors, /alpha\/references\/r\.md: line 2: em dash/);
});

await test("files for other harnesses are refused", (t) => {
  const root = library(t, { "alpha/SKILL.md": skill("alpha"), "alpha/agents/openai.yaml": "policy: {}\n" });
  assert.match(errorsOf(root), /alpha\/agents\/openai\.yaml: Codex and OpenCode files are not used/);
});

await test("allowances excuse one rule for one skill, and stale ones are reported", async (t) => {
  const reason = "kept long on purpose for a measured reason";
  await t.test("excuses the named rule", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "x".repeat(6001)) }, { allowances: [{ skill: "alpha", rule: "bodyLimit", reason }] });
    assert.equal(errorsOf(root), "");
  });
  await t.test("does not excuse a different rule or skill", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "x".repeat(6001)) }, { allowances: [{ skill: "alpha", rule: "descriptionLimit", reason }] });
    assert.match(errorsOf(root), /over the 6000 budget/);
    assert.match(errorsOf(root), /allowance for alpha \(descriptionLimit\) matches nothing/);
  });
});

await test("baseline skills are exempt from size limits but not from structure, citations or em dashes", (t) => {
  const text = skill("alpha", "", "x".repeat(6001) + "\n[gone](gone.md)\n");
  const root = library(t, { "alpha/SKILL.md": text });
  writeFileSync(join(root, ".claude/skills/import-baseline.json"), JSON.stringify({
    skills: [{ name: "alpha", source: "zimi@9fb36b2", sourceSha256: provenanceHash(text), installedSha256: provenanceHash(text) }],
  }));
  const errors = errorsOf(root);
  assert.doesNotMatch(errors, /budget/);
  assert.match(errors, /cites a path that does not exist/);
});

await test("configuration problems stop validation with one clear error", (t) => {
  const root = library(t, {});
  rmSync(join(root, "config/skill-standards.json"));
  assert.deepEqual(validateSkills(root).errors, ["config/skill-standards.json is missing"]);
});

await test("the repository's own skill library passes its standards", () => {
  assert.deepEqual(validateSkills(join(import.meta.dirname, "../..")).errors, []);
});
