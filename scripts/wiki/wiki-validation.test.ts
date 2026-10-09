import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WIKI_SCHEMA } from "../lib/paths.ts";
import { createRepo } from "../test-support/repo-fixture.ts";
import { validateWiki } from "./wiki-validation.ts";

const identity = { host: "build-box-7", user: "alice" };
const validNote = `---
type: reference
title: Example note
summary: A small reference for validator behavior.
tags: [kind/convention]
created: 2026-09-20
updated: 2026-09-20
agent: claude-code
status: active
related: []
---

Recorded facts.
`;

function fixture(context: TestContext, content = validNote): string {
  const root = mkdtempSync(join(tmpdir(), "wiki-validation-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "wiki/reference"), { recursive: true });
  mkdirSync(join(root, WIKI_SCHEMA, ".."), { recursive: true });
  copyFileSync(join(import.meta.dirname, "../..", WIKI_SCHEMA), join(root, WIKI_SCHEMA));
  writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n\n- [[Example note]]\n");
  writeFileSync(join(root, "wiki/reference/Example note.md"), content);
  return root;
}

function errorsOf(root: string): string {
  return validateWiki(root, { identity }).errors.join("\n");
}

for (const ending of ["\n", "\r\n"]) {
  await test(`accepts valid ${ending === "\n" ? "LF" : "CRLF"} notes`, (context) => {
    const result = validateWiki(fixture(context, validNote.replaceAll("\n", ending)), { identity });
    assert.deepEqual(result.errors, []);
    assert.equal(result.noteCount, 1);
    assert.ok(result.tagCount > 10);
  });
}

const invalidCases: [string, string, RegExp][] = [
  ["missing frontmatter", "Recorded facts.\n", /missing YAML frontmatter/],
  ["malformed closing delimiter", validNote.replace("\n---\n", "\n---oops\n"), /unterminated/],
  ["duplicate keys", validNote.replace("status: active", "status: draft\nstatus: active"), /invalid YAML/],
  ["invalid YAML", validNote.replace("related: []", "related: ["), /invalid YAML/],
  ["scalar related", validNote.replace("related: []", "related: irrelevant"), /related/],
  ["non-link related", validNote.replace("related: []", 'related: ["Example note"]'), /related/],
  ["invalid calendar date", validNote.replace("updated: 2026-09-20", "updated: 2026-99-99"), /real YYYY-MM-DD/],
  ["invalid day in month", validNote.replace("updated: 2026-09-20", "updated: 2026-02-30"), /real YYYY-MM-DD/],
  ["updated before created", validNote.replace("updated: 2026-09-20", "updated: 2026-09-19"), /earlier than created/],
  ["numeric summary", validNote.replace("A small reference for validator behavior.", "123"), /non-string/],
  ["too long summary", validNote.replace("A small reference for validator behavior.", "x".repeat(200)), /under 200/],
  ["empty tags", validNote.replace("[kind/convention]", "[]"), /nonempty/],
  ["unknown tag", validNote.replace("kind/convention", "kind/unknown"), /allowed list/],
  ["prototype name as type", validNote.replace("type: reference", "type: constructor"), /unknown note type/],
  ["title mismatch", validNote.replace("title: Example note", "title: Other"), /title does not match/],
  ["memory status", validNote.replace("status: active", "status: done"), /status must be one of active/],
  ["missing replacement", validNote.replace("status: active", "status: superseded"), /superseded_by/],
  ["broken link", validNote + "\n[[Missing note]]\n", /broken wikilink/],
  ["unrecognised agent", validNote.replace("agent: claude-code", "agent: claude"), /allowed agent/],
  ["retired agent", validNote.replace("agent: claude-code", "agent: codex"), /allowed agent/],
  ["non-kebab agent", validNote.replace("agent: claude-code", "agent: Claude Code"), /kebab-case/],
];
// Each case must fail for exactly the reason it names: a regex over all errors would also
// pass a note that failed for some other reason.
for (const [name, content, error] of invalidCases) {
  await test(`rejects ${name}, and only for that`, (context) => {
    const errors = validateWiki(fixture(context, content), { identity }).errors;
    assert.equal(errors.length, 1, errors.join("\n"));
    assert.match(errors[0] ?? "", error);
  });
}

await test("rejects a note in the wrong folder, and only for that", (context) => {
  const runbook = validNote.replace("type: reference", "type: runbook")
    .replace("Recorded facts.", "## When to use\n\n## Prerequisites\n\n## Steps\n\n## Verify\n");
  const errors = validateWiki(fixture(context, runbook), { identity }).errors;
  assert.deepEqual(errors, ["wiki/reference/Example note.md: note belongs in wiki/runbooks/"]);
});

await test("rejects a lesson missing its sections, naming each one", (context) => {
  const root = fixture(context);
  mkdirSync(join(root, "wiki/lessons"));
  rmSync(join(root, "wiki/reference/Example note.md"));
  writeFileSync(join(root, "wiki/lessons/Example note.md"), validNote.replace("type: reference", "type: lesson").replace("Recorded facts.", "## Fix\n"));
  const errors = validateWiki(root, { identity }).errors;
  assert.deepEqual(errors, [
    'wiki/lessons/Example note.md: missing section "## What happened"',
    'wiki/lessons/Example note.md: missing section "## How to apply"',
  ]);
});

await test("rejects misnamed decisions and sessions", (context) => {
  const root = fixture(context);
  for (const [folder, type, title, error] of [["decisions", "decision", "Use Node", /ADR-NNNN/], ["sessions", "session", "Setup", /YYYY-MM-DD/]] as const) {
    mkdirSync(join(root, "wiki", folder), { recursive: true });
    const body = validNote.replace("type: reference", `type: ${type}`).replace("title: Example note", `title: ${title}`);
    writeFileSync(join(root, "wiki", folder, `${title}.md`), body);
    assert.match(errorsOf(root), error);
  }
});

await test("rejects file names Obsidian or Windows cannot handle", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "wiki/reference/Bad # name.md"), validNote.replace("title: Example note", "title: Bad # name"));
  assert.match(errorsOf(root), /file name contains a character/);
});

