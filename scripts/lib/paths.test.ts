import assert from "node:assert/strict";
import { test } from "node:test";
import * as paths from "./paths.ts";

await test("repository paths are relative, forward-slash, and directories end in a slash", () => {
  for (const [name, value] of Object.entries(paths)) {
    assert.equal(typeof value, "string", name);
    const path = String(value);
    assert.ok(!path.startsWith("/") && !path.startsWith("./"), `${name} is not repository-relative: ${path}`);
    assert.ok(!path.includes("\\"), `${name} uses a backslash: ${path}`);
    assert.equal(name.endsWith("_DIR"), path.endsWith("/"), `${name}: directories, and only directories, end in /`);
  }
});

await test("work records live inside the wiki", () => {
  assert.ok(paths.WORK_DIR.startsWith(paths.WIKI_DIR));
});
