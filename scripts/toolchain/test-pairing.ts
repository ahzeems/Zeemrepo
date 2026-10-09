import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Node's coverage only reports files a test actually loads, so a script with no test is
// invisible to the 80% gate. Requiring a sibling `<name>.test.ts` closes that gap.
const EXEMPT_DIRS = new Set(["fixtures", "test-support"]);

export function unpairedSources(paths: readonly string[]): string[] {
  const present = new Set(paths);
  return paths
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
    .filter((path) => !path.split("/").some((part) => EXEMPT_DIRS.has(part)))
    .filter((path) => !present.has(path.replace(/\.ts$/, ".test.ts")))
    .sort();
}

export function listFiles(root: string, dir: string = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(root, full);
    return entry.isFile() ? [relative(root, full).split("\\").join("/")] : [];
  });
}
