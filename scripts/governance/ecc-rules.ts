// npm run rules:check: the vendored ECC rules under .claude/rules/ecc/ are exactly the files the
// manifest lists, unedited, for the plugin version .claude/settings.json pins: every rule set in
// ECC's rules/ folder, kept complete (OWNER DECISION, 2026-10-10), plus the plugin's LICENSE.
// rules/README.md stays out, because Claude Code would load it as a rule. After moving the pin,
// copy the rule set folders in again and run with --write to record the new hashes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { EXIT_ERROR, consoleOutput, isEntryPoint, report, rootFrom, runCli, type Output } from "../lib/cli.ts";
import { isRecord } from "../lib/record.ts";
import { walk } from "../lib/walk.ts";
import { provenanceHash } from "../skills/provenance.ts";
import { CONFIG_DIR } from "../lib/paths.ts";

export const MANIFEST_PATH = `${CONFIG_DIR}ecc-rules.json`;
const RULES_DIR = ".claude/rules/ecc";
const SETTINGS_PATH = ".claude/settings.json";
const REPOSITORY = join(import.meta.dirname, "../..");
const USAGE = "usage: node scripts/governance/ecc-rules.ts [--write | --root <repository>]";

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

// Every entry counts, dot files and any folder included; a symlink is never a vendored file.
// Hashes ignore a byte-order mark and CRLF line endings, as skill provenance does.
function vendored(root: string): { hashes: Record<string, string>; symlinks: string[] } {
  const dir = join(root, RULES_DIR);
  const found = walk(dir, { includeDot: true, skipDirs: new Set() });
  const entries = found.files.map((path) => [relative(dir, path), provenanceHash(readFileSync(path, "utf8"))] as const);
  return {
    hashes: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))),
    symlinks: found.symlinks.map((path) => relative(dir, path)),
  };
}

function readManifest(root: string): Manifest | null {
  const value = readJson(join(root, MANIFEST_PATH));
  if (!isRecord(value) || typeof value.pluginRef !== "string" || !isRecord(value.files)) return null;
  const files = Object.entries(value.files);
  if (files.length === 0 || files.some(([, hash]) => typeof hash !== "string")) return null;
  return { pluginRef: value.pluginRef, files: Object.fromEntries(files.map(([path, hash]) => [path, String(hash)])) };
}

export function eccRulesErrors(root: string): string[] {
  const manifest = readManifest(root);
  if (manifest === null) return [`${MANIFEST_PATH} is missing or malformed`];
  const errors: string[] = [];
  const ref = pinnedRef(root);
  if (ref !== manifest.pluginRef) errors.push(`${SETTINGS_PATH} pins ECC ${ref ?? "(none)"} but ${MANIFEST_PATH} records ${manifest.pluginRef}`);
  const { hashes: actual, symlinks } = vendored(root);
  for (const path of symlinks) errors.push(`${RULES_DIR}/${path} is a symlink, which a vendored rule never is`);
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
  const write = args.length === 1 && args[0] === "--write";
  let root: string;
  try {
    root = rootFrom(write ? [] : args, options.cwd ?? REPOSITORY, USAGE);
  } catch {
    output.warn(USAGE);
    return EXIT_ERROR;
  }
  if (write) {
    const pluginRef = pinnedRef(root);
    if (pluginRef === null) {
      output.warn(`rules-check: ${SETTINGS_PATH} pins no ECC version, so there is nothing to record`);
      return EXIT_ERROR;
    }
    const manifest: Manifest = { pluginRef, files: vendored(root).hashes };
    mkdirSync(dirname(join(root, MANIFEST_PATH)), { recursive: true });
    writeFileSync(join(root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const errors = eccRulesErrors(root).map((error) => `  x ${error}`);
  if (errors.length > 0) errors.push("  Refresh the folders from the pinned plugin's rules/, then run: node scripts/governance/ecc-rules.ts --write");
  return report(errors, `rules-check: ${RULES_DIR} matches ${MANIFEST_PATH}`, output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
