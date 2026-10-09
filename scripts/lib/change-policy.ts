// Which paths a branch's change-record guards care about. One source for both the
// changelog guard and the repo-memory guard: Zimi kept two lists, and they disagreed.
//
// Matching is case-insensitive (macOS and Windows checkouts resolve `Scripts/` to
// `scripts/`), and `.` matches newlines, because git paths can contain them.

// Always critical: these change how work is built, checked, reviewed or landed, and
// Claude Code loads agent config from nested directories too.
const CRITICAL = [
  /^\.githooks\//is,
  /^\.github\//is,
  /^scripts\//is,
  /^config\//is,
  /(^|\/)\.claude\//is,
  /(^|\/)claude(\.local)?\.md$/is,
  /^readme\.md$/is,
];
// Root files are tooling (package.json, .npmrc, eslint.config.js, Makefile...) unless
// they are prose or a recorded resolution.
const ROOT_FILE = /^[^/]+$/s;
const ROOT_NOT_WORKFLOW = [/\.md$/is, /^licen[cs]e/is, /^package-lock\.json$/is, /^\.gitignore$/is];

// Paths that cannot change behaviour, documentation or process on their own. A critical
// path is never exempt, whatever its name.
const EXEMPT = [/^wiki\/sessions\//is, /(^|\/)\.gitignore$/is, /^package-lock\.json$/is];
const OPERATING_DOCS = [/^wiki\/decisions\//is, /^wiki\/reference\//is, /^wiki\/runbooks\//is];

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function matchesAny(rules: readonly RegExp[], path: string): boolean {
  return rules.some((rule) => rule.test(path));
}

export function isWorkflowCritical(path: string): boolean {
  const normalized = normalizePath(path);
  if (matchesAny(CRITICAL, normalized)) return true;
  return ROOT_FILE.test(normalized) && !matchesAny(ROOT_NOT_WORKFLOW, normalized);
}

export function isExempt(path: string): boolean {
  const normalized = normalizePath(path);
  return !isWorkflowCritical(normalized) && matchesAny(EXEMPT, normalized);
}

export function isOperatingDoc(path: string): boolean {
  return matchesAny(OPERATING_DOCS, normalizePath(path));
}
