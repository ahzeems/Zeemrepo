import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { cleanGitEnv, createRepo } from "../test-support/repo-fixture.ts";
import { isRecord } from "../lib/record.ts";

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

await test("pre-push guards the ref updates, then runs the full check and refuses if it changed git state", () => {
  const lines = hook("pre-push").split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(lines.slice(1), [
    "node scripts/git/branch-guard.ts push",
    'if [ "${PR_READY_CHECKED:-}" = "$(git rev-parse HEAD)" ]; then exit 0; fi',
    "before=$(node scripts/git/git-state.ts snapshot)",
    "status=0",
    "npm run --silent check || status=$?",
    'printf \'%s\\n\' "$before" | node scripts/git/git-state.ts verify',
    'exit "$status"',
  ]);
});

await test("pre-push itself: the check's status is kept, and a check that moves git state is refused", async (t) => {
  const stateCli = `node "${join(root, "scripts/git/git-state.ts")}"`;
  const script = hook("pre-push").replace("node scripts/git/branch-guard.ts push\n", "").replaceAll("node scripts/git/git-state.ts", stateCli);
  assert.ok(script.includes("npm run --silent check") && !script.includes("branch-guard.ts push"), "the hook shape this test edits");
  const runWith = (check: string): { code: number | null; err: string } => {
    const repo = createRepo("pre-push-");
    t.after(() => repo.cleanup());
    repo.commit("base");
    const result = spawnSync("sh", ["-c", script.replace("npm run --silent check", check)], { cwd: repo.dir, env: cleanGitEnv, encoding: "utf8", input: "" });
    return { code: result.status, err: result.stderr };
  };
  await t.test("a passing check that touches nothing passes", () => assert.equal(runWith("true").code, 0));
  await t.test("a failing check keeps its own exit status", () => assert.equal(runWith("exit 3").code, 3));
  await t.test("a check that commits is refused even though it passed", () => {
    const result = runWith("git commit --quiet --allow-empty -m leaked");
    assert.equal(result.code, 1);
    assert.match(result.err, /git-state: HEAD moved/);
  });
  await t.test("a check that fails after moving state is still reported", () => {
    const result = runWith("git tag leaked && false");
    assert.notEqual(result.code, 0);
    assert.match(result.err, /git-state: refs changed/);
  });
});

await test("guards run from main against the change, never running the change's code", () => {
  const workflow = readFileSync(join(root, ".github/workflows/guards.yml"), "utf8");
  assert.match(workflow, /^on:\n {2}pull_request_target:\n/m, "the workflow itself comes from main");
  assert.match(workflow, /permissions:\n {2}contents: read/);
  for (const guard of ["wiki/wiki-lint.ts\" --root .", "skills/skill-lint.ts\" --root .", "governance/governance-guard.ts\" --root .", "governance/ecc-rules.ts\" --root .", "wiki/wiki-compliance.ts\"", "changes/changelog-guard.ts\"", "changes/repo-memory-guard.ts\""]) {
    assert.ok(workflow.includes(`node "$guards/${guard}`), guard);
  }
  assert.match(workflow, /npm ci --ignore-scripts/);
  const runLines = workflow.split("\n").filter((line) => /^\s+(run:|node |npm )/.test(line));
  assert.ok(!runLines.some((line) => /npm (ci|test|run)(?! ci --ignore-scripts)/.test(line) && !line.includes("--ignore-scripts")), "no change code runs");
  assert.match(workflow, /node-version-file: trusted\/\.nvmrc/);
  assert.match(workflow, /PR_AUTHOR: \$\{\{ github\.event\.pull_request\.user\.login \}\}/, "the bot exemption reads GitHub's author, not PR content");
  assert.doesNotMatch(workflow, /run: [^\n]*\$\{\{/, "no expression is expanded inside a run script");
});

await test("the declared, tested and typed Node versions are the same major", () => {
  const major = readFileSync(join(root, ".nvmrc"), "utf8").trim();
  const manifest: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(isRecord(manifest) && isRecord(manifest.engines) && isRecord(manifest.devDependencies));
  assert.equal(manifest.engines.node, `>=${major}.0.0`, "engines claims only what CI (node-version-file: .nvmrc) tests");
  assert.match(String(manifest.devDependencies["@types/node"]), new RegExp(`^\\^${major}\\.`));
});

await test("Dependabot proposes updates for the pinned actions and the npm dependencies, never merging", () => {
  const config = readFileSync(join(root, ".github/dependabot.yml"), "utf8");
  for (const ecosystem of ["github-actions", "npm"]) assert.match(config, new RegExp(`package-ecosystem: ${ecosystem}\\n`));
  assert.doesNotMatch(config, /auto-?merge/i);
});

await test("Dependabot never proposes a TypeScript or Node types update the linter or Node 24 cannot take", () => {
  const config: unknown = parse(readFileSync(join(root, ".github/dependabot.yml"), "utf8"));
  assert.ok(isRecord(config) && Array.isArray(config.updates));
  const npm: unknown = config.updates.find((entry: unknown) => isRecord(entry) && entry["package-ecosystem"] === "npm");
  assert.ok(isRecord(npm) && Array.isArray(npm.ignore), "the npm entry carries the ignore list");
  const ignored = new Map(npm.ignore.filter(isRecord).map((rule) => [rule["dependency-name"], rule["update-types"]]));
  // typescript-eslint supports a TypeScript minor only after its own release, so TypeScript gets patches only.
  assert.deepEqual(ignored.get("typescript"), ["version-update:semver-major", "version-update:semver-minor"]);
  assert.deepEqual(ignored.get("@types/node"), ["version-update:semver-major"], "the Node types follow the .nvmrc major");
  assert.equal(ignored.size, 2, "nothing else is held back");
});

await test("CI's bot path reuses check:base, so the check list has one source", () => {
  const manifest: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(isRecord(manifest) && isRecord(manifest.scripts));
  const scripts = manifest.scripts;
  assert.equal(scripts.check, "npm run check:base && npm run changelog:guard && npm run memory:guard");
  assert.doesNotMatch(String(scripts["check:base"]), /changelog:guard|memory:guard/);
  const workflow = readFileSync(join(root, ".github/workflows/check.yml"), "utf8");
  assert.match(workflow, /npm run check:base\n/);
  assert.doesNotMatch(workflow, /npm run lint/, "the list is not copied into the workflow");
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
