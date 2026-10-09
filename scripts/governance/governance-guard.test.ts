import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { main } from "./governance-guard.ts";

const fixtures = join(import.meta.dirname, "../fixtures");
const claim = { id: "self-merge-gate", pattern: "npm\\s+run\\s+gate", supersededBy: "PR-only landing" };

function run(args: string[]): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { output }), out: out.join("\n"), err: err.join("\n") };
}

function repo(t: TestContext, files: Record<string, string>, config: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "governance-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const full = { surfaces: ["**"], exclude: [], staleClaims: [claim], allowed: [], ...config };
  for (const [path, text] of Object.entries({ ...files, "config/governance-alignment.json": JSON.stringify(full) })) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const self = { glob: "config/governance-alignment.json", reason: "the claims themselves" };

await test("the valid fixture is aligned", () => {
  const result = run(["--root", join(fixtures, "valid/governance-guard")]);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /aligned with the operating model/);
});

await test("the broken fixture reports the stale claim with its location", () => {
  const result = run(["--root", join(fixtures, "broken/governance-guard")]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /README\.md:3 \[self-merge-gate\]/);
});

await test("every text file is scanned unless excluded with a reason, at any depth and in dot folders", (t) => {
  const root = repo(t, {
    "scripts/a.ts": "// land with npm run gate\n", "scripts/a.test.ts": "npm run gate\n", ".claude/rules/x/r.md": "npm run gate\n",
    "scripts/deep/node_modules/x.ts": "npm run gate\n", "image.png": "\0npm run gate", "node_modules/pkg/x.md": "npm run gate\n",
  }, { exclude: [self, { glob: "scripts/**/*.test.ts", reason: "test data" }] });
  const result = run(["--root", root]);
  for (const path of ["scripts/a.ts:1", ".claude/rules/x/r.md:1", "scripts/deep/node_modules/x.ts:1"]) assert.match(result.err, new RegExp(path.replace(/\./g, "\\.")));
  assert.doesNotMatch(result.err, /a\.test\.ts|image\.png|node_modules\/pkg/);
  assert.match(result.out + result.err, /2 file\(s\) excluded/);
});

await test("a symbolic link is reported, not skipped", (t) => {
  const root = repo(t, { "README.md": "ok\n" }, { exclude: [self] });
  writeFileSync(join(root, "../outside-governance.md"), "npm run gate\n");
  t.after(() => rmSync(join(root, "../outside-governance.md"), { force: true }));
  symlinkSync(join(root, "../outside-governance.md"), join(root, "linked.md"));
  const result = run(["--root", root]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /linked\.md: symbolic link/);
});

await test("a surface or exclusion matching no file is refused", (t) => {
  const root = repo(t, { "README.md": "ok\n" }, { surfaces: ["**", "CLAUDE.md"], exclude: [self, { glob: "gone/**", reason: "removed" }] });
  const result = run(["--root", root]);
  assert.match(result.err, /surface "CLAUDE\.md" matches no file/);
  assert.match(result.err, /exclusion "gone\/\*\*" matches no file/);
});

await test("superseded wiki notes are listed as history", (t) => {
  const root = repo(t, { "wiki/decisions/ADR-0001 Old.md": "---\nstatus: superseded\nsuperseded_by: \"[[ADR-0002 New]]\"\n---\nnpm run gate\n" }, { exclude: [self] });
  const result = run(["--root", root]);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /1 superseded wiki note\(s\) read as history/);
});

await test("an unused allowance and a bad config are refused", async (t) => {
  await t.test("unused allowance", (t) => {
    const root = repo(t, { "README.md": "ok\n" }, { exclude: [self], allowed: [{ path: "README.md", contains: "no longer here", reason: "old", claims: [claim.id] }] });
    assert.match(run(["--root", root]).err, /allowed wording "no longer here" no longer appears/);
  });
  await t.test("bad config", (t) => {
    const result = run(["--root", repo(t, { "README.md": "ok\n" }, { staleClaims: [] })]);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /at least one claim/);
  });
});

await test("--json, --help and arguments", async (t) => {
  await t.test("json", () => {
    const parsed: unknown = JSON.parse(run(["--json", "--root", join(fixtures, "broken/governance-guard")]).out);
    assert.ok(typeof parsed === "object" && parsed !== null && "aligned" in parsed && parsed.aligned === false);
  });
  await t.test("help", () => {
    const result = run(["--help"]);
    assert.equal(result.code, EXIT_OK);
    assert.match(result.out, /usage/i);
  });
  await t.test("bad arguments", () => assert.throws(() => run(["--bogus"]), /usage/i));
});

await test("the repository itself is aligned", () => {
  const result = run([]);
  assert.equal(result.code, EXIT_OK, result.err);
});
