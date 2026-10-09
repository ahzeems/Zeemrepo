import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import ts from "typescript";

// A test that spawns a child without scrubbing GIT_* acts on the real repository when it runs
// under a hook (wiki lesson "Hook-run checks must preserve Git state"). So in test code
// (*.test.* and scripts/test-support/) every child_process call must pass `env: cleanGitEnv`,
// or an env object that spreads it, whatever the command: `sh -c` can run git too. The check
// reads the syntax tree, so aliases, namespace imports, quotes and line breaks do not hide a call.
const root = join(import.meta.dirname, "../..");
const SPAWNERS = new Set(["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"]);
const MODULES = new Set(["node:child_process", "child_process"]);
const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

function spawnerNames(file: ts.SourceFile): { names: Set<string>; namespaces: Set<string> } {
  const names = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !MODULES.has(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) if (SPAWNERS.has((element.propertyName ?? element.name).text)) names.add(element.name.text);
    }
    if (statement.importClause?.name) namespaces.add(statement.importClause.name.text);
  }
  addAliases(file, names, namespaces);
  return { names, namespaces };
}

// `const run = execFileSync`, `const run = cp.spawnSync` and `const { spawnSync } = cp` make a
// spawner under a new name; follow them (and aliases of aliases) until nothing new appears.
// A spawner passed to another function or stored in an object is not followed.
function aliasOf(initializer: ts.Expression, names: ReadonlySet<string>, namespaces: ReadonlySet<string>): boolean {
  if (ts.isIdentifier(initializer)) return names.has(initializer.text);
  return ts.isPropertyAccessExpression(initializer) && ts.isIdentifier(initializer.expression)
    && namespaces.has(initializer.expression.text) && SPAWNERS.has(initializer.name.text);
}

function addDestructured(pattern: ts.ObjectBindingPattern, names: Set<string>): void {
  for (const element of pattern.elements) {
    const property = element.propertyName ?? element.name;
    if (ts.isIdentifier(property) && SPAWNERS.has(property.text) && ts.isIdentifier(element.name)) names.add(element.name.text);
  }
}

function addAliases(file: ts.SourceFile, names: Set<string>, namespaces: ReadonlySet<string>): void {
  const declarations: ts.VariableDeclaration[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) declarations.push(node);
    ts.forEachChild(node, collect);
  };
  collect(file);
  for (let size = -1; size !== names.size;) {
    size = names.size;
    for (const { name, initializer } of declarations) {
      if (initializer === undefined) continue;
      if (ts.isIdentifier(name) && aliasOf(initializer, names, namespaces)) names.add(name.text);
      if (ts.isObjectBindingPattern(name) && ts.isIdentifier(initializer) && namespaces.has(initializer.text)) addDestructured(name, names);
    }
  }
}

// A spread of cleanGitEnv counts only if nothing can put a GIT_ variable back: no other
// spread, no computed key, and no plain key starting with GIT_.
function putsGitBack(property: ts.ObjectLiteralElementLike): boolean {
  if (ts.isSpreadAssignment(property)) return !(ts.isIdentifier(property.expression) && property.expression.text === "cleanGitEnv");
  if (property.name === undefined || ts.isComputedPropertyName(property.name)) return true;
  return /^["']?GIT_/.test(property.name.getText());
}
const isCleanEnv = (node: ts.Expression): boolean =>
  (ts.isIdentifier(node) && node.text === "cleanGitEnv")
  || (ts.isObjectLiteralExpression(node) && !node.properties.some(putsGitBack)
    && node.properties.some((property) => ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression) && property.expression.text === "cleanGitEnv"));

// require() or import() of child_process hides the spawner from the import scan, so test
// code may only import it statically.
function loadsChildProcessDynamically(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const [first] = node.arguments;
  const loader = (ts.isIdentifier(node.expression) && node.expression.text === "require") || node.expression.kind === ts.SyntaxKind.ImportKeyword;
  return loader && first !== undefined && ts.isStringLiteralLike(first) && MODULES.has(first.text);
}

const passesCleanEnv = (call: ts.CallExpression): boolean => call.arguments.some((argument) =>
  ts.isObjectLiteralExpression(argument) && argument.properties.some((property) =>
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "env" && isCleanEnv(property.initializer)));

function unscrubbedSpawns(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const { names, namespaces } = spawnerNames(file);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const spawns = (ts.isIdentifier(callee) && names.has(callee.text))
        || (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && SPAWNERS.has(callee.name.text));
      if ((spawns && !passesCleanEnv(node)) || loadsChildProcessDynamically(node)) found.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function testCode(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "fixtures" ? [] : testCode(path);
    const rel = relative(root, path).replace(/\\/g, "/");
    return SOURCE.test(entry.name) && (/\.test\.[^.]+$/.test(entry.name) || rel.startsWith("scripts/test-support/")) ? [rel] : [];
  });
}

await test("the spawn check sees through aliases, namespaces and quoting, and accepts only a clean env", () => {
  const offending = [
    'import { execFileSync } from "node:child_process";\nexecFileSync("git", ["init"], { cwd: dir });',
    "import { execFileSync as run } from 'node:child_process';\nrun('git', ['commit', '-m', 'a;b']);",
    'import * as cp from "node:child_process";\ncp.spawnSync(`git`, args);',
    'import { execSync } from "child_process";\nexecSync("git init"); // cleanGitEnv',
    'import { spawnSync } from "node:child_process";\nspawnSync("sh", ["-c", "git init"], { env: process.env });',
    'import { spawnSync } from "node:child_process";\nspawnSync("git", args, { env: { ...cleanGitEnv, GIT_DIR: dir } });',
    'import { spawnSync } from "node:child_process";\nspawnSync("git", args, { env: { ...cleanGitEnv, ["GIT_DIR"]: dir } });',
    'import { spawnSync } from "node:child_process";\nspawnSync("git", args, { env: { ...cleanGitEnv, ...process.env } });',
    'const cp = require("node:child_process");',
    'const cp = await import("child_process");',
    'import { execFileSync } from "node:child_process";\nconst run = execFileSync;\nrun("git", ["init"]);',
    'import { execFileSync } from "node:child_process";\nconst run = execFileSync;\nconst again = run;\nagain("git", ["init"]);',
    'import * as cp from "node:child_process";\nconst run = cp.spawnSync;\nrun("git", args);',
    'import * as cp from "node:child_process";\nconst { spawnSync: s } = cp;\ns("git", args);',
  ];
  for (const source of offending) assert.equal(unscrubbedSpawns("sample.ts", source).length, 1, source);
  const clean = [
    'import { execFileSync } from "node:child_process";\nexecFileSync("git", [f(x)], { cwd: dir, env: cleanGitEnv });',
    'import { spawnSync } from "node:child_process";\nspawnSync("sh", ["-c", s], { env: { ...cleanGitEnv, A: "1" } });',
    'import { readFileSync } from "node:fs";\nreadFileSync("git");',
  ];
  for (const source of clean) assert.deepEqual(unscrubbedSpawns("sample.ts", source), [], source);
});

await test("every child process spawned by test code passes cleanGitEnv", () => {
  const offenders = testCode(join(root, "scripts")).flatMap((path) => unscrubbedSpawns(path, readFileSync(join(root, path), "utf8")));
  assert.deepEqual(offenders, []);
});
