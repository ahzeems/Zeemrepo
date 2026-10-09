import { isExempt, isOperatingDoc, isWorkflowCritical } from "../lib/change-policy.ts";
import { CHANGELOG, WORK_DIR } from "../lib/paths.ts";

// The repo-memory rule. Pure; the CLI lives in repo-memory-guard.ts. If it lands, the wiki
// records why: a branch updates its owning work record under wiki/work/ with labelled
// evidence and a changed status or next action, and a workflow change updates the operating
// documents that describe it. The changelog entry belongs to the changelog guard.

// Evidence is the labelled kind wiki:lint enforces; only a checked result or an owner
// decision counts here. Phrases that say the check did not happen void the line.
const EVIDENCE = /\b(VERIFIED|OWNER DECISION):\s*\S/;
const ABSENT = /\b(todo|pending|unverified|not yet (run|verified|checked)|will (run|verify|check)|no evidence)\b/i;
const STATUS_FIELD = /^\s*(status|next_action)\s*:/i;
// The escape hatch carries its reason inline. Inline code is stripped first, so a document
// explaining the hatch does not use it by accident.
const NOT_APPLICABLE = /\[no-doc-change:\s*\S[^\]]*\]/i;

const withoutCode = (line: string): string => line.replace(/`[^`]*`/g, "");

function recordRefusals(records: readonly string[], added: readonly string[]): string[] {
  if (records.length === 0) {
    return [`This branch updates no work record under ${WORK_DIR}. Update the owning record; a new note must be staged to be seen.`];
  }
  const refusals: string[] = [];
  if (!added.some((line) => EVIDENCE.test(line) && !ABSENT.test(line))) {
    refusals.push("The work record gains no VERIFIED: or OWNER DECISION: evidence. Name the check that ran; a promise to run it is not a result.");
  }
  if (!added.some((line) => STATUS_FIELD.test(line))) {
    refusals.push("The work record's status and next action are unchanged. Update whichever the schema asks for.");
  }
  return refusals;
}

export function memoryRefusals(changed: readonly string[], addedRecordLines: readonly string[]): string[] {
  const relevant = changed.filter((file) => file !== CHANGELOG && !isExempt(file));
  if (relevant.length === 0) return [];
  const refusals = recordRefusals(changed.filter((file) => file.startsWith(WORK_DIR)), addedRecordLines);
  const workflow = changed.filter(isWorkflowCritical);
  if (workflow.length === 0 || changed.some(isOperatingDoc)) return refusals;
  if (addedRecordLines.some((line) => NOT_APPLICABLE.test(withoutCode(line)))) return refusals;
  return [...refusals, `This branch changes workflow-critical files (${workflow[0] ?? ""}) without updating a decision, reference or runbook. Update the document, or write [no-doc-change: reason] in the work record.`];
}
