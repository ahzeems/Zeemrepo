import { isRecord, isStringArray } from "../lib/record.ts";

// Governance alignment. Pure; the CLI lives in governance-guard.ts. Behaviour is defined by
// code plus the declared operating model, and for workflow-critical behaviour documents,
// skills, code comments and config are all interface: one that still asserts a replaced
// rule is drift. Zimi scanned Markdown only, which let stale wording survive in code.

export type Surface = { path: string; text: string };
export type StaleClaim = { id: string; pattern: string; supersededBy: string };
export type Allowance = { path: string; contains: string; reason: string; claims?: string[] };
export type Violation = { path: string; line: number; claim: string; text: string };
export type Config = { surfaces: string[]; exclude: string[]; staleClaims: StaleClaim[]; allowed: Allowance[] };
export type Result = { violations: Violation[]; unusedAllowances: Allowance[] };

// Long enough that a quoted fragment cannot match most lines of a file.
const MIN_CONTAINS = 8;
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function isStaleClaim(value: unknown): value is StaleClaim {
  return isRecord(value) && nonEmpty(value.id) && nonEmpty(value.pattern) && nonEmpty(value.supersededBy);
}

function isAllowance(value: unknown): value is Allowance {
  if (!isRecord(value) || !nonEmpty(value.path) || !nonEmpty(value.contains) || !nonEmpty(value.reason)) return false;
  return value.claims === undefined || (isStringArray(value.claims) && value.claims.every(nonEmpty));
}

function claimProblems(claims: unknown): string[] {
  if (!Array.isArray(claims) || claims.length === 0) return ["staleClaims must list at least one claim; a check with no claims enforces nothing"];
  const problems: string[] = [];
  const ids = new Set<string>();
  claims.forEach((claim: unknown, index) => {
    if (!isRecord(claim) || !nonEmpty(claim.id) || !nonEmpty(claim.pattern)) return problems.push(`staleClaims[${index}] needs a non-empty id and pattern`);
    if (ids.has(claim.id)) problems.push(`staleClaims[${index}] duplicate claim id ${claim.id}`);
    ids.add(claim.id);
    try {
      new RegExp(claim.pattern, "i");
    } catch {
      problems.push(`staleClaims[${index}] (${claim.id}) is not a valid regular expression`);
    }
    if (!nonEmpty(claim.supersededBy)) problems.push(`staleClaims[${index}] (${claim.id}) must name the decision that replaced the rule in supersededBy`);
    return undefined;
  });
  return problems;
}

function allowanceProblems(allowed: unknown, ids: ReadonlySet<string>): string[] {
  if (!Array.isArray(allowed)) return ["allowed must be a list"];
  return allowed.flatMap((allowance: unknown, index): string[] => {
    // The reason is the point: an allowance nobody had to justify is a silent exemption.
    if (!isAllowance(allowance)) return [`allowed[${index}] needs a non-empty path, contains, and reason explaining why the wording stays`];
    if (allowance.contains.trim().length < MIN_CONTAINS) return [`allowed[${index}] has a "contains" under ${MIN_CONTAINS} characters; quote enough of the sentence to identify it`];
    return (allowance.claims ?? []).filter((id) => !ids.has(id)).map((id) => `allowed[${index}] names unknown claim ${id}`);
  });
}

export function configProblems(config: unknown): string[] {
  if (!isRecord(config)) return ["governance-alignment.json must be an object"];
  const ids = new Set(Array.isArray(config.staleClaims) ? config.staleClaims.flatMap((claim: unknown) => isRecord(claim) && nonEmpty(claim.id) ? [claim.id] : []) : []);
  const problems = claimProblems(config.staleClaims);
  if (!isStringArray(config.surfaces) || config.surfaces.length === 0 || !config.surfaces.every(nonEmpty)) problems.push("surfaces must list at least one non-empty path or glob to scan");
  if (!isStringArray(config.exclude)) problems.push("exclude must be a list of paths or globs");
  return [...problems, ...allowanceProblems(config.allowed, ids)];
}

/** The config's typed values; call only after configProblems returned nothing. */
export function readConfig(config: unknown): Config {
  if (!isRecord(config)) throw new Error("governance-alignment.json must be an object");
  const list = (value: unknown): string[] => isStringArray(value) ? value : [];
  return {
    surfaces: list(config.surfaces),
    exclude: list(config.exclude),
    staleClaims: Array.isArray(config.staleClaims) ? config.staleClaims.filter(isStaleClaim) : [],
    allowed: Array.isArray(config.allowed) ? config.allowed.filter(isAllowance) : [],
  };
}

// Only a wiki note may declare itself history. A skill, rule or script must never be able
// to opt out of the check by adding a frontmatter line.
function isSupersededNote(surface: Surface): boolean {
  if (!surface.path.startsWith("wiki/")) return false;
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(surface.text.replace(/\r\n/g, "\n"));
  return frontmatter?.[1] !== undefined && /^status:\s*"?superseded"?\s*$/m.test(frontmatter[1]);
}

export function checkGovernance(surfaces: readonly Surface[], config: Pick<Config, "staleClaims" | "allowed">): Result {
  const used = new Set<number>();
  const violations: Violation[] = [];
  const claims = config.staleClaims.map((claim) => ({ id: claim.id, re: new RegExp(claim.pattern, "i") }));
  for (const surface of surfaces) {
    if (isSupersededNote(surface)) continue;
    surface.text.replace(/\r\n/g, "\n").split("\n").forEach((line, index) => {
      for (const claim of claims.filter((candidate) => candidate.re.test(line))) {
        // Counted as used only when it excuses this claim, so a narrowed entry that never fires is reported.
        const excusing = config.allowed.flatMap((entry, position) => entry.path === surface.path
          && line.toLowerCase().includes(entry.contains.toLowerCase()) && (entry.claims?.includes(claim.id) ?? true) ? [position] : []);
        excusing.forEach((position) => used.add(position));
        if (excusing.length === 0) violations.push({ path: surface.path, line: index + 1, claim: claim.id, text: line.trim() });
      }
    });
  }
  return { violations, unusedAllowances: config.allowed.filter((_, index) => !used.has(index)) };
}

/** Exact paths or globs such as wiki/**\/*.md; ** spans directories, * stays within one. */
export function globToRegExp(pattern: string): RegExp {
  // Placeholders keep the single-star rule from rewriting the stars that ** expands to.
  const DIRS = "\u0000";
  const REST = "\u0001";
  const expanded = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, DIRS).replace(/\*\*$/, REST).replace(/\*/g, "[^/]*")
    .replace(new RegExp(DIRS, "g"), "(?:.*/)?").replace(REST, ".*");
  return new RegExp(`^${expanded}$`);
}
