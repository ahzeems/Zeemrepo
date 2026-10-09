import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWork } from "./work-tracking.ts";

// Test records are built mutable so each case can adjust a field; the validator itself only
// ever receives them as read-only WorkRecords.
type WorkRecord = { file: string; title: string; data: Record<string, unknown>; body: string };

function record(type: string, title: string, fields: Record<string, unknown> = {}): WorkRecord {
  return {
    file: `${title}.md`, title,
    data: { type, status: "backlog", owner: "human", priority: "P2", next_action: "Inspect the requested outcome.", ...fields },
    body: ["Goal", "Approach", "Acceptance criteria", "Out of scope", "Question", "Evidence", "Options", "Recommendation", "Resolution"].map((section) => `## ${section}`).join("\n"),
  };
}
function graph(): WorkRecord[] {
  return [
    record("idea", "Idea"),
    record("project", "Project", { idea: "[[Idea]]" }),
    record("map", "Map", { idea: "[[Idea]]", project: "[[Project]]", status: "clarifying" }),
    record("plan", "Plan", { idea: "[[Idea]]", project: "[[Project]]", status: "proposed" }),
    record("ticket", "Decision", { idea: "[[Idea]]", project: "[[Project]]", map: "[[Map]]", ticket_kind: "decision" }),
  ];
}
function errors(records: WorkRecord[]): string {
  const messages: string[] = [];
  validateWork(records, (_file, message) => { messages.push(message); });
  return messages.join("\n");
}
function find(records: WorkRecord[], title: string): WorkRecord {
  const result = records.find((entry) => entry.title === title);
  assert.ok(result);
  return result;
}

await test("accepts an idea, project, open map, independent proposed plan, and decision ticket", () => {
  assert.equal(errors(graph()), "");
});
await test("rejects an absent or wrong-type idea", () => {
  for (const idea of [undefined, "[[Missing]]", "[[Project]]"]) {
    const records = graph(); find(records, "Plan").data.idea = idea;
    assert.match(errors(records), /idea must link to an idea/);
  }
});
await test("rejects linking a project from another idea", () => {
  const records = graph(); records.push(record("idea", "Other idea"));
  find(records, "Project").data.idea = "[[Other idea]]";
  assert.match(errors(records), /different idea/);
});
await test("validates an idea's project without requiring a self-referential idea field", () => {
  const records = graph();
  find(records, "Idea").data.project = "[[Project]]";
  assert.equal(errors(records), "");
  for (const project of ["None", "[[Missing]]", "[[Map]]"]) {
    find(records, "Idea").data.project = project;
    assert.match(errors(records), /project must link to a project/);
  }
  records.push(record("idea", "Other idea"));
  records.push(record("project", "Other project", { idea: "[[Other idea]]" }));
  find(records, "Idea").data.project = "[[Other project]]";
  assert.match(errors(records), /different idea/);
});
await test("keeps project ownership on a ticket when its parent has a project", () => {
  const records = graph();
  delete find(records, "Decision").data.project;
  assert.match(errors(records), /map belongs to a different project/);
  find(records, "Decision").data.project = "[[Project]]";
  assert.equal(errors(records), "");
});
await test("memory links are type-checked without requiring workflow fields", () => {
  const records = graph();
  records.push({ file: "Session.md", title: "Session", body: "", data: { type: "session", idea: "[[Idea]]", project: "[[Project]]" } });
  assert.equal(errors(records), "");
  find(records, "Session").data.project = "[[Idea]]";
  assert.match(errors(records), /project must link to a project/);
});
await test("rejects a plan derived from an unresolved map", () => {
  const records = graph(); find(records, "Plan").data.map = "[[Map]]";
  assert.match(errors(records), /unresolved map/);
});
await test("rejects a completed map with an open decision ticket", () => {
  const records = graph(); Object.assign(find(records, "Map").data, { status: "done", evidence: ["OWNER DECISION: answered in the map thread"] });
  assert.match(errors(records), /completed map still has open tickets/);
});
await test("blocks build tickets before plan approval but accepts an evidenced approved plan", () => {
  const records = graph();
  records.push(record("ticket", "Build", { idea: "[[Idea]]", project: "[[Project]]", plan: "[[Plan]]", ticket_kind: "build" }));
  assert.match(errors(records), /owner-approved plan/);
  Object.assign(find(records, "Plan").data, { status: "approved", approval_ref: "#12" });
  assert.equal(errors(records), "");
});
await test("requires approval reference for an executing specification", () => {
  const records = graph(); records.push(record("spec", "Spec", { idea: "[[Idea]]", status: "in-progress" }));
  assert.match(errors(records), /need approval_ref/);
});
await test("requires a blocker, next action, priority, and owner on open work", () => {
  const records = graph(); Object.assign(find(records, "Decision").data, { status: "blocked", owner: "", next_action: "", priority: "high" });
  const result = errors(records);
  for (const required of [/concrete blocker/, /next_action/, /priority/, /owner/]) assert.match(result, required);
});
await test("requires evidence before marking work done", () => {
  const records = graph(); find(records, "Decision").data.status = "done";
  assert.match(errors(records), /done work needs evidence/);
});
await test("rejects a map used as its own ticket's prerequisite", () => {
  const records = graph(); find(records, "Decision").data.depends_on = ["[[Map]]"];
  assert.match(errors(records), /never its owning map or plan/);
});
await test("rejects a dependency cycle", () => {
  const records = graph();
  records.push(record("ticket", "Second decision", { idea: "[[Idea]]", project: "[[Project]]", map: "[[Map]]", ticket_kind: "decision", depends_on: ["[[Decision]]"] }));
  find(records, "Decision").data.depends_on = ["[[Second decision]]"];
  assert.match(errors(records), /dependency cycle/);
});
await test("blocks ready tickets until their dependencies complete", () => {
  const records = graph();
  records.push(record("ticket", "Second decision", { idea: "[[Idea]]", project: "[[Project]]", map: "[[Map]]", ticket_kind: "decision", status: "ready", depends_on: ["[[Decision]]"] }));
  assert.match(errors(records), /completed dependencies/);
  Object.assign(find(records, "Decision").data, { status: "done", evidence: ["OWNER DECISION: chose option A"] });
  assert.equal(errors(records), "");
});