await test("rejects a symbolic link in the vault", (context) => {
  const root = fixture(context);
  symlinkSync(join(root, "wiki/reference/Example note.md"), join(root, "wiki/reference/Linked.md"));
  assert.match(errorsOf(root), /symbolic links are not supported/);
});

await test("links inside code and comments are examples, not links or index entries", async (t) => {
  await t.test("a broken link in code is not reported", (t) => {
    const note = validNote + "\n`[[Inline example]]`\n\n```markdown\n- [[Fenced example]]\n```\n\n<!-- [[Commented]] -->\n";
    assert.equal(errorsOf(fixture(t, note)), "");
  });
  await t.test("a link in Home's code does not index a note", (t) => {
    const root = fixture(t);
    writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n\n```\n[[Example note]]\n```\n");
    assert.match(errorsOf(root), /not indexed/);
  });
});

await test("a symlinked Home is reported and never read", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "elsewhere.md"), "# Wiki\n\n- [[Example note]]\n");
  rmSync(join(root, "wiki/Home.md"));
  symlinkSync(join(root, "elsewhere.md"), join(root, "wiki/Home.md"));
  const errors = errorsOf(root);
  assert.match(errors, /Home\.md: symbolic links are not supported/);
  assert.match(errors, /not indexed/);
});

await test("a secret staged and then removed from the working copy is still found", (t) => {
  const repo = createRepo("wiki-staged-");
  t.after(() => repo.cleanup());
  repo.write("wiki/Home.md", "# Wiki\n\n- [[Example note]]\n");
  repo.write("wiki/reference/Example note.md", validNote);
  repo.write(WIKI_SCHEMA, readFileSync(join(import.meta.dirname, "../..", WIKI_SCHEMA), "utf8"));
  repo.commit("base");
  const credential = "ghp_" + "z".repeat(30);
  repo.write("docs/plan.md", `token ${credential}\n`);
  repo.git(["add", "docs/plan.md"]);
  repo.write("docs/plan.md", "clean\n");
  const errors = validateWiki(repo.dir, { identity }).errors;
  assert.deepEqual(errors, ["docs/plan.md: line 1 of the staged copy: possible GitHub token"]);
});

await test("reports a missing schema as missing", (context) => {
  const root = fixture(context);
  rmSync(join(root, WIKI_SCHEMA));
  assert.match(errorsOf(root), /note schema is missing/);
});

await test("an unknown type does not skip the index check", (context) => {
  const root = fixture(context, validNote.replace("type: reference", "type: nonsense"));
  writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n");
  const errors = errorsOf(root);
  assert.match(errors, /unknown note type/);
  assert.match(errors, /not indexed/);
});

