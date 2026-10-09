import { isExempt, isOperatingDoc, isWorkflowCritical } from "../lib/change-policy.ts";
import { isStringArray, stringValue } from "../lib/record.ts";
import { CHANGELOG, WORK_DIR } from "../lib/paths.ts";

// The repo-memory rule. Pure; the CLI lives in repo-memory-guard.ts. If it lands, the wiki
// records why: one owning work record under wiki/work/ gains labelled evidence and a changed
// status or next action (compared field by field with the base, not by loose added lines),
// and a workflow change adds content to an operating document. The changelog belongs to the
// changelog guard.

type Fields = Readonly<Record<string, unknown>>;
/** A changed work record: its frontmatter and text at the base (null if new) and now (null if deleted). */
export type RecordChange = { path: string; before: Fields | null; after: Fields | null; beforeText: string; afterText: string };
export type MemoryInput = { changed: readonly string[]; records: readonly RecordChange[]; addedOperatingDocLines: readonly string[] };

// Only a checked result or an owner decision counts. Phrases that say the check did not
// happen void the item; they are scoped to such phrases so an unrelated clause
// ("npm run check passes; CI is not configured yet") keeps its result.
const EVIDENCE = /^(VERIFIED|OWNER DECISION):\s*\S/;
const ABSENT = new RegExp([
  "\\b(todo|tbd|fixme|pending|unverified|skipped)\\b", "\\bn/?a\\b", "\\bno evidence\\b",
  "\\b(not|never|cannot be|could not be)\\s+(yet\\s+)?(run|verified|checked)\\b",
  "\\bnothing\\s+(verified|run|checked)\\b", "\\bwill\\s+(run|verify|check)\\b",
].join("|"), "i");
// The escape hatch carries a real reason. Code (inline and fenced) is stripped first, so a
// document explaining the hatch does not use it by accident.
const NOT_APPLICABLE = /\[no-doc-change:\s*([^\]]*)\]/gi;
const MIN_REASON = 10;

const evidenceOf = (fields: Fields | null): string[] => isStringArray(fields?.evidence) ? fields.evidence : [];

function hasNewEvidence(record: RecordChange): boolean {
  const old = new Set(evidenceOf(record.before));
  return evidenceOf(record.after).some((item) => !old.has(item) && EVIDENCE.test(item) && !ABSENT.test(item));
}

function hasStatusChange(record: RecordChange): boolean {
  if (record.before === null) return true;
  return ["status", "next_action"].some((field) => stringValue(record.after?.[field]) !== stringValue(record.before?.[field]));
}

function hatches(text: string): number {
  const prose = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");
  return [...prose.matchAll(NOT_APPLICABLE)].filter((match) => (match[1] ?? "").trim().length >= MIN_REASON).length;
}

function recordRefusals(records: readonly RecordChange[]): string[] {
  const live = records.filter((record) => record.after !== null);
  if (live.length === 0) return [`This branch updates no work record under ${WORK_DIR}. Update the owning record.`];
  if (live.some((record) => hasNewEvidence(record) && hasStatusChange(record))) return [];
  const refusals: string[] = [];
  const anyEvidence = live.some(hasNewEvidence);
  const anyStatus = live.some(hasStatusChange);
  if (!anyEvidence) refusals.push("The work record gains no VERIFIED: or OWNER DECISION: evidence item. Name the check that ran; a promise to run it is not a result.");
  if (!anyStatus) refusals.push("The work record's status and next action are unchanged. Update whichever the schema asks for.");
  if (anyEvidence && anyStatus) refusals.push("New evidence and the status change are on different records; put both on the same work record.");
  return refusals;
}

export function memoryRefusals({ changed, records, addedOperatingDocLines }: MemoryInput): string[] {
  const relevant = changed.filter((file) => file !== CHANGELOG && !isExempt(file));
  if (relevant.length === 0) return [];
  const refusals = recordRefusals(records);
  const workflow = changed.filter(isWorkflowCritical);
  if (workflow.length === 0) return refusals;
  const documented = changed.some(isOperatingDoc) && addedOperatingDocLines.some((line) => line.trim() !== "");
  const exempted = records.some((record) => hatches(record.afterText) > hatches(record.beforeText));
  if (documented || exempted) return refusals;
  return [...refusals, `This branch changes workflow-critical files (${workflow[0] ?? ""}) without adding to a decision, reference or runbook. Update the document, or write [no-doc-change: <reason>] in the work record.`];
}
