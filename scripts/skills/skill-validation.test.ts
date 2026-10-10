import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  await t.test("the flag must be a boolean, so a string cannot slip past the list", (t) => {
    const errors = errorsOf(library(t, { "alpha/SKILL.md": skill("alpha", '\ndisable-model-invocation: "true"') }));
    assert.match(errors, /alpha: disable-model-invocation must be true or false/);
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

await test("nothing in a skill escapes the file checks", async (t) => {
  await t.test("symbolic links are reported", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha") });
    symlinkSync("/etc/hostname", join(root, ".claude/skills/alpha/linked.md"));
    assert.match(errorsOf(root), /alpha\/linked\.md: symbolic link/);
  });
  await t.test("node_modules and dot folders inside a skill are checked too", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha"), "alpha/node_modules/x.md": "a \u2014 b\n", "alpha/.hidden/openai.yaml": "x\n" });
    const errors = errorsOf(root);
    assert.match(errors, /alpha\/node_modules\/x\.md: line 1: em dash/);
    assert.match(errors, /alpha\/\.hidden\/openai\.yaml: Codex and OpenCode files/);
  });
  await t.test("a skill that fails to load still has its files checked", (t) => {
    const root = library(t, { "alpha/notes.md": "a \u2014 b\n" });
    assert.match(errorsOf(root), /alpha\/notes\.md: line 1: em dash/);
  });
  await t.test("only known files may sit directly in .claude/skills, and they are checked", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha"), "stray.md": "x\n", "THIRD-PARTY-NOTICES.md": "a \u2014 b\n" });
    const errors = errorsOf(root);
    assert.match(errors, /stray\.md: unexpected file in \.claude\/skills/);
    assert.match(errors, /THIRD-PARTY-NOTICES\.md: line 1: em dash/);
  });
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
  await t.test("does not excuse a different skill", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "x".repeat(6001)), "beta/SKILL.md": skill("beta") }, { allowances: [{ skill: "beta", rule: "bodyLimit", reason }] });
    assert.match(errorsOf(root), /alpha: body is 6001 characters/);
    assert.match(errorsOf(root), /allowance for beta \(bodyLimit\) matches nothing/);
  });
  await t.test("does not excuse a different rule", (t) => {
    const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "x".repeat(6001)) }, { allowances: [{ skill: "alpha", rule: "descriptionLimit", reason }] });
    assert.match(errorsOf(root), /over the 6000 budget/);
    assert.match(errorsOf(root), /allowance for alpha \(descriptionLimit\) matches nothing/);
  });
});

await test("baseline skills are exempt from size and key limits but not from structure, citations or em dashes", (t) => {
  const text = skill("alpha", " " + "y".repeat(200) + "\nlicense: MIT", "x".repeat(6001) + "\n[gone](gone.md)\nOne \u2014 two.\n");
  const root = library(t, { "alpha/SKILL.md": text });
  writeFileSync(join(root, ".claude/skills/import-baseline.json"), JSON.stringify({
    skills: [{ name: "alpha", source: "example@0000000", sourceSha256: provenanceHash(text), installedSha256: provenanceHash(text) }],
  }));
  const errors = errorsOf(root);
  assert.doesNotMatch(errors, /budget|standard|frontmatter carries/);
  assert.match(errors, /cites a path that does not exist/);
  assert.match(errors, /alpha\/SKILL\.md: line \d+: em dash/);
});

await test("a citation of a directory with a heading fragment is reported", (t) => {
  const root = library(t, { "alpha/SKILL.md": skill("alpha", "", "See [x](refs.md#top).\n"), "alpha/refs.md/inner.md": "# Top\n" });
  assert.match(errorsOf(root), /heading target is not a file: refs\.md#top/);
});

await test("a badly shaped baseline entry is reported through validation", (t) => {
  const root = library(t, { "alpha/SKILL.md": skill("alpha") });
  writeFileSync(join(root, ".claude/skills/import-baseline.json"), JSON.stringify({ skills: [{ name: "alpha", source: "x" }] }));
  assert.match(errorsOf(root), /alpha: baseline entry needs sourceSha256 and installedSha256/);
});

await test("configuration problems stop validation with one clear error", (t) => {
  const root = library(t, {});
  rmSync(join(root, "config/skill-standards.json"));
  assert.deepEqual(validateSkills(root).errors, ["config/skill-standards.json is missing"]);
});

await test("the repository's own skill library passes its standards", () => {
  assert.deepEqual(validateSkills(join(import.meta.dirname, "../..")).errors, []);
});
