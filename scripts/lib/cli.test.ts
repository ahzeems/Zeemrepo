import assert from "node:assert/strict";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, report, runCli, type Output } from "./cli.ts";

function capture(): Output & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, write: (line) => out.push(line), warn: (line) => err.push(line) };
}

await test("report", async (t) => {
  await t.test("prints the success line and returns EXIT_OK when nothing is refused", () => {
    const output = capture();
    assert.equal(report([], "all good", output), EXIT_OK);
    assert.deepEqual(output.out, ["all good"]);
    assert.deepEqual(output.err, []);
  });

  await t.test("prints every refusal to stderr and returns EXIT_REFUSED", () => {
    const output = capture();
    assert.equal(report(["first", "second"], "all good", output), EXIT_REFUSED);
    assert.deepEqual(output.out, []);
    assert.deepEqual(output.err, ["first", "second"]);
  });
});

await test("runCli", async (t) => {
  const saved = process.exitCode;
  t.after(() => { process.exitCode = saved; });

  await t.test("sets the exit code the main function returns", async () => {
    await runCli(() => EXIT_REFUSED, capture());
    assert.equal(process.exitCode, EXIT_REFUSED);
  });

  await t.test("awaits an async main", async () => {
    await runCli(() => Promise.resolve(EXIT_OK), capture());
    assert.equal(process.exitCode, EXIT_OK);
  });

  await t.test("turns a thrown error into EXIT_ERROR, including its cause", async () => {
    const output = capture();
    await runCli(() => { throw new Error("boom", { cause: new Error("root cause") }); }, output);
    assert.equal(process.exitCode, EXIT_ERROR);
    assert.deepEqual(output.err, ["error: boom", "  caused by: root cause"]);
  });

  await t.test("reports a rejected promise", async () => {
    const output = capture();
    await runCli(() => Promise.reject(new Error("async boom")), output);
    assert.deepEqual(output.err, ["error: async boom"]);
  });

  await t.test("treats an exit code outside 0, 1 and 2 as a broken guard", async () => {
    for (const code of [3, 256, -1, Number.NaN]) {
      const output = capture();
      await runCli(() => code, output);
      assert.equal(process.exitCode, EXIT_ERROR, String(code));
      assert.match(output.err[0] ?? "", /invalid exit code/);
    }
  });

  await t.test("still exits EXIT_ERROR when printing the error fails", async () => {
    const broken: Output = { write: () => undefined, warn: () => { throw new Error("EPIPE"); } };
    await runCli(() => { throw new Error("boom"); }, broken);
    assert.equal(process.exitCode, EXIT_ERROR);
  });
});

await test("consoleOutput writes to stdout and stderr", async (t) => {
  const { consoleOutput } = await import("./cli.ts");
  const logged: string[] = [];
  t.mock.method(console, "log", (line: string) => { logged.push(`out:${line}`); });
  t.mock.method(console, "error", (line: string) => { logged.push(`err:${line}`); });
  consoleOutput.write("a");
  consoleOutput.warn("b");
  assert.deepEqual(logged, ["out:a", "err:b"]);
});

await test("isEntryPoint is true only for the script node was started with", async () => {
  const { isEntryPoint } = await import("./cli.ts");
  // Under node --test each test file is the started script; cli.ts is only imported.
  assert.equal(isEntryPoint(import.meta.url), true);
  assert.equal(isEntryPoint(new URL("./cli.ts", import.meta.url).href), false);
  assert.equal(isEntryPoint(new URL("./does-not-exist.ts", import.meta.url).href), false);
});
