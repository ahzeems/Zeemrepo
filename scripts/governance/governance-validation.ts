import { parseFrontmatter } from "../lib/frontmatter.ts";
import { isRecord, isStringArray } from "../lib/record.ts";

// Governance alignment. Pure; the CLI lives in governance-guard.ts. Behaviour is defined by
// code plus the declared operating model, and for workflow-critical behaviour documents,
// skills, rules, code comments and config are all interface: one that still asserts a
// replaced rule is drift. Zimi scanned a hand-picked set of Markdown files only.

export type Surface = { path: string; text: string };
export type StaleClaim = { id: string; pattern: string; supersededBy: string };
export type Exclusion = { glob: string; reason: string };
export type Allowance = { path: string; contains: string; reason: string; claims: string[] };
export type Violation = { path: string; line: number; claim: string; text: string };
export type Config = { surfaces: string[]; exclude: Exclusion[]; staleClaims: StaleClaim[]; allowed: Allowance[] };
export type Result = { violations: Violation[]; unusedAllowances: Allowance[]; history: string[] };

// Long enough that a quoted fragment cannot match most lines of a file.
const MIN_CONTAINS = 8;
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isStaleClaim = (value: unknown): value is StaleClaim =>
  isRecord(value) && nonEmpty(value.id) && nonEmpty(value.pattern) && nonEmpty(value.supersededBy);
const isExclusion = (value: unknown): value is Exclusion => isRecord(value) && nonEmpty(value.glob) && nonEmpty(value.reason);
// claims is required: an allowance that excuses every claim is a silent exemption.
const isAllowance = (value: unknown): value is Allowance => isRecord(value) && nonEmpty(value.path) && nonEmpty(value.contains)
  && nonEmpty(value.reason) && isStringArray(value.claims) && value.claims.length > 0 && value.claims.every(nonEmpty);

function claimProblems(claims: unknown): string[] {
  if (!Array.isArray(claims) || claims.length === 0) return ["staleClaims must list at least one claim; a check with no claims enforces nothing"];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const [index, claim] of claims.entries()) {
    if (!isRecord(claim) || !nonEmpty(claim.id) || !nonEmpty(claim.pattern)) {
      problems.push(`staleClaims[${index}] needs a non-empty id and pattern`);
      continue;
    }
    if (ids.has(claim.id)) problems.push(`staleClaims[${index}] duplicate claim id ${claim.id}`);
    ids.add(claim.id);
    try {
      new RegExp(claim.pattern, "i");
    } catch {
      problems.push(`staleClaims[${index}] (${claim.id}) is not a valid regular expression`);
    }
    if (!nonEmpty(claim.supersededBy)) problems.push(`staleClaims[${index}] (${claim.id}) must name the decision that replaced the rule in supersededBy`);
  }
  return problems;
}

function allowanceProblems(allowed: unknown, ids: ReadonlySet<string>): string[] {
  if (!Array.isArray(allowed)) return ["allowed must be a list"];
  return allowed.flatMap((allowance: unknown, index): string[] => {
    if (!isAllowance(allowance)) return [`allowed[${index}] needs a non-empty path, contains, reason and claims (the claim ids it excuses)`];
    if (allowance.contains.trim().length < MIN_CONTAINS) return [`allowed[${index}] has a "contains" under ${MIN_CONTAINS} characters; quote enough of the sentence to identify it`];
    return allowance.claims.filter((id) => !ids.has(id)).map((id) => `allowed[${index}] names unknown claim ${id}`);
  });
}

export function configProblems(config: unknown): string[] {
  if (!isRecord(config)) return ["governance-alignment.json must be an object"];
  const ids = new Set(Array.isArray(config.staleClaims) ? config.staleClaims.flatMap((claim: unknown) => isRecord(claim) && nonEmpty(claim.id) ? [claim.id] : []) : []);
  const problems = claimProblems(config.staleClaims);
  if (!isStringArray(config.surfaces) || config.surfaces.length === 0 || !config.surfaces.every(nonEmpty)) problems.push("surfaces must list at least one non-empty path or glob to scan");
  if (!Array.isArray(config.exclude)) problems.push("exclude must be a list of { glob, reason }");
  else config.exclude.forEach((entry: unknown, index) => { if (!isExclusion(entry)) problems.push(`exclude[${index}] needs a glob and a reason`); });
  return [...problems, ...allowanceProblems(config.allowed, ids)];
}

