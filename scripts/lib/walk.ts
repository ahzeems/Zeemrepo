import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// includeDot: also descend into dot entries. skipDirs: directory names never entered, at any
// depth. skipAtRoot: names skipped only directly under `dir`. Defaults skip dot entries plus .git
// and node_modules, which are never authored here.
export type WalkOptions = { pattern?: RegExp; includeDot?: boolean; skipDirs?: ReadonlySet<string>; skipAtRoot?: ReadonlySet<string> };
export type WalkResult = { files: string[]; symlinks: string[] };

const DEFAULT_SKIPPED = new Set([".git", "node_modules"]);

// Symbolic links are reported, never followed: a link can point outside the repository,
// and a check that silently follows it is checking something else.
export function walk(dir: string, options: WalkOptions = {}): WalkResult {
  return collect(dir, options, options.skipAtRoot ?? NONE);
}

const NONE: ReadonlySet<string> = new Set();

function collect(dir: string, options: WalkOptions, skipHere: ReadonlySet<string>): WalkResult {
  const result: WalkResult = { files: [], symlinks: [] };
  if (!existsSync(dir)) return result;
  const skipped = options.skipDirs ?? DEFAULT_SKIPPED;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ((entry.name.startsWith(".") && options.includeDot !== true) || skipHere.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      result.symlinks.push(path);
    } else if (entry.isDirectory()) {
      if (skipped.has(entry.name)) continue;
      const nested = collect(path, options, NONE);
      result.files.push(...nested.files);
      result.symlinks.push(...nested.symlinks);
    } else if (entry.isFile() && (options.pattern?.test(entry.name) ?? true)) {
      result.files.push(path);
    }
  }
  return result;
}
