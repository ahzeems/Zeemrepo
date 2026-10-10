// npm run rules:check: the vendored ECC rules under .claude/rules/ecc/ are exactly the files the
// manifest lists, unedited, for the plugin version .claude/settings.json pins. Only the rule sets
// this repository uses are vendored (common, typescript, python), because Claude Code loads every
// rule whose paths match the file being edited. After moving the pin, copy those folders from the
// plugin's rules/ and run with --write to record the new hashes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { EXIT_ERROR, consoleOutput, isEntryPoint, report, runCli, type Output } from "../lib/cli.ts";
import { isRecord } from "../lib/record.ts";
import { walk } from "../lib/walk.ts";
import { provenanceHash } from "../skills/provenance.ts";
import { CONFIG_DIR } from "../lib/paths.ts";

export const MANIFEST_PATH = `${CONFIG_DIR}ecc-rules.json`;
const RULES_DIR = ".claude/rules/ecc";
const SETTINGS_PATH = ".claude/settings.json";
const REPOSITORY = join(import.meta.dirname, "../..");

type Manifest = { pluginRef: string; files: Record<string, string> };
export type Options = { cwd?: string; output?: Output };

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function pinnedRef(root: string): string | null {
  const settings = readJson(join(root, SETTINGS_PATH));
  const ecc = isRecord(settings) && isRecord(settings.extraKnownMarketplaces) ? settings.extraKnownMarketplaces.ecc : null;
  const source = isRecord(ecc) ? ecc.source : null;
  return isRecord(source) && typeof source.ref === "string" ? source.ref : null;
}

function vendoredHashes(root: string): Record<string, string> {
  const dir = join(root, RULES_DIR);
  const entries = walk(dir).files.map((path) => [relative(dir, path), provenanceHash(readFileSync(path, "utf8"))] as const);
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function readManifest(root: string): Manifest | null {
  const value = readJson(join(root, MANIFEST_PATH));
  if (!isRecord(value) || typeof value.pluginRef !== "string" || !isRecord(value.files)) return null;
  const files = Object.entries(value.files).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return { pluginRef: value.pluginRef, files: Object.fromEntries(files) };
}

export function eccRulesErrors(root: string): string[] {
  const manifest = readManifest(root);
  if (manifest === null) return [`${MANIFEST_PATH} is missing or malformed`];
  const errors: string[] = [];
  const ref = pinnedRef(root);
  if (ref !== manifest.pluginRef) errors.push(`${SETTINGS_PATH} pins ECC ${ref ?? "(none)"} but ${MANIFEST_PATH} records ${manifest.pluginRef}`);
  const actual = vendoredHashes(root);
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (!(path in actual)) errors.push(`${RULES_DIR}/${path} is missing`);
    else if (actual[path] !== hash) errors.push(`${RULES_DIR}/${path} differs from the vendored copy`);
  }
  for (const path of Object.keys(actual)) {
    if (!(path in manifest.files)) errors.push(`${RULES_DIR}/${path} is not in the manifest`);
  }
  return errors;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const root = options.cwd ?? REPOSITORY;
  if (args.length > 1 || (args.length === 1 && args[0] !== "--write")) {
    output.warn("usage: node scripts/governance/ecc-rules.ts [--write]");
    return EXIT_ERROR;
  }
  if (args[0] === "--write") {
    const manifest: Manifest = { pluginRef: pinnedRef(root) ?? "", files: vendoredHashes(root) };
    mkdirSync(dirname(join(root, MANIFEST_PATH)), { recursive: true });
    writeFileSync(join(root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const errors = eccRulesErrors(root).map((error) => `  x ${error}`);
  if (errors.length > 0) errors.push("  Refresh the folders from the pinned plugin's rules/, then run: node scripts/governance/ecc-rules.ts --write");
  return report(errors, `rules-check: ${RULES_DIR} matches ${MANIFEST_PATH}`, output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
