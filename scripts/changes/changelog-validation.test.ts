import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG } from "../lib/paths.ts";
import { changelogRefusals, entriesByDate } from "./changelog-validation.ts";

const window = { from: "2026-10-08", to: "2026-10-09" };
const text = (body: string): string => `# Changelog\n\n${body}`;
const refusals = (changed: string[], added: string[], changelog: string): string[] => changelogRefusals({ changed, added, changelog, window });

await test("entriesByDate maps entry lines to the date heading they sit under", () => {
  const map = entriesByDate(text("## 2026-10-09\n\n- second\n\n## 2026-10-08\n- first\n* star\nprose\n"));
  assert.deepEqual([...map], [["- second", "2026-10-09"], ["- first", "2026-10-08"], ["* star", "2026-10-08"]]);
});

await test("a branch that changes nothing that matters needs no entry", () => {
  assert.deepEqual(refusals(["wiki/sessions/2026-10-09 Start.md", "package-lock.json", ".gitignore"], [], ""), []);
});

await test("a branch with an entry under a date in its window passes", () => {
  for (const date of ["2026-10-08", "2026-10-09"]) {
    assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], ["- Added a."], text(`## ${date}\n\n- Added a.\n`)), [], date);
  }
});

await test("refusals name what is missing", async (t) => {
  const cases: [string, string[], string[], string, RegExp][] = [
    ["no changelog change", ["scripts/a.ts"], [], "", /changes 1 file\(s\) but adds no entry to CHANGELOG\.md/],
    ["changelog changed without an entry line", ["scripts/a.ts", CHANGELOG], ["prose"], text("prose\n"), /without adding an entry line/],
    ["entry under a date before the branch", ["scripts/a.ts", CHANGELOG], ["- Old."], text("## 2026-10-01\n- Old.\n"), /2026-10-08 and 2026-10-09/],
    ["entry under a future date", ["scripts/a.ts", CHANGELOG], ["- Soon."], text("## 2026-10-30\n- Soon.\n"), /2026-10-08 and 2026-10-09/],
    ["entry under no date heading", ["scripts/a.ts", CHANGELOG], ["- Loose."], text("- Loose.\n"), /2026-10-08 and 2026-10-09/],
    ["git hooks are not exempt", [".githooks/pre-push"], [], "", /adds no entry/],
  ];
  for (const [name, changed, added, changelog, expected] of cases) {
    await t.test(name, () => assert.match(refusals(changed, added, changelog).join("\n"), expected));
  }
});

await test("an entry citing a post-merge fact is refused", () => {
  for (const line of ["- Landed as merge commit abc.", "- Merged in #4.", "- Cherry-picked onto main."]) {
    assert.match(refusals(["scripts/a.ts", CHANGELOG], [line], text(`## 2026-10-09\n${line}\n`)).join(), /post-merge fact/, line);
  }
});

await test("surrounding prose may name the rule it describes", () => {
  assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], ["- Entries cite no post-merge facts.", "Prose mentions a merge commit."], text("## 2026-10-09\n- Entries cite no post-merge facts.\nProse mentions a merge commit.\n")), []);
});
