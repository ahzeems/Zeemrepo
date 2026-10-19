import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { isRecord } from "../lib/record.ts";
import { eccRulesErrors, main, MANIFEST_PATH } from "./ecc-rules.ts";

function put(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function repository(ref = "v2.2.3"): string {
  const root = mkdtempSync(join(tmpdir(), "ecc-rules-"));
  put(root, ".claude/settings.json", JSON.stringify({ extraKnownMarketplaces: { ecc: { source: { source: "git", ref } } } }));
  put(root, ".claude/rules/ecc/common/testing.md", "# Testing\n");
  put(root, ".claude/rules/ecc/typescript/testing.md", "# TS testing\n");
  put(root, ".claude/rules/ecc/LICENSE", "MIT\n");
  return root;
}

function quiet(): Output & { lines: string[] } {
  const lines: string[] = [];
  return { lines, write: (line) => lines.push(line), warn: (line) => lines.push(line) };
}

await test("a manifest written from the vendored rules then passes, and records the plugin pin", () => {
  const root = repository();
  try {
    assert.equal(main(["--write"], { cwd: root, output: quiet() }), EXIT_OK);
    const manifest: unknown = JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
    assert.ok(isRecord(manifest) && isRecord(manifest.files));
    assert.deepEqual(Object.keys(manifest.files).sort(), ["LICENSE", "common/testing.md", "typescript/testing.md"]);
    assert.equal(manifest.pluginRef, "v2.2.3");
    assert.deepEqual(eccRulesErrors(root), []);
    assert.equal(main([], { cwd: root, output: quiet() }), EXIT_OK);
    assert.equal(main(["--root", root], { output: quiet() }), EXIT_OK, "CI runs main's copy against the change with --root");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("an edited, added or missing rule file, or a moved plugin pin, is refused by name", () => {
  const root = repository();
  try {
    main(["--write"], { cwd: root, output: quiet() });
    put(root, ".claude/rules/ecc/common/testing.md", "# Testing, edited here\n");
    put(root, ".claude/rules/ecc/react/hooks.md", "# React\n");
    rmSync(join(root, ".claude/rules/ecc/typescript/testing.md"));
    put(root, ".claude/settings.json", JSON.stringify({ extraKnownMarketplaces: { ecc: { source: { ref: "v2.3.0" } } } }));
    const errors = eccRulesErrors(root).join("\n");
    assert.match(errors, /common\/testing\.md.*differs/);
    assert.match(errors, /react\/hooks\.md.*not in the manifest/);
    assert.match(errors, /typescript\/testing\.md.*missing/);
    assert.match(errors, /v2\.3\.0.*v2\.2\.3/);
    const output = quiet();
    assert.equal(main([], { cwd: root, output }), EXIT_REFUSED);
    assert.match(output.lines.join("\n"), /--write/, "the refusal says how to refresh");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("a missing or malformed manifest is refused, and bad arguments are an error", () => {
  const root = repository();
  try {
    assert.match(eccRulesErrors(root).join("\n"), /ecc-rules\.json/);
    put(root, MANIFEST_PATH, "not json");
    assert.match(eccRulesErrors(root).join("\n"), /ecc-rules\.json/);
    assert.equal(main(["--bogus"], { cwd: root, output: quiet() }), EXIT_ERROR);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("a planted dot file, dot folder or symlink under the vendored rules is refused", () => {
  const root = repository();
  try {
    main(["--write"], { cwd: root, output: quiet() });
    put(root, ".claude/rules/ecc/common/.hidden.md", "# hidden\n");
    put(root, ".claude/rules/ecc/.sub/a.md", "# a\n");
    put(root, "elsewhere.md", "# planted\n");
    symlinkSync(join(root, "elsewhere.md"), join(root, ".claude/rules/ecc/common/zz.md"));
    const errors = eccRulesErrors(root).join("\n");
    assert.match(errors, /common\/\.hidden\.md.*not in the manifest/);
    assert.match(errors, /\.sub\/a\.md.*not in the manifest/);
    assert.match(errors, /common\/zz\.md.*symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("a manifest with no files or a non-string hash is malformed, and --write refuses without a plugin pin", () => {
  const root = repository();
  try {
    put(root, MANIFEST_PATH, JSON.stringify({ pluginRef: "v2.2.3", files: {} }));
    assert.match(eccRulesErrors(root).join("\n"), /malformed/);
    put(root, MANIFEST_PATH, JSON.stringify({ pluginRef: "v2.2.3", files: { "common/testing.md": 5 } }));
    assert.match(eccRulesErrors(root).join("\n"), /malformed/);
    put(root, ".claude/settings.json", "{}");
    rmSync(join(root, MANIFEST_PATH));
    assert.equal(main(["--write"], { cwd: root, output: quiet() }), EXIT_ERROR);
    assert.throws(() => readFileSync(join(root, MANIFEST_PATH)), "nothing is written without a pin");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function settings(root: string, claudeMdExcludes: readonly string[]): void {
  put(root, ".claude/settings.json", JSON.stringify({ extraKnownMarketplaces: { ecc: { source: { source: "git", ref: "v2.2.3" } } }, claudeMdExcludes }));
}

await test("--write records which rule sets load: every vendored set the settings do not exclude", () => {
  const root = repository();
  try {
    put(root, ".claude/rules/ecc/arkts/coding-style.md", "# ArkTS\n");
    settings(root, ["**/.claude/rules/ecc/arkts/**"]);
    assert.equal(main(["--write"], { cwd: root, output: quiet() }), EXIT_OK);
    const manifest: unknown = JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
    assert.ok(isRecord(manifest));
    assert.deepEqual(manifest.loaded, ["common", "typescript"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("a rule set that loads without being recorded, or is recorded but excluded, is refused by name", () => {
  const root = repository();
  try {
    put(root, ".claude/rules/ecc/arkts/coding-style.md", "# ArkTS\n");
    settings(root, ["**/.claude/rules/ecc/arkts/**"]);
    main(["--write"], { cwd: root, output: quiet() });
    settings(root, ["**/.claude/rules/ecc/arkts/*"]);
    assert.match(eccRulesErrors(root).join("\n"), /ecc\/arkts\/ loads.*not list it/, "a pattern that does not exclude the whole set leaves it loading");
    settings(root, ["**/.claude/rules/ecc/arkts/**", "**/.claude/rules/ecc/typescript/**"]);
    assert.match(eccRulesErrors(root).join("\n"), /typescript as loaded.*excludes it/);
    settings(root, ["**/.claude/rules/ecc/arkts/**", "**/.claude/rules/ecc/golang/**"]);
    assert.match(eccRulesErrors(root).join("\n"), /excludes .*ecc\/golang\/, which is no vendored rule set/);
    settings(root, ["**/.claude/rules/ecc/arkts/**"]);
    assert.deepEqual(eccRulesErrors(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("a manifest whose loaded list is missing, malformed or names an absent set is refused", () => {
  const root = repository();
  try {
    const files = { "LICENSE": "x", "common/testing.md": "x", "typescript/testing.md": "x" };
    put(root, MANIFEST_PATH, JSON.stringify({ pluginRef: "v2.2.3", files }));
    assert.match(eccRulesErrors(root).join("\n"), /malformed/);
    put(root, MANIFEST_PATH, JSON.stringify({ pluginRef: "v2.2.3", loaded: [1], files }));
    assert.match(eccRulesErrors(root).join("\n"), /malformed/);
    main(["--write"], { cwd: root, output: quiet() });
    const manifest: unknown = JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
    assert.ok(isRecord(manifest));
    put(root, MANIFEST_PATH, JSON.stringify({ ...manifest, loaded: ["common", "typescript", "rust"] }));
    assert.match(eccRulesErrors(root).join("\n"), /rust as loaded, which is no vendored rule set/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("an exclusion that is not one whole ECC rule set is refused, so it cannot hide rules that must load", () => {
  const root = repository();
  try {
    put(root, ".claude/rules/ecc/arkts/coding-style.md", "# ArkTS\n");
    settings(root, ["**/.claude/rules/ecc/arkts/**"]);
    main(["--write"], { cwd: root, output: quiet() });
    for (const pattern of ["**/.claude/rules/**", "**/.claude/rules/ecc/**", "**/.claude/rules/ecc/common/*.md", "**/CLAUDE.md"]) {
      settings(root, ["**/.claude/rules/ecc/arkts/**", pattern]);
      assert.match(eccRulesErrors(root).join("\n"), /claudeMdExcludes entry .* is not one whole ECC rule set/, pattern);
    }
    put(root, ".claude/settings.json", JSON.stringify({ extraKnownMarketplaces: { ecc: { source: { ref: "v2.2.3" } } }, claudeMdExcludes: ["**/.claude/rules/ecc/arkts/**", 7] }));
    assert.match(eccRulesErrors(root).join("\n"), /claudeMdExcludes entry 7 is not one whole ECC rule set/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
