import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG } from "../lib/paths.ts";
import { changelogRefusals, type FragmentChange } from "./changelog-validation.ts";

const window = { from: "2026-10-08", to: "2026-10-09" };
const added = (path: string, content: string): FragmentChange => ({ path, status: "added", content });
const fragment = (content = "- Added a.\n", name = "2026-10-09-add-a"): FragmentChange => added(`changelog/${name}.md`, content);
// A branch on a base that already holds a fragment, unless baseHasFragment says otherwise.
const refusals = (changed: string[], fragments: FragmentChange[], baseHasFragment = true): string[] =>
  changelogRefusals({ changed: [...changed, ...fragments.map((entry) => entry.path)], fragments, baseHasFragment, window });

await test("a branch that changes nothing that matters needs no fragment", () => {
  assert.deepEqual(refusals(["wiki/sessions/2026-10-09 Start.md", "package-lock.json", ".gitignore"], []), []);
});

await test("a new fragment dated in the window with an entry passes", () => {
  for (const date of ["2026-10-08", "2026-10-09"]) {
    assert.deepEqual(refusals(["scripts/a.ts"], [fragment("- Added a.\n", `${date}-add-a`)]), [], date);
  }
  assert.deepEqual(refusals(["scripts/a.ts"], [fragment("Some prose.\n\n* Added a.\n- And b.\n")]), [], "prose and * entries are fine beside one");
});

await test("a fragment alone records itself", () => {
  assert.deepEqual(refusals([], [fragment()]), []);
});

await test("refusals name what is wrong", async (t) => {
  const cases: [string, string[], FragmentChange[], RegExp][] = [
    ["no fragment", ["scripts/a.ts"], [], /changes 1 file\(s\) but adds no changelog fragment/],
    ["an empty fragment", ["scripts/a.ts"], [fragment("")], /has no "- " entry/],
    ["a fragment with only prose", ["scripts/a.ts"], [fragment("Added a.\n")], /has no "- " entry/],
    ["an entry only inside a code fence", ["scripts/a.ts"], [fragment("```\n- fenced\n```\n")], /has no "- " entry/],
    ["dated before the branch started", ["scripts/a.ts"], [fragment("- a\n", "2026-10-07-old")], /dated 2026-10-07, outside 2026-10-08 to 2026-10-09/],
    ["dated after today", ["scripts/a.ts"], [fragment("- a\n", "2026-10-10-soon")], /dated 2026-10-10, outside/],
    ["an impossible date", ["scripts/a.ts"], [fragment("- a\n", "2026-02-30-odd")], /2026-02-30 is not a real date/],
    ["a name that is not a fragment name", ["scripts/a.ts"], [added("changelog/notes.md", "- a\n")], /changelog\/notes\.md is not named changelog\/<YYYY-MM-DD>-<slug>\.md/],
    ["a nested fragment", ["scripts/a.ts"], [added("changelog/sub/2026-10-09-a.md", "- a\n")], /changelog\/sub\/2026-10-09-a\.md is not named/],
    ["git hooks are not exempt", [".githooks/pre-push"], [], /adds no changelog fragment/],
  ];
  for (const [name, changed, fragments, expected] of cases) await t.test(name, () => assert.match(refusals(changed, fragments).join("\n"), expected));
});

await test("a misnamed fragment neither records the change nor counts as one to record", () => {
  const withCode = refusals(["scripts/a.ts"], [added("changelog/notes.md", "- a\n")]);
  assert.equal(withCode.length, 2, withCode.join("\n"));
  assert.match(withCode.join("\n"), /adds no changelog fragment/);
  const alone = refusals([], [added("changelog/notes.md", "- a\n")]);
  assert.equal(alone.length, 1, alone.join("\n"));
  assert.match(alone[0] ?? "", /is not named/);
});

await test("every bad fragment is refused, even beside a good one", () => {
  const result = refusals(["scripts/a.ts"], [fragment(), fragment("", "2026-10-09-empty")]);
  assert.equal(result.length, 1);
  assert.match(result[0] ?? "", /2026-10-09-empty\.md has no "- " entry/);
});

await test("fragments already on the base are history: changing or deleting one is refused", () => {
  for (const status of ["modified", "deleted"] as const) {
    const old: FragmentChange = { path: "changelog/2026-10-01-old.md", status, content: status === "deleted" ? "" : "- Rewritten.\n" };
    assert.match(refusals(["scripts/a.ts"], [fragment(), old]).join(), /changelog\/2026-10-01-old\.md is already on main; add a new fragment instead/, status);
  }
});

await test("an entry citing a post-merge fact is refused; prose in a fragment may name the rule", () => {
  for (const line of ["- Landed as merge commit abc.", "- Merged in #4.", "- Cherry-picked onto main."]) {
    assert.match(refusals(["scripts/a.ts"], [fragment(`${line}\n`)]).join(), /post-merge fact/, line);
  }
  assert.deepEqual(refusals(["scripts/a.ts"], [fragment("Prose mentions a merge commit.\n- Entries cite no post-merge facts.\n")]), []);
});

await test("once the base holds a fragment, any change to CHANGELOG.md is refused", () => {
  assert.match(refusals([CHANGELOG], []).join(), /CHANGELOG\.md is history/);
  const both = refusals(["scripts/a.ts", CHANGELOG], [fragment()]);
  assert.equal(both.length, 1, both.join("\n"));
  assert.match(both[0] ?? "", /CHANGELOG\.md is history/);
});

await test("a branch that records itself only in CHANGELOG.md is told to move the entry into a fragment", () => {
  for (const baseHasFragment of [true, false]) {
    assert.match(refusals(["scripts/a.ts", CHANGELOG], [], baseHasFragment).join(), /move it into a new fragment changelog\/<YYYY-MM-DD>-<slug>\.md/, String(baseHasFragment));
  }
});

await test("while the base holds no fragment, the switching branch may also change CHANGELOG.md", () => {
  assert.deepEqual(refusals(["scripts/a.ts", CHANGELOG], [fragment()], false), []);
});
