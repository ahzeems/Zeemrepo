import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { main } from "./governance-guard.ts";

const fixtures = join(import.meta.dirname, "../fixtures");
const claim = { id: "self-merge-gate", pattern: "npm run gate", supersededBy: "PR-only landing" };

function run(args: string[]): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { output }), out: out.join("\n"), err: err.join("\n") };
}

function repo(t: TestContext, files: Record<string, string>, config: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "governance-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries({ ...files, "config/governance-alignment.json": JSON.stringify(config) })) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

await test("the valid fixture is aligned", () => {
  const result = run(["--root", join(fixtures, "valid/governance-guard")]);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /2 declared surface\(s\) aligned/);
});

await test("the broken fixture reports the stale claim with its location", () => {
  const result = run(["--root", join(fixtures, "broken/governance-guard")]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /README\.md:4 \[self-merge-gate\]/);
});

await test("code and config are surfaces too, and excluded paths are skipped", (t) => {
  const root = repo(t, { "scripts/a.ts": "// land with npm run gate\n", "scripts/a.test.ts": "npm run gate\n", "package.json": '{"scripts":{"x":"npm run gate"}}' },
    { surfaces: ["scripts/**/*.ts", "package.json"], exclude: ["scripts/**/*.test.ts"], staleClaims: [claim], allowed: [] });
  const result = run(["--root", root]);
  assert.match(result.err, /scripts\/a\.ts:1/);
  assert.match(result.err, /package\.json:1/);
  assert.doesNotMatch(result.err, /a\.test\.ts/);
});

await test("a surface matching no file is refused, so the check looks where it claims", (t) => {
  const root = repo(t, { "README.md": "ok\n" }, { surfaces: ["README.md", "CLAUDE.md"], exclude: [], staleClaims: [claim], allowed: [] });
  assert.match(run(["--root", root]).err, /surface "CLAUDE\.md" matches no file/);
});

await test("an unused allowance and a bad config are refused", async (t) => {
  await t.test("unused allowance", (t) => {
    const root = repo(t, { "README.md": "ok\n" }, { surfaces: ["README.md"], exclude: [], staleClaims: [claim], allowed: [{ path: "README.md", contains: "no longer here", reason: "old" }] });
    assert.match(run(["--root", root]).err, /allowed wording "no longer here" no longer appears/);
  });
  await t.test("bad config", (t) => {
    const root = repo(t, { "README.md": "ok\n" }, { surfaces: ["README.md"], exclude: [], staleClaims: [], allowed: [] });
    const result = run(["--root", root]);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /at least one claim/);
  });
});

await test("symbolic links are not followed", (t) => {
  const root = repo(t, { "README.md": "ok\n" }, { surfaces: ["**/*.md"], exclude: [], staleClaims: [claim], allowed: [] });
  writeFileSync(join(root, "../outside-governance.md"), "npm run gate\n");
  symlinkSync(join(root, "../outside-governance.md"), join(root, "linked.md"));
  t.after(() => rmSync(join(root, "../outside-governance.md"), { force: true }));
  assert.equal(run(["--root", root]).code, EXIT_OK);
});

await test("--json and arguments", async (t) => {
  await t.test("json", () => {
    const parsed: unknown = JSON.parse(run(["--json", "--root", join(fixtures, "broken/governance-guard")]).out);
    assert.ok(typeof parsed === "object" && parsed !== null && "aligned" in parsed && parsed.aligned === false);
  });
  await t.test("bad arguments", () => assert.throws(() => run(["--bogus"]), /usage/i));
});

await test("the repository itself is aligned", () => {
  const result = run([]);
  assert.equal(result.code, EXIT_OK, result.err);
});
