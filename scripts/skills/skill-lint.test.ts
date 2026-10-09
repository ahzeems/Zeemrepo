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
});

await test("rejects unknown arguments", () => {
  assert.throws(() => run(["--bogus"]), /usage/i);
});

const SKILL = "---\nname: alpha\ndescription: Use when testing.\n---\n\nBody.\n";
const baseline = (installed: string): string => JSON.stringify({ skills: [{ name: "alpha", source: "zimi@9fb36b2", sourceSha256: "a".repeat(64), installedSha256: installed }] });

function branchWithBaseline(t: TestContext): ReturnType<typeof createRepo> {
  const repo = createRepo("skill-lint-history-");
  t.after(() => repo.cleanup());
  repo.write("config/skill-standards.json", JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  repo.write(".claude/skills/alpha/SKILL.md", SKILL);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL)));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  return repo;
}

await test("history: a branch keeping landed provenance passes", (t) => {
  const repo = branchWithBaseline(t);
  assert.equal(run([], repo.dir).code, EXIT_OK);
});

await test("history: a branch rewriting landed provenance is refused", (t) => {
  const repo = branchWithBaseline(t);
  repo.write(".claude/skills/alpha/SKILL.md", SKILL + "Edited.\n");
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL + "Edited.\n")));
  const result = run([], repo.dir);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /landed installedSha256 was rewritten/);
});

await test("history: no baseline at the base yet is not an error", (t) => {
  const repo = createRepo("skill-lint-first-");
  t.after(() => repo.cleanup());
  repo.write("config/skill-standards.json", JSON.stringify({ descriptionLimit: 160, bodyLimit: 6000, allowances: [], userOnly: [] }));
  repo.git(["update-ref", "refs/remotes/origin/main", repo.commit("base")]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  repo.write(".claude/skills/alpha/SKILL.md", SKILL);
  repo.write(".claude/skills/import-baseline.json", baseline(provenanceHash(SKILL)));
  repo.commit("add baseline");
  assert.equal(run([], repo.dir).code, EXIT_OK);
});
