// The memory note types and their fixed rules. The open-ended lists (allowed tags and
// agents) live in the schema document itself, between marker comments, so the document a
// writer reads and the list the linter enforces cannot drift apart.

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

export function allowedList(schema: string, marker: string): ReadonlySet<string> {
  const block = schema.split(`<!-- ${marker}:start -->`)[1]?.split(`<!-- ${marker}:end -->`)[0] ?? "";
  return new Set([...block.matchAll(/`([^`]+)`/g)].flatMap((match) => match[1] === undefined ? [] : [match[1]]));
}

export function missingSections(body: string, sections: readonly string[]): string[] {
  return sections.filter((section) => !new RegExp(`^## ${escapeRegExp(section)}\\s*$`, "m").test(body));
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
