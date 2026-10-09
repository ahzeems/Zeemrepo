import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG } from "../lib/paths.ts";
import { changelogRefusals, headingDates } from "./changelog-validation.ts";

const window = { from: "2026-10-08", to: "2026-10-09" };
// Line numbers are 1-based positions in the changelog as it stands on the branch.
const refusals = (changed: string[], changelog: string, addedLines: number[]): string[] => changelogRefusals({ changed, changelog, addedLines, window });

await test("headingDates gives each line the date heading it sits under", () => {
  const dates = headingDates("# Changelog\n## 2026-10-09\n- a\n```\n## 2026-01-01\n- fenced\n```\n- b\n## 2026-99-99\n- impossible\n# Other\n- c\n");
  // Lines: title, heading, entry, fence, fenced heading, fenced entry, fence, entry,
  // impossible heading, its entry, other heading, its entry, trailing empty line.
  assert.deepEqual(dates.slice(1), [undefined, "2026-10-09", "2026-10-09", undefined, undefined, undefined, undefined, "2026-10-09", undefined, undefined, undefined, undefined, undefined]);
});

await test("a branch that changes nothing that matters needs no entry", () => {
  assert.deepEqual(refusals(["wiki/sessions/2026-10-09 Start.md", "package-lock.json", ".gitignore"], "", []), []);
});

await test("an entry added under a date in the window passes", () => {
  for (const date of ["2026-10-08", "2026-10-09"]) {
    assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], `# Changelog\n\n## ${date}\n\n- Added a.\n`, [5]), [], date);
  }
});

await test("entries are judged by position, not text", async (t) => {
  const changelog = "# Changelog\n## 2026-10-09\n- Update docs.\n## 2026-01-01\n- Update docs.\n";
  await t.test("a duplicate added under an old heading does not borrow the in-window copy's date", () => {
    assert.match(refusals(["scripts/a.ts", CHANGELOG], changelog, [5]).join(), /between 2026-10-08 and 2026-10-09/);
  });
  await t.test("an honest entry is not refused because an identical old line exists", () => {
    assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], changelog, [3]), []);
  });
});

await test("refusals name what is missing", async (t) => {
  const cases: [string, string[], string, number[], RegExp][] = [
    ["no changelog change", ["scripts/a.ts"], "", [], /changes 1 file\(s\) but adds no entry to CHANGELOG\.md/],
    ["no entry line added", ["scripts/a.ts", CHANGELOG], "# Changelog\n## 2026-10-09\nprose\n", [3], /without adding an entry line/],
    ["entry under an old date", ["scripts/a.ts", CHANGELOG], "## 2026-10-01\n- Old.\n", [2], /2026-10-08 and 2026-10-09/],
    ["entry under a future date", ["scripts/a.ts", CHANGELOG], "## 2026-10-30\n- Soon.\n", [2], /2026-10-08 and 2026-10-09/],
    ["entry under an impossible date", ["scripts/a.ts", CHANGELOG], "## 2026-10-99\n- Odd.\n", [2], /2026-10-08 and 2026-10-09/],
    ["entry inside a code fence", ["scripts/a.ts", CHANGELOG], "## 2026-10-09\n```\n- Fenced.\n```\n", [3], /without adding an entry line/],
    ["git hooks are not exempt", [".githooks/pre-push"], "", [], /adds no entry/],
  ];
  for (const [name, changed, changelog, added, expected] of cases) await t.test(name, () => assert.match(refusals(changed, changelog, added).join("\n"), expected));
});

await test("an entry citing a post-merge fact is refused; surrounding prose may name the rule", () => {
  for (const line of ["- Landed as merge commit abc.", "- Merged in #4.", "- Cherry-picked onto main."]) {
    assert.match(refusals(["scripts/a.ts", CHANGELOG], `## 2026-10-09\n${line}\n`, [2]).join(), /post-merge fact/, line);
  }
  assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], "## 2026-10-09\n- Entries cite no post-merge facts.\nProse mentions a merge commit.\n", [2, 3]), []);
});