await test("rejects a missing Home and a schema without allowlists", (context) => {
  const root = fixture(context);
  rmSync(join(root, "wiki/Home.md"));
  writeFileSync(join(root, WIKI_SCHEMA), "# no markers\n");
  const errors = errorsOf(root);
  for (const expected of [/missing index/, /no allowed tags/, /no allowed agents/]) assert.match(errors, expected);
});

await test("rejects notes absent from Home", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "wiki/Home.md"), "# Empty index\n");
  assert.match(errorsOf(root), /not indexed/);
});

await test("rejects a broken link in Home", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n\n- [[Example note]]\n- [[Gone]]\n");
  assert.match(errorsOf(root), /broken index wikilink/);
});

await test("rejects duplicate titles across folders", (context) => {
  const root = fixture(context);
  mkdirSync(join(root, "wiki/lessons"));
  writeFileSync(join(root, "wiki/lessons/Example note.md"), validNote);
  assert.match(errorsOf(root), /duplicate note title/);
});

await test("accepts escaped quoted YAML strings", (context) => {
  const note = validNote.replace("A small reference for validator behavior.", JSON.stringify('A "quoted" fact.'));
  assert.deepEqual(validateWiki(fixture(context, note), { identity }).errors, []);
});

await test("templates are checked as templates, not as notes", async (t) => {
  const template = (type: string): string => `---\ntype: ${type}\ntitle: "{{title}}"\ncreated: "{{date}}"\n---\n`;
  const withTemplate = (t: TestContext, name: string, body: string): string => {
    const root = fixture(t);
    mkdirSync(join(root, "wiki/templates"));
    writeFileSync(join(root, "wiki/templates", name), body);
    return root;
  };
  await t.test("a known template with a matching type passes without note rules", (t) => {
    assert.equal(errorsOf(withTemplate(t, "lesson.md", template("lesson"))), "");
    assert.equal(errorsOf(withTemplate(t, "build-ticket.md", template("ticket"))), "");
  });
  await t.test("a real note cannot hide in templates/", (t) => {
    assert.match(errorsOf(withTemplate(t, "Example lesson.md", template("lesson"))), /unknown template/);
  });
  await t.test("a template must declare its own type", (t) => {
    assert.match(errorsOf(withTemplate(t, "lesson.md", template("decision"))), /template lesson declares type decision/);
    assert.match(errorsOf(withTemplate(t, "lesson.md", template("nonsense"))), /unknown note type/);
  });
  await t.test("a template's frontmatter must parse", (t) => {
    assert.match(errorsOf(withTemplate(t, "lesson.md", "---\ncreated: {{date}}\n---\n")), /must parse/);
  });
});

await test("everything in wiki/ is a note, a Bases file or a template", async (t) => {
  await t.test("rejects other file types, including upper-case extensions", (t) => {
    const root = fixture(t);
    writeFileSync(join(root, "wiki/reference/Upper.MD"), validNote);
    writeFileSync(join(root, "wiki/reference/board.canvas"), "{}");
    const errors = errorsOf(root);
    assert.match(errors, /Upper\.MD: unrecognised file/);
    assert.match(errors, /board\.canvas: unrecognised file/);
  });
  await t.test("does not let a dist or dot folder hide a note", (t) => {
    const root = fixture(t);
    mkdirSync(join(root, "wiki/reference/dist"));
    mkdirSync(join(root, "wiki/.hidden"));
    writeFileSync(join(root, "wiki/reference/dist/Hidden.md"), "no frontmatter\n");
    writeFileSync(join(root, "wiki/.hidden/Other.md"), "no frontmatter\n");
    const errors = errorsOf(root);
    assert.match(errors, /reference\/dist\/Hidden\.md: missing YAML frontmatter/);
    assert.match(errors, /\.hidden\/Other\.md: missing YAML frontmatter/);
  });
  await t.test("ignores Obsidian's own settings folder", (t) => {
    const root = fixture(t);
    mkdirSync(join(root, "wiki/.obsidian"));
    writeFileSync(join(root, "wiki/.obsidian/app.json"), "{}");
    assert.equal(errorsOf(root), "");
  });
  await t.test("rejects dot files", (t) => {
    const root = fixture(t);
    writeFileSync(join(root, "wiki/reference/.draft.md"), validNote);
    assert.match(errorsOf(root), /dot files are not notes/);
  });
});

