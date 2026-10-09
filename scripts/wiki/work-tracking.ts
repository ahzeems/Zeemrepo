import { isStringArray, stringValue } from "../lib/record.ts";
import { missingSections, type TypeSpec } from "./schema.ts";

export const WORK_TYPES: ReadonlyMap<string, TypeSpec> = new Map([
  ["idea", { folder: "work/ideas", sections: ["Problem", "Desired outcome", "Next step"] }],
  ["project", { folder: "work/projects", sections: ["Outcome", "Scope", "Acceptance criteria", "Work links"] }],
  ["map", { folder: "work/maps", sections: ["Destination", "Notes", "Open decisions", "Decisions so far", "Not yet specified", "Out of scope"] }],
  ["plan", { folder: "work/plans", sections: ["Problem", "Destination", "Constraints", "Decisions", "Test seams", "Implementation slices", "Acceptance criteria", "Out of scope"] }],
  ["ticket", { folder: "work/tickets", sections: [] }],
  ["spec", { folder: "work/specs", sections: ["Behavior", "Constraints", "Acceptance criteria"] }],
  ["research", { folder: "work/research", sections: ["Question", "Sources", "Findings", "Implications"] }],
  ["issue", { folder: "work/issues", sections: ["Reproduction", "Expected and actual", "Root cause", "Fix", "Verification", "Prevention"] }],
]);
export const WORK_STATUSES: readonly string[] = ["backlog", "clarifying", "proposed", "approved", "ready", "in-progress", "blocked", "in-review", "done", "parked", "superseded"];
// A plan flagged `job_specs: required` makes each build ticket a job spec: these sections in
// addition to the four every build ticket carries. note-schema.md quotes this list.
export const JOB_SPEC_SECTIONS: readonly string[] = [
  "Inputs", "Allowed files", "Forbidden files", "Human checkpoints", "Secrets needed",
  "Tests and evals", "Rollback and recovery", "Evidence", "Wiki and doc updates",
];

export type WorkRecord = { file: string; title: string; data: Readonly<Record<string, unknown>>; body: string };
export type Fail = (file: string, message: string) => void;

