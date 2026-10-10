import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG } from "../lib/paths.ts";
import { memoryRefusals, type RecordChange } from "./repo-memory-validation.ts";

const PATH = "wiki/work/projects/Zimi migration.md";
const before = { status: "backlog", next_action: "Start.", evidence: ["VERIFIED: old result"] };
const record = (after: Record<string, unknown> | null, was: Record<string, unknown> | null = before, afterText = "", beforeText = ""): RecordChange =>
  ({ path: PATH, before: was, after, beforeText, afterText });
const good = record({ ...before, status: "in-progress", evidence: ["VERIFIED: old result", "VERIFIED: npm run check passes, 0 failures"] });
const refuse = (changed: string[], records: RecordChange[], docLines: string[] = []): string => memoryRefusals({ changed, records, addedOperatingDocLines: docLines }).join("\n");

await test("a branch with only exempt or changelog changes needs no record", () => {
  assert.equal(refuse([CHANGELOG, "package-lock.json", "wiki/sessions/2026-10-09 A.md"], []), "");
});

await test("a record with new labelled evidence and a changed status passes", () => {
  assert.equal(refuse(["wiki/lessons/A.md", PATH], [good]), "");
});

await test("a changed next_action alone counts as the status change", () => {
  const nextOnly = record({ ...before, next_action: "Review.", evidence: ["VERIFIED: old result", "VERIFIED: npm test passes"] });
  assert.equal(refuse(["wiki/lessons/A.md", PATH], [nextOnly]), "");
});

await test("a new record counts all its evidence and fields as new", () => {
  assert.equal(refuse(["wiki/lessons/A.md", PATH], [record({ status: "in-progress", evidence: ["VERIFIED: npm test passes"] }, null)]), "");
});

await test("refusals say what the record is missing", async (t) => {
  const cases: [string, RecordChange[], RegExp][] = [
    ["no work record", [], /updates no work record under wiki\/work\//],
    ["evidence unchanged", [record({ ...before, status: "in-progress" })], /gains no VERIFIED: or OWNER DECISION: evidence/],
    ["unspaced label", [record({ ...before, status: "done", evidence: [...before.evidence, "VERIFIED:npm test passes"] })], /gains no VERIFIED: or OWNER DECISION/],
    ["inference only", [record({ ...before, status: "done", evidence: [...before.evidence, "INFERRED: probably fine"] })], /gains no VERIFIED: or OWNER DECISION/],
    ["status unchanged", [record({ ...before, evidence: [...before.evidence, "VERIFIED: npm test passes"] })], /status and next action are unchanged/],
    ["deleted record", [record(null)], /updates no work record/],
  ];
  for (const [name, records, expected] of cases) await t.test(name, () => assert.match(refuse(["wiki/lessons/A.md", PATH], records), expected));
});

await test("evidence that says the check did not happen is not evidence", () => {
  for (const item of ["VERIFIED: not run", "VERIFIED: never run", "VERIFIED: could not be checked", "VERIFIED: nothing verified", "VERIFIED: pending",
    "VERIFIED: TBD", "VERIFIED: n/a", "VERIFIED: skipped", "VERIFIED: will run later", "VERIFIED: todo", "VERIFIED: cannot be verified"]) {
    const after = { ...before, status: "done", evidence: [...before.evidence, item] };
    assert.match(refuse(["wiki/lessons/A.md", PATH], [record(after)]), /gains no VERIFIED/, item);
  }
});

await test("an unrelated clause does not void a real result", () => {
  const after = { ...before, status: "done", evidence: [...before.evidence, "VERIFIED: npm run check passes; the CI workflow is not configured yet"] };
  assert.equal(refuse(["wiki/lessons/A.md", PATH], [record(after)]), "");
});

await test("evidence and the status change must be on the same record", () => {
  const other = { ...good, path: "wiki/work/tickets/Other.md", after: { ...before, status: "in-progress" } };
  const evidenceOnly = record({ ...before, evidence: [...before.evidence, "VERIFIED: npm test passes"] });
  assert.match(refuse(["wiki/lessons/A.md", PATH, other.path], [evidenceOnly, other]), /same work record/);
});

await test("a workflow-critical change needs an operating document or a reasoned exemption", async (t) => {
  await t.test("refused without either", () => {
    assert.match(refuse([".githooks/pre-push", PATH], [good]), /workflow-critical files \(\.githooks\/pre-push\)/);
  });
  await t.test("passes when an operating document gains content", () => {
    assert.equal(refuse(["scripts/lib/git.ts", "wiki/runbooks/Verify.md", PATH], [good], ["New step."]), "");
  });
  await t.test("touching a document without adding content does not count", () => {
    assert.match(refuse(["scripts/lib/git.ts", "wiki/runbooks/Verify.md", PATH], [good], ["", "   "]), /workflow-critical/);
  });
  await t.test("passes with a newly written [no-doc-change: reason] in the record", () => {
    const hatch = { ...good, afterText: "[no-doc-change: internal refactor with no behaviour change]" };
    assert.equal(refuse(["scripts/lib/git.ts", PATH], [hatch]), "");
  });
  for (const [name, afterText, beforeText] of [
    ["an empty reason", "[no-doc-change: ]", ""],
    ["a trivial reason", "[no-doc-change: x]", ""],
    ["a hatch quoted in inline code", "Write `[no-doc-change: internal refactor reason]`.", ""],
    ["a hatch inside a fenced block", "```\n[no-doc-change: internal refactor reason]\n```", ""],
    ["a hatch that was already there", "[no-doc-change: internal refactor reason]", "[no-doc-change: internal refactor reason]"],
  ] as const) {
    await t.test(`does not accept ${name}`, () => assert.match(refuse(["scripts/lib/git.ts", PATH], [{ ...good, afterText, beforeText }]), /workflow-critical/));
  }
  await t.test("the changelog is not an operating document", () => {
    assert.match(refuse(["scripts/lib/git.ts", CHANGELOG, PATH], [good]), /workflow-critical/);
  });
});