await test("scans the constitution, skills, docs, code and wiki without echoing the secret", (context) => {
  const root = fixture(context);
  const credential = "ghp_" + "x".repeat(30);
  mkdirSync(join(root, "docs"));
  mkdirSync(join(root, "scripts/lib"), { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), credential);
  writeFileSync(join(root, ".claude/skills/method.md"), credential);
  writeFileSync(join(root, "docs/plan.md"), credential);
  writeFileSync(join(root, "scripts/lib/x.ts"), `export const value = "${credential}";\n`);
  writeFileSync(join(root, "wiki/reference/Example note.md"), validNote + credential);
  const errors = validateWiki(root, { identity }).errors;
  assert.equal(errors.filter((error) => error.includes("GitHub token")).length, 5);
  assert.ok(!errors.join("\n").includes(credential));
});

await test("flags this machine's identity through the injected identity, not the real machine", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "README.md"), "Built on build-box-7 by alice.\n");
  const errors = errorsOf(root);
  assert.match(errors, /README\.md: line 1: possible this machine's hostname/);
  assert.match(errors, /README\.md: line 1: possible this machine's username/);
});

await test("accepts native Obsidian block lists for tags and related links", (context) => {
  const note = validNote.replace("tags: [kind/convention]", "tags:\n  - kind/convention")
    .replace("related: []", 'related:\n  - "[[Example note]]"');
  assert.deepEqual(validateWiki(fixture(context, note), { identity }).errors, []);
});

await test("accepts native file, folder, alias, and heading wikilinks", (context) => {
  const note = validNote + "\n[[Example note.md]] [[reference/Example note]] [[Example note#Details|Details]]\n## Details\n";
  assert.deepEqual(validateWiki(fixture(context, note), { identity }).errors, []);
});

await test("validates a Bases file without treating it as a memory note", (context) => {
  const root = fixture(context, validNote + "\n![[Work tracking.base]]\n");
  writeFileSync(join(root, "wiki/Work tracking.base"), "views:\n  - type: table\n    name: All work\n");
  assert.equal(errorsOf(root), "");
  writeFileSync(join(root, "wiki/Work tracking.base"), "views: []\n");
  assert.match(errorsOf(root), /Bases YAML or missing views/);
});

await test("retrieves memory through a linked index while keeping Home small", (context) => {
  const root = fixture(context);
  writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n\n[[Memory index]]\n");
  writeFileSync(join(root, "wiki/reference/Memory index.md"),
    validNote.replace("title: Example note", "title: Memory index") + "\n[[Example note]]\n");
  assert.equal(errorsOf(root), "");
  writeFileSync(join(root, "wiki/Home.md"), "# Wiki\n");
  assert.match(errorsOf(root), /not indexed/);
});

await test("work notes need no index entry but are checked as work", (context) => {
  const root = fixture(context);
  mkdirSync(join(root, "wiki/work/ideas"), { recursive: true });
  const idea = validNote.replace("type: reference", "type: idea").replace("title: Example note", "title: An idea")
    .replace("status: active", "status: backlog\nowner: human\npriority: P2\nnext_action: Ask the owner.")
    .replace("Recorded facts.", "## Problem\n\n## Desired outcome\n\n## Next step\n");
  writeFileSync(join(root, "wiki/work/ideas/An idea.md"), idea);
  assert.equal(errorsOf(root), "");
  writeFileSync(join(root, "wiki/work/ideas/An idea.md"), idea.replace("priority: P2", "priority: high"));
  assert.match(errorsOf(root), /priority must be P0/);
});

await test("sees property edits on the next read without rewriting notes", (context) => {
  const root = fixture(context);
  const path = join(root, "wiki/reference/Example note.md");
  const edited = validNote.replace("related: []", 'related:\n  - "[[Missing note]]"');
  writeFileSync(path, edited);
  assert.match(errorsOf(root), /broken wikilink/);
  assert.equal(readFileSync(path, "utf8"), edited);
});

await test("the repository's own wiki passes", () => {
  // Machine identifiers are switched off (no host; a service account), so the result does
  // not depend on the machine running it; npm run wiki:lint checks the real identity.
  const root = join(import.meta.dirname, "../..");
  assert.deepEqual(validateWiki(root, { identity: { host: "", user: "node" } }).errors, []);
});
