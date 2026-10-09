import assert from "node:assert/strict";
import { test } from "node:test";
import { isExempt, isOperatingDoc, isWorkflowCritical, normalizePath } from "./change-policy.ts";
import { CHANGELOG } from "./paths.ts";

function assertAll(check: (path: string) => boolean, expected: boolean, paths: readonly string[]): void {
  for (const path of paths) assert.equal(check(path), expected, path);
}

await test("normalizePath turns Windows separators and a leading ./ into git form", () => {
  assert.equal(normalizePath(".\\scripts\\lib\\git.ts"), "scripts/lib/git.ts");
  assert.equal(normalizePath("./CLAUDE.md"), "CLAUDE.md");
});

await test("isWorkflowCritical", async (t) => {
  await t.test("covers hooks, agent config, CI, config and the constitution", () => {
    assertAll(isWorkflowCritical, true, [
      ".githooks/pre-commit", ".claude/settings.json", ".claude/rules/zeem/evidence.md", ".github/workflows/check.yml",
      "config/skill-standards.json", "CLAUDE.md", "README.md",
    ]);
  });

  await t.test("covers every file under scripts/, not only TypeScript", () => {
    assertAll(isWorkflowCritical, true, ["scripts/lib/git.ts", "scripts/install.sh", "scripts/x.mjs", "scripts/fixtures/broken/a.md"]);
  });

  await t.test("covers any root file except Markdown docs, licences and the lockfile", () => {
    assertAll(isWorkflowCritical, true, ["package.json", "eslint.config.js", ".npmrc", ".nvmrc", ".mcp.json", ".gitattributes", "Makefile"]);
    assertAll(isWorkflowCritical, false, ["package-lock.json", CHANGELOG, "LICENSE", "NOTES.md"]);
  });

  await t.test("finds nested agent config, which Claude Code also loads", () => {
    assertAll(isWorkflowCritical, true, ["sub/CLAUDE.md", "sub/CLAUDE.local.md", "tools/x/.claude/settings.json"]);
  });

  await t.test("ignores case, as macOS and Windows checkouts do", () => {
    assertAll(isWorkflowCritical, true, [".GitHooks/pre-push", "Scripts/x.ts", "readme.md", "claude.md"]);
  });

  await t.test("matches paths containing newlines or tabs", () => {
    assertAll(isWorkflowCritical, true, ["scripts/n\nl.ts", ".githooks/pre-push\tx"]);
  });

  await t.test("normalizes Windows paths before matching", () => {
    assert.equal(isWorkflowCritical("scripts\\lib\\git.ts"), true);
  });

  await t.test("excludes ordinary wiki notes and nested docs", () => {
    assertAll(isWorkflowCritical, false, ["wiki/lessons/A lesson.md", "docs/migration/zimi-audit.md"]);
  });

  await t.test("no longer recognises other harnesses' config", () => {
    assertAll(isWorkflowCritical, false, ["AGENTS.md", ".opencode/agents/x.md", ".agents/skills/x/SKILL.md"]);
  });
});

await test("isExempt", async (t) => {
  await t.test("exempts session notes, .gitignore files and the lockfile", () => {
    assertAll(isExempt, true, ["wiki/sessions/2026-10-09 Start.md", ".gitignore", "docs/.gitignore", "package-lock.json"]);
  });

  await t.test("never exempts a workflow-critical path, so the two cannot overlap", () => {
    assertAll(isExempt, false, [".githooks/pre-push", "scripts/.gitignore", ".claude/.gitignore", "config/.gitignore"]);
  });

  await t.test("does not exempt code or the changelog itself", () => {
    assertAll(isExempt, false, ["scripts/lib/git.ts", CHANGELOG]);
  });
});

await test("isOperatingDoc: decisions, reference and runbooks", () => {
  assertAll(isOperatingDoc, true, ["wiki/decisions/ADR-0001 Wiki.md", "wiki/reference/Merge gate contract.md", "wiki/runbooks/Verify.md"]);
  assertAll(isOperatingDoc, false, ["wiki/lessons/A lesson.md", "wiki/Decisions.md"]);
});
