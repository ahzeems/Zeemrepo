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
  assert.deepEqual(lines.slice(1), [
    "node scripts/git/branch-guard.ts push",
    'if [ "${PR_READY_CHECKED:-}" = "$(git rev-parse HEAD)" ]; then exit 0; fi',
    "npm run --silent check",
  ]);
});

await test("guards run from main against the change, never running the change's code", () => {
  const workflow = readFileSync(join(root, ".github/workflows/guards.yml"), "utf8");
  assert.match(workflow, /^on:\n {2}pull_request_target:\n/m, "the workflow itself comes from main");
  assert.match(workflow, /permissions:\n {2}contents: read/);
  for (const guard of ["wiki/wiki-lint.ts\" --root .", "skills/skill-lint.ts\" --root .", "governance/governance-guard.ts\" --root .", "wiki/wiki-compliance.ts\"", "changes/changelog-guard.ts\"", "changes/repo-memory-guard.ts\""]) {
    assert.ok(workflow.includes(`node "$guards/${guard}`), guard);
  }
  assert.match(workflow, /npm ci --ignore-scripts/);
  const runLines = workflow.split("\n").filter((line) => /^\s+(run:|node |npm )/.test(line));
  assert.ok(!runLines.some((line) => /npm (ci|test|run)(?! ci --ignore-scripts)/.test(line) && !line.includes("--ignore-scripts")), "no change code runs");
  assert.match(workflow, /node-version-file: trusted\/\.nvmrc/);
  assert.match(workflow, /PR_AUTHOR: \$\{\{ github\.event\.pull_request\.user\.login \}\}/, "the bot exemption reads GitHub's author, not PR content");
  assert.doesNotMatch(workflow, /run: [^\n]*\$\{\{/, "no expression is expanded inside a run script");
});

await test("workflows pin every action to a commit SHA and never persist credentials", () => {
  for (const name of ["guards.yml", "check.yml"]) {
    const workflow = readFileSync(join(root, ".github/workflows", name), "utf8");
    assert.doesNotMatch(workflow, /uses: [^@\n]+@v\d/, `${name}: actions are pinned to commit SHAs`);
    const checkouts = workflow.match(/uses: actions\/checkout@/g) ?? [];
    const persisted = workflow.match(/persist-credentials: false/g) ?? [];
    assert.equal(persisted.length, checkouts.length, `${name}: every checkout drops its credentials`);
  }
});

await test("Claude Code runs the merge-blocking hook and pins ECC to a release", () => {
  const parsed: unknown = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
  const text = JSON.stringify(parsed);
  assert.ok(text.includes("scripts/claude/block-pr-merge.ts"), "PreToolUse hook registered");
  assert.ok(text.includes('"ref":"v2.2.3"'), "ECC marketplace pinned to a tag");
});

await test("Claude Code is denied merging and pushing main", () => {
  const settings: unknown = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
  const deny = typeof settings === "object" && settings !== null && "permissions" in settings
    && typeof settings.permissions === "object" && settings.permissions !== null && "deny" in settings.permissions ? settings.permissions.deny : [];
  assert.ok(Array.isArray(deny));
  for (const rule of ["Bash(gh pr merge:*)", "Bash(git push origin main)", "Bash(git push --force:*)"]) assert.ok(deny.includes(rule), rule);
});