await test("captures an issue before a cause or implementation plan is known", () => {
  const records = graph();
  records.push(record("issue", "Failure", { idea: "[[Idea]]", issue_kind: "environment" }));
  assert.equal(errors(records), "");
  find(records, "Failure").data.issue_kind = "guess";
  assert.match(errors(records), /issue_kind/);
});

await test("cannot close an issue without cause, fix, regression evidence, and prevention", () => {
  const records = graph();
  const fields = {
    idea: "[[Idea]]", issue_kind: "bug", status: "done", evidence: ["VERIFIED: npm test passes on the fix"],
    root_cause: "Runner did not discover assertions.", fix_ref: "Commit fixture",
    regression_evidence: "Original input fails; corrected input passes.",
    prevention: "Run the named regression test with npm test.",
  };
  records.push(record("issue", "Failure", fields));
  assert.equal(errors(records), "");
  for (const field of ["root_cause", "fix_ref", "regression_evidence", "prevention"]) {
    find(records, "Failure").data = { ...fields, type: "issue", owner: "human", priority: "P2", [field]: "" };
    assert.match(errors(records), new RegExp(`closed issues need ${field}`));
  }
});

// Build tickets of a plan flagged `job_specs: required` are job specs. The section list is
// written out here rather than imported, so the cases state the intended rule independently.
const jobSpecExtraSections = [
  "Inputs", "Allowed files", "Forbidden files", "Human checkpoints", "Secrets needed",
  "Tests and evals", "Rollback and recovery", "Evidence", "Wiki and doc updates",
];
const buildSections = ["Goal", "Approach", "Acceptance criteria", "Out of scope"];
function jobSpecGraph(planTitle: string, flag: unknown, sections: string[]): WorkRecord[] {
  const records = graph().filter((entry) => entry.title !== "Plan");
  const plan = record("plan", planTitle, { idea: "[[Idea]]", project: "[[Project]]", status: "approved", approval_ref: "#12" });
  if (flag !== undefined) plan.data.job_specs = flag;
  records.push(plan);
  const ticket = record("ticket", "Job", { idea: "[[Idea]]", project: "[[Project]]", plan: `[[${planTitle}]]`, ticket_kind: "build" });
  ticket.body = sections.map((section) => `## ${section}`).join("\n");
  records.push(ticket);
  return records;
}