const TICKET_KINDS = ["build", "decision", "research", "prototype", "prerequisite"];
const BUILD_SECTIONS = ["Goal", "Approach", "Acceptance criteria", "Out of scope"];
const QUESTION_SECTIONS = ["Question", "Evidence", "Options", "Recommendation", "Resolution"];
const TERMINAL = new Set(["done", "parked", "superseded"]);
const STARTED = new Set(["in-progress", "in-review", "done"]);
// Evidence says how a claim is known. Done work must rest on something checked or decided,
// not on inference alone.
const EVIDENCE_LABEL = /^(VERIFIED|INFERRED|UNKNOWN|OWNER DECISION): \S/;
const STRONG_EVIDENCE = /^(VERIFIED|OWNER DECISION): /;
// Work lands only by pull request, so a plan's approval is the PR the owner merged.
const PULL_REQUEST = /^(#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+)$/;

const linkTarget = (value: unknown): string | undefined => stringValue(value).match(/^\[\[([^[\]#|\n]+)\]\]$/)?.[1];

type Graph = { byTitle: ReadonlyMap<string, WorkRecord>; records: readonly WorkRecord[]; fail: Fail };

// Resolves a relationship field to its record, checking type and shared ownership.
function reference(graph: Graph, record: WorkRecord, field: string, type: string, required: boolean): WorkRecord | undefined {
  const value = record.data[field];
  if (value === undefined && !required) return undefined;
  const title = linkTarget(value);
  const linked = title === undefined ? undefined : graph.byTitle.get(title);
  if (linked?.data.type !== type) {
    graph.fail(record.file, `${field} must link to ${type === "idea" ? "an" : "a"} ${type} note by its exact title`);
    return undefined;
  }
  const idea = record.data.type === "idea" ? `[[${record.title}]]` : record.data.idea;
  if (field !== "idea" && linked.data.idea !== idea) graph.fail(record.file, `${field} belongs to a different idea`);
  if ((field === "map" || field === "plan") && linked.data.project !== record.data.project) {
    graph.fail(record.file, `${field} belongs to a different project`);
  }
  return linked;
}

function checkCommonFields(graph: Graph, record: WorkRecord): void {
  const { data, file } = record;
  const status = stringValue(data.status);
  if (!stringValue(data.owner).trim()) graph.fail(file, "work notes need an owner role or agent name");
  if (!["P0", "P1", "P2", "P3"].includes(stringValue(data.priority))) graph.fail(file, "priority must be P0, P1, P2, or P3");
  if (!TERMINAL.has(status) && !stringValue(data.next_action).trim()) graph.fail(file, "open work needs next_action");
  if (status === "blocked" && !stringValue(data.blocker).trim()) graph.fail(file, "blocked work needs a concrete blocker");
  checkEvidence(graph, record);
}

function checkEvidence(graph: Graph, { data, file }: WorkRecord): void {
  const evidence = data.evidence;
  if (evidence !== undefined) {
    if (!isStringArray(evidence) || evidence.some((item) => !item.trim())) {
      graph.fail(file, "evidence must be a list of nonempty references");
      return;
    }
    if (!evidence.every((item) => EVIDENCE_LABEL.test(item))) {
      graph.fail(file, "evidence items start with VERIFIED:, INFERRED:, UNKNOWN: or OWNER DECISION:");
    }
  }
  if (data.status !== "done") return;
  if (!isStringArray(evidence) || evidence.length === 0) graph.fail(file, "done work needs evidence");
  else if (!evidence.some((item) => STRONG_EVIDENCE.test(item))) {
    graph.fail(file, "done work needs at least one VERIFIED: or OWNER DECISION: item");
  }
}

function checkIssue(graph: Graph, { data, file }: WorkRecord): void {
  if (!["bug", "environment", "documentation"].includes(stringValue(data.issue_kind))) {
    graph.fail(file, "issue_kind must be bug, environment, or documentation");
  }
  if (data.status !== "done") return;
  for (const field of ["root_cause", "fix_ref", "regression_evidence", "prevention"]) {
    if (!stringValue(data[field]).trim()) graph.fail(file, `closed issues need ${field}`);
  }
}

// Ready means cleared to start, so it needs approval as much as approved or executing work.
const NEEDS_APPROVAL = new Set(["approved", "ready", ...STARTED]);

function checkApproval(graph: Graph, { data, file }: WorkRecord): void {
  if (!NEEDS_APPROVAL.has(stringValue(data.status))) return;
  const approval = stringValue(data.approval_ref).trim();
  if (!approval) graph.fail(file, "approved, ready or executing plans and specs need approval_ref");
  else if (!PULL_REQUEST.test(approval)) graph.fail(file, "approval_ref must be the merged pull request: #N or its GitHub URL");
}

function checkTicket(graph: Graph, record: WorkRecord): void {
  const { data, file, body } = record;
  const kind = stringValue(data.ticket_kind);
  if (!TICKET_KINDS.includes(kind)) graph.fail(file, "ticket_kind must be build, decision, research, prototype, or prerequisite");
  const build = kind === "build";
  const parent = build ? reference(graph, record, "plan", "plan", true) : reference(graph, record, "map", "map", true);
  const approvedParent = ["approved", "in-progress", "in-review", "done"].includes(stringValue(parent?.data.status))
    && stringValue(parent?.data.approval_ref).trim() !== "";
  if (build && parent && !approvedParent) graph.fail(file, "build tickets require an owner-approved plan with approval_ref");
  for (const section of missingSections(body, build ? BUILD_SECTIONS : QUESTION_SECTIONS)) graph.fail(file, `missing section "## ${section}"`);
  if (build && parent?.data.job_specs === "required") {
    for (const section of missingSections(body, JOB_SPEC_SECTIONS)) graph.fail(file, `missing job-spec section "## ${section}"`);
  }
  checkDependencies(graph, record);
}

function checkDependencies(graph: Graph, { data, file, title }: WorkRecord): void {
  if (data.depends_on === undefined) return;
  if (!isStringArray(data.depends_on)) {
    graph.fail(file, "depends_on must be a list of ticket wikilinks");
    return;
  }
  const status = stringValue(data.status);
  for (const link of data.depends_on) {
    const dependency = graph.byTitle.get(linkTarget(link) ?? "");
    if (dependency?.data.type !== "ticket") {
      graph.fail(file, "depends_on must link to a ticket, never its owning map or plan");
      continue;
    }
    if (dependency.title === title) graph.fail(file, "a ticket cannot depend on itself");
    if (dependency.data.idea !== data.idea) graph.fail(file, "dependency belongs to a different idea");
    if ((status === "ready" || STARTED.has(status)) && dependency.data.status !== "done") {
      graph.fail(file, "ready or executing tickets must have completed dependencies");
    }
  }
}

function checkWorkRecord(graph: Graph, record: WorkRecord): void {
  const type = stringValue(record.data.type);
  checkCommonFields(graph, record);
  if (type !== "idea") reference(graph, record, "idea", "idea", true);
  if (type !== "project") reference(graph, record, "project", "project", false);
  if (type === "plan") {
    const map = reference(graph, record, "map", "map", false);
    if (map && map.data.status !== "done") graph.fail(record.file, "a plan cannot depend on an unresolved map");
  }
  if (type === "map" && record.data.status === "done") {
    const open = graph.records.some((ticket) => ticket.data.map === `[[${record.title}]]` && !TERMINAL.has(stringValue(ticket.data.status)));
    if (open) graph.fail(record.file, "a completed map still has open tickets");
  }
  if (type === "issue") checkIssue(graph, record);
  if (type === "plan" || type === "spec") checkApproval(graph, record);
  if (type === "ticket") checkTicket(graph, record);
}

// Follows the declared dependency edges; an unresolved cycle has no first ticket.
function checkCycles(graph: Graph): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (record: WorkRecord): void => {
    if (visiting.has(record.title)) {
      graph.fail(record.file, "ticket dependency cycle");
      return;
    }
    if (visited.has(record.title)) return;
    visiting.add(record.title);
    const dependencies = record.data.depends_on;
    for (const link of isStringArray(dependencies) ? dependencies : []) {
      const next = graph.byTitle.get(linkTarget(link) ?? "");
      if (next?.data.type === "ticket") visit(next);
    }
    visiting.delete(record.title);
    visited.add(record.title);
  };
  for (const record of graph.records) if (record.data.type === "ticket") visit(record);
}

export function validateWork(records: readonly WorkRecord[], fail: Fail): void {
  const graph: Graph = { byTitle: new Map(records.map((record) => [record.title, record])), records, fail };
  for (const record of records) {
    const { data, file } = record;
    if (data.job_specs !== undefined) {
      if (data.type !== "plan") fail(file, "job_specs applies only to plans");
      else if (data.job_specs !== "required") fail(file, 'job_specs must be "required" when present');
    }
    if (WORK_TYPES.has(stringValue(data.type))) {
      checkWorkRecord(graph, record);
    } else {
      // Memory notes may point at their work; those links are type-checked but nothing more.
      if (data.idea !== undefined || data.project !== undefined) reference(graph, record, "idea", "idea", true);
      reference(graph, record, "project", "project", false);
    }
  }
  checkCycles(graph);
}
