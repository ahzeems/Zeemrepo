import type { PlannedIssue } from "./already-done.ts";

export type BlockedIssue = { id: string; title: string; blockedBy: string[] };
export type Plan = { issues: PlannedIssue[]; blocked: BlockedIssue[] };
type Issue = { message: string; path: string[] };
type Result = { value: Plan } | { issues: Issue[] };

const MAX_TITLE = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ISSUE_NUMBER = /^[1-9]\d*$/;

// The title is shown to agents and logged to a terminal. Backticks, control characters and line
// breaks are replaced rather than refused, because a code span in a title is ordinary and a
// refusal would abort the whole loop.
function cleanTitle(title: string): string {
  const cleaned = title.replace(/`/g, "'").replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").replace(/\p{Cf}+/gu, "").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, MAX_TITLE).join("").trim();
}

type Entry = { id: string; title: string; rest: Record<string, unknown> };

// The fields every entry shares: an issue number and a non-empty title.
function parseEntry(entry: unknown, at: string[]): { entry: Entry } | { problems: Issue[] } {
  if (!isRecord(entry)) return { problems: [{ message: "an issue must be an object", path: at }] };
  const { id, title, ...rest } = entry;
  const problems = Object.entries({ id, title })
    .filter(([, field]) => typeof field !== "string")
    .map(([name]) => ({ message: `${name} must be a string`, path: [...at, name] }));
  if (typeof id !== "string" || typeof title !== "string") return { problems };
  // The plan comes from a model that read untrusted issue text, and ids go into git and gh.
  if (!ISSUE_NUMBER.test(id)) return { problems: [{ message: "id must be an issue number", path: [...at, "id"] }] };
  const clean = cleanTitle(title);
  if (clean === "") return { problems: [{ message: "title must not be empty", path: [...at, "title"] }] };
  return { entry: { id, title: clean, rest } };
}

function parseIssue(entry: unknown, index: number): { issue: PlannedIssue } | { problems: Issue[] } {
  const at = ["issues", String(index)];
  const parsed = parseEntry(entry, at);
  if ("problems" in parsed) return parsed;
  const { id, title, rest } = parsed.entry;
  if (rest["branch"] !== `sandcastle/issue-${id}`) return { problems: [{ message: `branch must be sandcastle/issue-${id}`, path: [...at, "branch"] }] };
  if ("blockedBy" in rest) return { problems: [{ message: "a selected issue cannot declare blockers; list it under blocked instead", path: [...at, "blockedBy"] }] };
  return { issue: { id, title, branch: `sandcastle/issue-${id}` } };
}

// A blocked issue names the open issues that block it. The schema checks that the declaration is
// well formed, not that the model read the issue text correctly.
function parseBlocked(entry: unknown, index: number): { issue: BlockedIssue } | { problems: Issue[] } {
  const at = ["blocked", String(index)];
  const parsed = parseEntry(entry, at);
  if ("problems" in parsed) return parsed;
  const { id, title, rest } = parsed.entry;
  const refuse = (message: string): { problems: Issue[] } => ({ problems: [{ message, path: [...at, "blockedBy"] }] });
  const blockers: unknown = rest["blockedBy"];
  if (!Array.isArray(blockers)) return refuse("blockedBy must be a list of issue numbers");
  if (blockers.length === 0) return refuse("a blocked issue must name at least one blocking issue");
  const blockedBy = blockers.filter((blocker): blocker is string => typeof blocker === "string" && ISSUE_NUMBER.test(blocker));
  if (blockedBy.length !== blockers.length) return refuse("each blocker must be an issue number");
  if (blockedBy.includes(id)) return refuse("an issue cannot block itself");
  if (new Set(blockedBy).size !== blockedBy.length) return refuse("a blocker is named twice");
  return { issue: { id, title, blockedBy } };
}

function parseList<T extends { id: string }>(value: unknown, name: string, parse: (entry: unknown, index: number) => { issue: T } | { problems: Issue[] }): { list: T[] } | { problems: Issue[] } {
  if (!Array.isArray(value)) return { problems: [{ message: `${name} must be an array`, path: [name] }] };
  const parsed = value.map(parse);
  const problems = parsed.flatMap((entry) => ("problems" in entry ? entry.problems : []));
  if (problems.length > 0) return { problems };
  const list = parsed.flatMap((entry) => ("issue" in entry ? [entry.issue] : []));
  const repeated = list.findIndex((entry, index) => list.findIndex((other) => other.id === entry.id) !== index);
  if (repeated >= 0) return { problems: [{ message: "an issue appears twice in the plan", path: [name, String(repeated), "id"] }] };
  return { list };
}

function parsePlan(value: unknown): Result {
  if (!isRecord(value)) return { issues: [{ message: "the plan must be an object", path: [] }] };
  const issues = parseList(value["issues"], "issues", parseIssue);
  const blocked = parseList(value["blocked"], "blocked", parseBlocked);
  if ("problems" in issues || "problems" in blocked) {
    return { issues: [...("problems" in issues ? issues.problems : []), ...("problems" in blocked ? blocked.problems : [])] };
  }
  const both = blocked.list.findIndex((entry) => issues.list.some((issue) => issue.id === entry.id));
  if (both >= 0) return { issues: [{ message: "an issue cannot be both selected and blocked", path: ["blocked", String(both), "id"] }] };
  return { value: { issues: issues.list, blocked: blocked.list } };
}

// The Standard Schema (https://standardschema.dev) that Output.object takes, written by hand
// because the plan has two short lists; a validation library would be a dependency for that.
export const planSchema = {
  "~standard": { version: 1 as const, vendor: "zeemrepo", validate: parsePlan },
};
