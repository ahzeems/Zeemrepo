// The memory note types and their fixed rules. Allowed tags live in the schema document
// between marker comments, so the writer's document and the linter's list cannot drift.
// Author identifiers are open to every provider and validated by shape, not an allowlist.

import { markdownTokens } from "../lib/markdown.ts";

export type TypeSpec = { folder: string; sections: readonly string[] };

export const MEMORY_TYPES: ReadonlyMap<string, TypeSpec> = new Map([
  ["session", { folder: "sessions", sections: ["Goal", "What was done", "Outcome", "Open items"] }],
  ["runbook", { folder: "runbooks", sections: ["When to use", "Prerequisites", "Steps", "Verify"] }],
  ["lesson", { folder: "lessons", sections: ["What happened", "Fix", "How to apply"] }],
  ["decision", { folder: "decisions", sections: ["Context", "Decision", "Consequences"] }],
  ["reference", { folder: "reference", sections: [] }],
]);

export const MEMORY_STATUSES: readonly string[] = ["active", "draft", "superseded"];
export const REQUIRED_STRINGS: readonly string[] = ["type", "title", "summary", "created", "updated", "agent", "status"];

// Only list items count (`- \`area/git\``): a backticked word in prose between the markers
// would otherwise widen the allowlist without anyone meaning to.
export function allowedList(schema: string, marker: string): ReadonlySet<string> {
  const block = schema.split(`<!-- ${marker}:start -->`)[1]?.split(`<!-- ${marker}:end -->`)[0] ?? "";
  return new Set([...block.matchAll(/^\s*-\s+`([^`]+)`\s*$/gm)].flatMap((match) => match[1] === undefined ? [] : [match[1]]));
}

// A section is a visible level-2 heading at the top level of the body (not in a quote or list)
// whose source text is exactly the name. Comments, fences and indented code hide headings, so
// they cannot satisfy a requirement; `## **Fix**` is a different heading from `## Fix`.
export function missingSections(body: string, sections: readonly string[]): string[] {
  const tokens = markdownTokens(body);
  const headings = new Set(tokens.flatMap((token, index) =>
    token.type === "heading_open" && token.tag === "h2" && token.level === 0 ? [tokens[index + 1]?.content ?? ""] : []));
  return sections.filter((section) => !headings.has(section));
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