await test("valid control: a complete job spec of a flagged plan is accepted", () => {
  assert.equal(errors(jobSpecGraph("Plan", "required", [...buildSections, ...jobSpecExtraSections])), "");
});
for (const missing of jobSpecExtraSections) {
  await test(`job spec: a job spec of a flagged plan missing "${missing}" is refused`, () => {
    const sections = [...buildSections, ...jobSpecExtraSections.filter((section) => section !== missing)];
    assert.match(errors(jobSpecGraph("Plan", "required", sections)), new RegExp(`missing job-spec section "## ${missing}"`));
  });
}
await test(" a ticket of an unflagged plan still needs only the four build sections", () => {
  assert.equal(errors(jobSpecGraph("Plan", undefined, buildSections)), "");
  assert.match(errors(jobSpecGraph("Plan", undefined, buildSections.slice(1))), /missing section "## Goal"/);
});
await test(" the requirement follows the flag, not the plan's title", () => {
  assert.equal(errors(jobSpecGraph("Renamed plan", "required", [...buildSections, ...jobSpecExtraSections])), "");
  assert.match(errors(jobSpecGraph("Renamed plan", "required", buildSections)), /missing job-spec section/);
});
await test(" job_specs accepts only the value required", () => {
  assert.equal(errors(jobSpecGraph("Plan", "required", [...buildSections, ...jobSpecExtraSections])), "");
  assert.match(errors(jobSpecGraph("Plan", "maybe", buildSections)), /job_specs must be "required"/);
});
await test(" job_specs is refused on any note that is not a plan", () => {
  const records = jobSpecGraph("Plan", "required", [...buildSections, ...jobSpecExtraSections]);
  assert.equal(errors(records), "");
  find(records, "Job").data.job_specs = "required";
  assert.match(errors(records), /job_specs applies only to plans/);
  const session: WorkRecord = { file: "Session.md", title: "Session", body: "", data: { type: "session", job_specs: "required" } };
  assert.match(errors([...records.filter((entry) => entry.title !== "Job"), session]), /job_specs applies only to plans/);
});

await test("evidence items must carry a label", () => {
  const records = graph();
  Object.assign(find(records, "Decision").data, { status: "done", evidence: ["it works"] });
  assert.match(errors(records), /evidence items start with VERIFIED:, INFERRED:, UNKNOWN: or OWNER DECISION:/);
  find(records, "Decision").data.evidence = ["VERIFIED: npm test passes", "INFERRED: no other callers"];
  assert.equal(errors(records), "");
});

await test("done work cannot rest on inference alone", () => {
  const records = graph();
  Object.assign(find(records, "Decision").data, { status: "done", evidence: ["INFERRED: probably fine", "UNKNOWN: not run on CI"] });
  assert.match(errors(records), /needs at least one VERIFIED: or OWNER DECISION: item/);
});

await test("open work may carry inconclusive evidence", () => {
  const records = graph();
  find(records, "Decision").data.evidence = ["UNKNOWN: waiting for the owner"];
  assert.equal(errors(records), "");
});

await test("approval_ref must name the pull request the owner merged", () => {
  const records = graph();
  records.push(record("ticket", "Build", { idea: "[[Idea]]", project: "[[Project]]", plan: "[[Plan]]", ticket_kind: "build" }));
  for (const approval of ["#12", "https://github.com/ahzeems/Zeemrepo/pull/12"]) {
    Object.assign(find(records, "Plan").data, { status: "approved", approval_ref: approval });
    assert.equal(errors(records), "", approval);
  }
  for (const approval of ["owner said yes", "12", "https://github.com/ahzeems/Zeemrepo/issues/12", "#12 and more"]) {
    find(records, "Plan").data.approval_ref = approval;
    assert.match(errors(records), /approval_ref must be the merged pull request/, approval);
  }
});
