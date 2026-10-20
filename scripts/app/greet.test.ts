import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, type Output } from "../lib/cli.ts";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";
import { greet, main } from "./greet.ts";

const SCRIPT = new URL("./greet.ts", import.meta.url).pathname;

function capture(): Output & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, write: (line) => out.push(line), warn: (line) => err.push(line) };
}

await test("greet", async (t) => {
  await t.test("addresses the name it is given", () => {
    assert.equal(greet("Ada"), "Hello, Ada!");
  });

  await t.test("greets the world when the name is empty", () => {
    assert.equal(greet(""), "Hello, world!");
  });
});

await test("main", async (t) => {
  await t.test("prints a greeting for the one name argument and returns EXIT_OK", () => {
    const output = capture();
    assert.equal(main(["Grace"], output), EXIT_OK);
    assert.deepEqual(output.out, ["Hello, Grace!"]);
    assert.deepEqual(output.err, []);
  });

  await t.test("greets the world when no name is given", () => {
    const output = capture();
    assert.equal(main([], output), EXIT_OK);
    assert.deepEqual(output.out, ["Hello, world!"]);
  });

  await t.test("refuses more than one argument with usage on stderr and EXIT_ERROR", () => {
    const output = capture();
    assert.equal(main(["a", "b"], output), EXIT_ERROR);
    assert.deepEqual(output.out, []);
    assert.deepEqual(output.err, ["usage: greet [name]"]);
  });

  await t.test("prints usage on stdout for --help and returns EXIT_OK", () => {
    const output = capture();
    assert.equal(main(["--help"], output), EXIT_OK);
    assert.deepEqual(output.out, ["usage: greet [name]"]);
    assert.deepEqual(output.err, []);
  });

  await t.test("refuses an argument that looks like a flag instead of greeting it", () => {
    for (const flag of ["-h", "-x", "--root=x"]) {
      const output = capture();
      assert.equal(main([flag], output), EXIT_ERROR, flag);
      assert.deepEqual(output.out, [], flag);
      assert.deepEqual(output.err, ["usage: greet [name]"], flag);
    }
  });

  await t.test("greets the world when the name is only whitespace", () => {
    const output = capture();
    assert.equal(main(["  "], output), EXIT_OK);
    assert.deepEqual(output.out, ["Hello, world!"]);
  });
});

await test("run as a script", async (t) => {
  await t.test("exits 2 with usage on stderr when called with two arguments", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "a", "b"], { env: cleanGitEnv, encoding: "utf8" });
    assert.equal(result.status, EXIT_ERROR);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim(), "usage: greet [name]");
  });

  await t.test("prints the greeting and exits 0 for one name", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "Ada"], { env: cleanGitEnv, encoding: "utf8" });
    assert.equal(result.status, EXIT_OK);
    assert.equal(result.stdout.trim(), "Hello, Ada!");
  });
});