/** The config's typed values; call only after configProblems returned nothing. */
export function readConfig(config: unknown): Config {
  if (!isRecord(config)) throw new Error("governance-alignment.json must be an object");
  const filter = <T>(value: unknown, guard: (item: unknown) => item is T): T[] => Array.isArray(value) ? value.filter(guard) : [];
  return {
    surfaces: isStringArray(config.surfaces) ? config.surfaces : [],
    exclude: filter(config.exclude, isExclusion),
    staleClaims: filter(config.staleClaims, isStaleClaim),
    allowed: filter(config.allowed, isAllowance),
  };
}

// Look-alike letters, invisible characters and curly quotes would otherwise let a claim
// through unmatched. Line breaks are kept, so line numbers survive normalization.
export function normalizeText(text: string): string {
  return text.normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, "\"");
}

// Whitespace runs (line breaks included) collapse to one space, so a claim wrapped across
// lines still matches; lineOf maps each collapsed character back to its source line.
function collapse(text: string): { flat: string; lineOf: number[] } {
  let flat = "";
  const lineOf: number[] = [];
  let line = 1;
  let inSpace = false;
  for (const char of normalizeText(text).replace(/\r\n/g, "\n")) {
    if (/\s/.test(char)) {
      if (!inSpace) { flat += " "; lineOf.push(line); }
      inSpace = true;
    } else {
      // One entry per UTF-16 unit, because regex match offsets count units, not code points.
      flat += char;
      for (let unit = 0; unit < char.length; unit++) lineOf.push(line);
      inSpace = false;
    }
    if (char === "\n") line++;
  }
  return { flat, lineOf };
}

// Only a wiki note that names its replacement may declare itself history. A skill, rule or
// script can never opt out of the check with a frontmatter line.
// The frontmatter is read as wiki:lint reads it, so YAML the linter rejects cannot opt out.
function isHistory(surface: Surface): boolean {
  if (!surface.path.startsWith("wiki/")) return false;
  const frontmatter = parseFrontmatter(surface.text);
  if (frontmatter.kind !== "ok") return false;
  const { status, superseded_by: replacement } = frontmatter.data;
  return status === "superseded" && typeof replacement === "string" && /^\[\[[^\]]+\]\]$/.test(replacement);
}

// An allowance excuses a match only when its quoted span covers the whole match, so text
// appended to an allowed sentence is still checked.
function excusers(surface: Surface, flat: string, start: number, end: number, claimId: string, allowed: readonly Allowance[]): number[] {
  // A case-insensitive search on the text itself keeps offsets aligned; lower-casing first
  // would shift them wherever a character changes length (such as \u0130).
  return allowed.flatMap((entry, position) => {
    if (entry.path !== surface.path || !entry.claims.includes(claimId)) return [];
    const needle = collapse(entry.contains).flat.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const found of flat.matchAll(new RegExp(needle, "giu"))) {
      if (found.index <= start && found.index + found[0].length >= end) return [position];
    }
    return [];
  });
}

function scanSurface(surface: Surface, config: Pick<Config, "staleClaims" | "allowed">, used: Set<number>): Violation[] {
  const { flat, lineOf } = collapse(surface.text);
  const lines = normalizeText(surface.text).replace(/\r\n/g, "\n").split("\n");
  const violations: Violation[] = [];
  for (const claim of config.staleClaims) {
    for (const match of flat.matchAll(new RegExp(claim.pattern, "gi"))) {
      const start = match.index;
      const found = excusers(surface, flat, start, start + match[0].length, claim.id, config.allowed);
      found.forEach((position) => used.add(position));
      if (found.length > 0) continue;
      const line = lineOf[start] ?? 1;
      violations.push({ path: surface.path, line, claim: claim.id, text: (lines[line - 1] ?? "").trim() });
    }
  }
  return violations;
}

export function checkGovernance(surfaces: readonly Surface[], config: Pick<Config, "staleClaims" | "allowed">): Result {
  const used = new Set<number>();
  const history = surfaces.filter(isHistory).map((surface) => surface.path);
  const violations = surfaces.filter((surface) => !isHistory(surface)).flatMap((surface) => scanSurface(surface, config, used));
  return { violations, unusedAllowances: config.allowed.filter((_, index) => !used.has(index)), history };
}

/** Exact paths or globs such as wiki/**\/*.md; ** spans directories, * stays within one. */
export function globToRegExp(pattern: string): RegExp {
  // Placeholders keep the single-star rule from rewriting the stars that ** expands to.
  const DIRS = "\u0000";
  const REST = "\u0001";
  const expanded = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, DIRS).replace(/\*\*$/, REST).replace(/\*/g, "[^/]*")
    .replace(new RegExp(DIRS, "g"), "(?:.*/)?").replace(REST, ".*");
  return new RegExp(`^${expanded}$`, "s");
}
