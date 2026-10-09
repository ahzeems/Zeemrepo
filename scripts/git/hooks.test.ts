import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../..");
const hook = (name: string): string => readFileSync(join(root, ".githooks", name), "utf8");

await test("hooks are executable shell scripts that stop at the first failure", () => {
  for (const name of ["pre-commit", "pre-push"]) {
    assert.ok((statSync(join(root, ".githooks", name)).mode & 0o111) !== 0, `${name} is not executable`);
    assert.ok(hook(name).startsWith("#!/bin/sh\n"), `${name} needs a sh shebang`);
    assert.match(hook(name), /^set -eu$/m);
  }
});

await test("pre-commit refuses commits on main and mixed wiki staging before anything else", () => {
  const lines = hook("pre-commit").split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(lines.slice(1, 3), ["node scripts/git/branch-guard.ts commit", "node scripts/wiki/wiki-compliance.ts --staged"]);
});

await test("pre-push guards the ref updates, then runs the full check", () => {
  const lines = hook("pre-push").split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(lines.slice(1), ["node scripts/git/branch-guard.ts push", "npm run --silent check"]);
});

await test("CI runs every guard from main's copy against the change", () => {
  const workflow = readFileSync(join(root, ".github/workflows/check.yml"), "utf8");
  for (const guard of ["wiki/wiki-lint.ts\" --root .", "skills/skill-lint.ts\" --root .", "governance/governance-guard.ts\" --root .", "wiki/wiki-compliance.ts\"", "changes/changelog-guard.ts\"", "changes/repo-memory-guard.ts\""]) {
    assert.ok(workflow.includes(`node "$guards/${guard}`), guard);
  }
  assert.match(workflow, /ref: main\n\s+path: trusted/);
  assert.doesNotMatch(workflow, /uses: [^@\n]+@v\d/, "actions are pinned to commit SHAs");
});

await test("Claude Code is denied merging and pushing main", () => {
  const settings: unknown = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
  const deny = typeof settings === "object" && settings !== null && "permissions" in settings
    && typeof settings.permissions === "object" && settings.permissions !== null && "deny" in settings.permissions ? settings.permissions.deny : [];
  assert.ok(Array.isArray(deny));
  for (const rule of ["Bash(gh pr merge:*)", "Bash(git push origin main)", "Bash(git push --force:*)"]) assert.ok(deny.includes(rule), rule);
});
