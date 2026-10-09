import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";
import { MAX_DEPTH, MAX_FILE_LINES, MAX_FUNCTION_LINES } from "../../eslint.config.ts";

// Lints through the real eslint.config.ts with real config resolution (file globs,
// ignores, the test-file override, the TypeScript parser), so narrowing a glob or
// deleting the override makes these fail, not just changing a number.
const SIZE_RULES = new Set(["max-lines", "max-lines-per-function", "max-depth"]);
const eslint = new ESLint({
  cwd: import.meta.dirname + "/../..",
  flags: ["unstable_native_nodejs_ts_config"],
});

// Typed linting only parses paths inside the tsconfig project, so the source text is
// linted as two real files: this test (test-file rules) and eslint.config.ts (source
// rules). A parse error fails loudly; filtering it out would make "no violations" pass.
async function sizeViolations(source: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  assert.ok(result, "ESLint returned no result");
  const fatal = result.messages.filter((message) => message.fatal === true);
  assert.deepEqual(fatal.map((message) => message.message), [], `${filePath} did not parse`);
  return result.messages.flatMap((message) =>
    message.ruleId !== null && SIZE_RULES.has(message.ruleId) ? [message.ruleId] : []);
}

const SOURCE_PATH = "eslint.config.ts";
const TEST_PATH = "scripts/toolchain/eslint-limits.test.ts";

function functionWithBodyLines(count: number): string {
  const body = Array.from({ length: count }, (_, index) => `  const v${index} = ${index};`);
  return ["export function sample(): void {", ...body, "}", ""].join("\n");
}

function nestedIfs(depth: number): string {
  const open = Array.from({ length: depth }, () => "if (x) {").join(" ");
  return `export function sample(x: boolean): void { ${open} ${"}".repeat(depth)} }\n`;
}

function fileOfLines(count: number): string {
  return Array.from({ length: count }, (_, index) => `export const v${index} = ${index};`).join("\n") + "\n";
}

await test("eslint size limits", async (t) => {
  await t.test("accepts a source function at the line ceiling", async () => {
    assert.deepEqual(await sizeViolations(functionWithBodyLines(MAX_FUNCTION_LINES - 2), SOURCE_PATH), []);
  });

  await t.test("rejects a source function one line over the ceiling", async () => {
    assert.deepEqual(await sizeViolations(functionWithBodyLines(MAX_FUNCTION_LINES - 1), SOURCE_PATH), ["max-lines-per-function"]);
  });

  await t.test("lets a test file hold a long function", async () => {
    assert.deepEqual(await sizeViolations(functionWithBodyLines(MAX_FUNCTION_LINES * 2), TEST_PATH), []);
  });

  await t.test("still applies the file ceiling to test files", async () => {
    assert.deepEqual(await sizeViolations(fileOfLines(MAX_FILE_LINES + 1), TEST_PATH), ["max-lines"]);
  });

  await t.test("rejects a source file over the line ceiling", async () => {
    assert.deepEqual(await sizeViolations(fileOfLines(MAX_FILE_LINES + 1), SOURCE_PATH), ["max-lines"]);
  });

  await t.test("accepts the maximum nesting depth and rejects one more", async () => {
    assert.deepEqual(await sizeViolations(nestedIfs(MAX_DEPTH), SOURCE_PATH), []);
    assert.deepEqual(await sizeViolations(nestedIfs(MAX_DEPTH + 1), SOURCE_PATH), ["max-depth"]);
  });
});
