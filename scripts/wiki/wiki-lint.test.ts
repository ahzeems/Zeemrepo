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
  assert.match(result.out, /wiki-lint: 1 note\(s\) OK/);
});

await test("the broken fixture vault fails, listing each problem", () => {
  const result = run(["--root", join(fixtures, "broken/wiki-lint")]);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /missing section "## Fix"/);
  assert.match(result.err, /tag is not in the allowed list/);
  assert.match(result.err, /wiki-lint: \d+ problem\(s\) in 1 note\(s\)/);
});

await test("rejects unknown arguments", () => {
  assert.throws(() => run(["--bogus"]), /usage/i);
});
