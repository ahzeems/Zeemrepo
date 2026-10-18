import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { main } from "./wiki-lint.ts";

const fixtures = join(import.meta.dirname, "../fixtures");
const identity = { host: "build-box-7", user: "alice" };

function run(args: string[]): { code: number; out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
  return { code: main(args, { output, identity }), out: out.join("\n"), err: err.join("\n") };
}

await test("the valid fixture vault passes", () => {
  const result = run(["--root", join(fixtures, "valid/wiki-lint")]);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /wiki-lint: 4 note\(s\) OK/);
});

await test("the broken fixture vault fails, listing each problem", () => {
  const result = run(["--root", join(fixtures, "broken/wiki-lint")]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /missing section "## Fix"/);
  assert.match(result.err, /tag is not in the allowed list/);
  assert.match(result.err, /agent must be a kebab-case short name/);
  assert.match(result.err, /wiki-lint: \d+ problem\(s\) in 5 note\(s\)/);
});

// The broken vault's lesson and job spec carry every required heading, but only inside an
// HTML comment, a fenced example or at level 3. The valid vault holds the same job spec with
// visible headings, so the refusals below come from the hiding alone.
await test("the CLI refuses required headings hidden in comments, fences or at the wrong level", () => {
  const result = run(["--root", join(fixtures, "broken/wiki-lint")]);
  assert.equal(result.code, EXIT_REFUSED);
  const lesson = "wiki/lessons/Hidden headings are not sections.md";
  for (const section of ["What happened", "Fix", "How to apply"]) {
    assert.match(result.err, new RegExp(`${lesson}: missing section "## ${section}"`));
  }
  const job = "wiki/work/tickets/Section headings job.md";
  for (const section of ["Inputs", "Allowed files", "Forbidden files", "Human checkpoints", "Secrets needed",
    "Tests and evals", "Rollback and recovery", "Evidence", "Wiki and doc updates"]) {
    assert.match(result.err, new RegExp(`${job}: missing job-spec section "## ${section}"`));
  }
  assert.doesNotMatch(result.err, /Section headings (idea|plan)\.md/);
  assert.doesNotMatch(result.err, new RegExp(`${job}: missing section`));
});

await test("rejects unknown arguments", () => {
  assert.throws(() => run(["--bogus"]), /usage/i);
});
