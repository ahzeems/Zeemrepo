import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { cleanGitEnv } from "../test-support/repo-fixture.ts";

// An editor writing CRLF once dirtied every Markdown file, so a pull was refused and landed
// work looked unrecorded. The fix is the
// `* text=auto eol=lf` rule in .gitattributes; this fails if that rule is ever removed.
const root = join(import.meta.dirname, "../..");

await test("text is stored with LF line endings whatever the editor writes", () => {
  const paths = ["wiki/Home.md", "scripts/lib/git.ts", "config/x.json", ".githooks/pre-push", "x.sh"];
  const output = execFileSync("git", ["check-attr", "text", "eol", "--", ...paths], { cwd: root, env: cleanGitEnv, encoding: "utf8" });
  for (const path of paths) {
    assert.match(output, new RegExp(`^${path.replace(/\./g, "\\.")}: eol: lf$`, "m"), path);
    assert.match(output, new RegExp(`^${path.replace(/\./g, "\\.")}: text: (auto|set)$`, "m"), path);
  }
});
