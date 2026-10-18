import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, type Output } from "../lib/cli.ts";
import { main } from "./wiki-compliance.ts";
import { historyFindings, type NoteChange } from "./wiki-history.ts";

type Run = { code: number; out: string; err: string };
type Fields = { type: string; title: string; created?: string; updated?: string; agent?: string; status?: string; summary?: string; tags?: string; extra?: string };

const DAY = "2026-10-01";
const LATER = "2026-10-05";
const DECISION = "wiki/decisions/ADR-0001 Keep a wiki.md";
const SESSION = "wiki/sessions/2026-10-01 First session.md";
const RUNBOOK = "wiki/runbooks/Do a thing.md";
const TEMPLATE = "wiki/templates/decision.md";

function note(fields: Fields, body: string): string {
  const lines = [
    "---", `type: ${fields.type}`, `title: ${fields.title}`, `summary: ${fields.summary ?? "A synthetic note for history tests."}`,
    `tags: ${fields.tags ?? "[area/wiki]"}`, `created: ${fields.created ?? DAY}`, `updated: ${fields.updated ?? DAY}`,
    `agent: ${fields.agent ?? "fixture-agent"}`, `status: ${fields.status ?? "active"}`,
  ];
  if (fields.extra !== undefined) lines.push(fields.extra);
  return `${[...lines, "---"].join("\n")}\n${body}`;
}

const decision = (fields: Partial<Fields> = {}, body = "## Context\n\nOriginal reasons.\n"): string =>
  note({ type: "decision", title: "ADR-0001 Keep a wiki", ...fields }, body);
const session = (fields: Partial<Fields> = {}, body = "## Goal\n\nOriginal goal.\n"): string =>
  note({ type: "session", title: "2026-10-01 First session", ...fields }, body);
const runbook = (fields: Partial<Fields> = {}, body = "## Steps\n\nOriginal steps.\n"): string =>
  note({ type: "runbook", title: "Do a thing", ...fields }, body);

type HistoryRepo = RepoFixture & { commitAt(message: string, day: string, committerDay?: string): string; check(...args: string[]): Run };

// Every commit date is pinned, so the verdict cannot depend on the day the test runs. The
// commit object is written by hand because test code may not set GIT_ variables such as
// GIT_COMMITTER_DATE (scripts/toolchain/fixture-env.test.ts), and --date sets only the author.
function commitAt(repo: RepoFixture, message: string, day: string, committerDay = day): string {
  repo.git(["add", "--all"]);
  const tree = repo.git(["write-tree"]);
  const head = repo.git(["for-each-ref", "--format=%(objectname)", repo.git(["symbolic-ref", "HEAD"])]);
  const merging = existsSync(join(repo.dir, ".git", "MERGE_HEAD"));
  const parents = [head, ...(merging ? [repo.git(["rev-parse", "MERGE_HEAD"])] : [])].filter((sha) => sha !== "");
  const stamp = (at: string): string => `Fixture <fixture@example.invalid> ${String(Date.parse(`${at}T12:00:00Z`) / 1000)} +0000`;
  const object = [`tree ${tree}`, ...parents.map((sha) => `parent ${sha}`), `author ${stamp(day)}`, `committer ${stamp(committerDay)}`, "", message, ""].join("\n");
  const sha = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], { cwd: repo.dir, env: cleanGitEnv, input: object, encoding: "utf8" }).trim();
  repo.git(["update-ref", "HEAD", sha]);
  if (merging) repo.git(["merge", "--quit"]);
  return sha;
}

function checker(dir: string): (...args: string[]) => Run {
  return (...args) => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { write: (line) => out.push(line), warn: (line) => err.push(line) };
    const code = main(args, { cwd: dir, output });
    return { code, out: out.join("\n"), err: err.join("\n") };
  };
}

function history(t: TestContext): HistoryRepo {
  const repo = createRepo("wiki-history-");
  t.after(() => repo.cleanup());
  repo.write("wiki/Home.md", "# Wiki\n");
  repo.write(DECISION, decision());
  repo.write(SESSION, session());
  repo.write(RUNBOOK, runbook());
  repo.write(TEMPLATE, note({ type: "decision", title: "decision" }, "## Context\n"));
  repo.git(["update-ref", "refs/remotes/origin/main", commitAt(repo, "base", DAY)]);
  repo.git(["switch", "--quiet", "-c", "feature"]);
  return { ...repo, commitAt: (message, day, committerDay) => commitAt(repo, message, day, committerDay), check: checker(repo.dir) };
}

await test("historical wiki notes, judged against the branch's base", async (t) => {
  await t.test("a same-day edit of a session body passes", (t) => {
    const repo = history(t);
    repo.write(SESSION, session({}, "## Goal\n\nOriginal goal, with an addition made the same day.\n"));
    repo.commitAt("docs(wiki): extend the session", DAY);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later supersession that changes only status, superseded_by and updated passes", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER, status: "superseded", extra: 'superseded_by: "[[ADR-0002 Replace it]]"' }));
    repo.commitAt("docs(wiki): supersede ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later decision body rewrite is refused", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER }, "## Context\n\nRewritten reasons.\n"));
    repo.commitAt("docs(wiki): rewrite ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[body\].*ADR-0001 Keep a wiki\.md/);
    assert.match(result.err, /supersed/i);
  });

  await t.test("a later session body edit is refused", (t) => {
    const repo = history(t);
    repo.write(SESSION, session({ updated: LATER }, "## Goal\n\nOriginal goal.\n\nAppended days later.\n"));
    repo.commitAt("docs(wiki): append to the session", LATER);
    assert.match(repo.check().err, /\[body\].*First session\.md/);
  });

  await t.test("a later change to a decision's related links and tags passes (OWNER DECISION, 2026-10-18)", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER, tags: "[area/wiki, area/git]", extra: 'related: ["[[ADR-0002 Replace it]]"]' }));
    repo.commitAt("docs(wiki): link and retag ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later title change on a decision is still refused", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER, title: "ADR-0001 Keep a vault" }));
    repo.commitAt("docs(wiki): retitle ADR-0001", LATER);
    assert.match(repo.check().err, /\[metadata\].*title/);
  });

  await t.test("a later change to other metadata of a decision is refused", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER, summary: "A rewritten summary." }));
    repo.commitAt("docs(wiki): reword ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[metadata\].*summary/);
  });

  await t.test("a later status change other than supersession is refused", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER, status: "draft" }));
    repo.commitAt("docs(wiki): demote ADR-0001", LATER);
    assert.match(repo.check().err, /\[metadata\].*status may only become superseded/);
  });

  await t.test("changing created or agent on any note is refused, even the same day", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ created: "2026-09-30", agent: "someone-else" }));
    repo.commitAt("docs(wiki): rewrite the runbook's origin", DAY);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[immutable\].*created/);
    assert.match(result.err, /\[immutable\].*agent/);
  });

  await t.test("removing created is refused like changing it", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook().replace(`created: ${DAY}\n`, ""));
    repo.commitAt("docs(wiki): drop created", DAY);
    assert.match(repo.check().err, /\[immutable\].*created/);
  });

  await t.test("a later edit that leaves updated unchanged is refused", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({}, "## Steps\n\nNew steps.\n"));
    repo.commitAt("docs(wiki): change the steps", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[updated\].*Do a thing\.md/);
  });

  await t.test("an edit that moves updated backwards is refused", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ updated: "2026-09-30" }, "## Steps\n\nNew steps.\n"));
    repo.commitAt("docs(wiki): change the steps", DAY);
    assert.match(repo.check().err, /\[updated\]/);
  });

  await t.test("a later runbook edit with a new updated date passes", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ updated: LATER }, "## Steps\n\nNew steps.\n"));
    repo.commitAt("docs(wiki): change the steps", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later rename of a decision is refused", (t) => {
    const repo = history(t);
    repo.git(["mv", DECISION, "wiki/decisions/ADR-0001 Keep a vault.md"]);
    repo.commitAt("docs(wiki): rename ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /Keep a wiki\.md/);
  });

  await t.test("a later rename that also rewrites the body cannot escape as a new note", (t) => {
    const repo = history(t);
    repo.git(["rm", "--quiet", DECISION]);
    repo.write("wiki/decisions/ADR-0001 Something else.md", note({ type: "decision", title: "ADR-0001 Something else", created: LATER, updated: LATER }, "## Context\n\nEntirely new.\n"));
    repo.commitAt("docs(wiki): replace ADR-0001", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    // Whether git pairs the two as a rename depends on similarity; either way the old note is judged.
    assert.match(result.err, /\[(?:deleted|renamed)\].*Keep a wiki\.md/);
  });

  await t.test("a later deletion of a session is refused", (t) => {
    const repo = history(t);
    repo.git(["rm", "--quiet", SESSION]);
    repo.commitAt("docs(wiki): drop the session", LATER);
    assert.match(repo.check().err, /\[deleted\].*First session\.md/);
  });

  await t.test("moving a decision out of the wiki is a deletion", (t) => {
    const repo = history(t);
    repo.git(["rm", "--quiet", DECISION]);
    repo.commitAt("docs(wiki): move ADR-0001 out", LATER);
    repo.write("docs/ADR-0001.md", decision());
    repo.commitAt("docs: keep ADR-0001 elsewhere", LATER);
    assert.match(repo.check().err, /\[deleted\].*Keep a wiki\.md/);
  });

  await t.test("a later edit of a decision template is not judged as a decision", (t) => {
    const repo = history(t);
    repo.write(TEMPLATE, note({ type: "decision", title: "decision", updated: LATER }, "## Context\n\n## Decision\n"));
    repo.commitAt("docs(wiki): extend the template", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("deleting an ordinary note is not judged here", (t) => {
    const repo = history(t);
    repo.git(["rm", "--quiet", RUNBOOK]);
    repo.commitAt("docs(wiki): retire the runbook", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later edit of a decision added on this branch is judged once it reaches main", (t) => {
    const repo = history(t);
    const path = "wiki/decisions/ADR-0002 New.md";
    repo.write(path, note({ type: "decision", title: "ADR-0002 New" }, "## Context\n\nNew.\n"));
    repo.commitAt("docs(wiki): add ADR-0002", DAY);
    repo.write(path, note({ type: "decision", title: "ADR-0002 New", updated: LATER }, "## Context\n\nChanged later.\n"));
    repo.commitAt("docs(wiki): change ADR-0002", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a merged main's own later supersession is not charged to the branch", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ updated: LATER }, "## Steps\n\nBranch steps.\n"));
    repo.commitAt("docs(wiki): branch steps", LATER);
    repo.git(["switch", "--quiet", "-c", "main-moved", "refs/remotes/origin/main"]);
    repo.write(DECISION, decision({ updated: LATER, status: "superseded", extra: 'superseded_by: "[[ADR-0002 Replace it]]"' }));
    repo.git(["update-ref", "refs/remotes/origin/main", repo.commitAt("docs(wiki): supersede on main", LATER)]);
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--quiet", "--no-edit", "main-moved"]);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later merge that only resolves a conflict does not date the branch's edit", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({}, "## Steps\n\nBranch steps.\n"));
    repo.commitAt("docs(wiki): branch steps", DAY);
    repo.git(["switch", "--quiet", "-c", "main-moved", "refs/remotes/origin/main"]);
    repo.write(RUNBOOK, runbook({}, "## Steps\n\nMain steps.\n"));
    repo.git(["update-ref", "refs/remotes/origin/main", repo.commitAt("docs(wiki): main steps", DAY)]);
    repo.git(["switch", "--quiet", "feature"]);
    assert.throws(() => repo.git(["merge", "--quiet", "--no-edit", "main-moved"]), "the steps conflict");
    repo.write(RUNBOOK, runbook({}, "## Steps\n\nMain steps.\nBranch steps.\n"));
    repo.commitAt("Merge main-moved into feature", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later clean merge of main into the same note does not date the branch's edit", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({}, "## Steps\n\nOriginal steps.\n\n\n\n\nBranch tail.\n"));
    repo.commitAt("docs(wiki): branch tail", DAY);
    repo.git(["switch", "--quiet", "-c", "main-moved", "refs/remotes/origin/main"]);
    repo.write(RUNBOOK, runbook({}, "Main head.\n\n\n\n\n## Steps\n\nOriginal steps.\n"));
    repo.git(["update-ref", "refs/remotes/origin/main", repo.commitAt("docs(wiki): main head", DAY)]);
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-commit", "main-moved"]);
    repo.commitAt("Merge main-moved into feature", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_OK, result.err);
  });

  await t.test("a later merge that writes its own lines dates the edit", (t) => {
    const repo = history(t);
    repo.write(SESSION, session({}, "## Goal\n\nOriginal goal, extended the same day.\n"));
    repo.commitAt("docs(wiki): extend the session", DAY);
    repo.git(["switch", "--quiet", "-c", "side", "refs/remotes/origin/main"]);
    repo.write("scripts/a.ts", "export const a = 1;\n");
    repo.commitAt("feat: side", DAY);
    repo.git(["switch", "--quiet", "feature"]);
    repo.git(["merge", "--quiet", "--no-ff", "--no-commit", "side"]);
    repo.write(SESSION, session({}, "## Goal\n\nOriginal goal, extended the same day.\n\nSlipped in during a later merge.\n"));
    repo.commitAt("docs(wiki): merge side", LATER);
    assert.match(repo.check().err, /\[body\].*First session\.md/);
  });

  await t.test("a later committer date dates the edit even when the author date is the note's day", (t) => {
    const repo = history(t);
    repo.write(SESSION, session({}, "## Goal\n\nOriginal goal, amended later.\n"));
    repo.commitAt("docs(wiki): amend the session", DAY, LATER);
    assert.match(repo.check().err, /\[body\].*First session\.md/);
  });

  await t.test("a later author date dates the edit even when the committer date is the note's day", (t) => {
    const repo = history(t);
    repo.write(SESSION, session({}, "## Goal\n\nOriginal goal, written later.\n"));
    repo.commitAt("docs(wiki): extend the session", LATER, DAY);
    assert.match(repo.check().err, /\[body\].*First session\.md/);
  });

  await t.test("a commit dated on the note's day cannot hide a later parent", (t) => {
    const repo = history(t);
    repo.write("scripts/a.ts", "export const a = 1;\n");
    repo.commitAt("feat: later work", LATER);
    repo.write(DECISION, decision({}, "## Context\n\nRewritten under an earlier date.\n"));
    repo.commitAt("docs(wiki): backdated rewrite", DAY);
    assert.match(repo.check().err, /\[body\].*ADR-0001 Keep a wiki\.md/);
  });

  await t.test("a backdated merge cannot hide later parents", (t) => {
    const repo = history(t);
    repo.git(["switch", "--quiet", "-c", "side", "refs/remotes/origin/main"]);
    repo.write("scripts/a.ts", "export const a = 1;\n");
    repo.commitAt("feat: side", LATER);
    repo.git(["switch", "--quiet", "feature"]);
    repo.write("scripts/b.ts", "export const b = 1;\n");
    repo.commitAt("feat: branch", LATER);
    repo.git(["merge", "--quiet", "--no-ff", "--no-commit", "side"]);
    repo.write(DECISION, decision({}, "## Context\n\nRewritten in a backdated merge.\n"));
    repo.commitAt("docs(wiki): merge side", DAY);
    assert.match(repo.check().err, /\[body\].*ADR-0001 Keep a wiki\.md/);
  });

  await t.test("an edit at a note's new path after a rename is dated too", (t) => {
    const repo = history(t);
    const moved = "wiki/runbooks/Do the thing.md";
    repo.git(["mv", RUNBOOK, moved]);
    repo.commitAt("docs(wiki): rename the runbook", DAY);
    repo.write(moved, runbook({}, "## Steps\n\nOriginal steps, changed later.\n"));
    repo.commitAt("docs(wiki): change the steps", LATER);
    assert.match(repo.check().err, /\[updated\].*Do a thing\.md.*2026-10-05/);
  });

  await t.test("an updated date after the edit is refused", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ updated: "2027-01-01" }, "## Steps\n\nNew steps.\n"));
    repo.commitAt("docs(wiki): change the steps", LATER);
    const result = repo.check();
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /\[updated\].*2027-01-01/);
  });

  await t.test("--json lists history violations beside commit violations", (t) => {
    const repo = history(t);
    repo.write(DECISION, decision({ updated: LATER }, "## Context\n\nRewritten.\n"));
    repo.commitAt("docs(wiki): rewrite ADR-0001", LATER);
    const result = repo.check("--json");
    assert.equal(result.code, EXIT_REFUSED);
    const parsed: unknown = JSON.parse(result.out);
    assert.ok(typeof parsed === "object" && parsed !== null && "compliant" in parsed && parsed.compliant === false);
    assert.ok("history" in parsed, result.out);
    const recorded = JSON.stringify(parsed.history);
    assert.match(recorded, /^\{"violations":\[\{"path":"wiki\/decisions\/ADR-0001 Keep a wiki\.md","kind":"body","detail":"[^"]+"\}\],"unverified":\[\]\}$/);
  });
});

await test("history that cannot be read is an error, never a pass", async (t) => {
  await t.test("a protected note whose old frontmatter cannot be read is unverified", (t) => {
    const repo = createRepo("wiki-history-");
    t.after(() => repo.cleanup());
    repo.write(DECISION, "---\ntype: decision\ncreated: [unterminated\n---\n## Context\n");
    repo.git(["update-ref", "refs/remotes/origin/main", commitAt(repo, "base", DAY)]);
    repo.git(["switch", "--quiet", "-c", "feature"]);
    repo.write(DECISION, decision({ updated: LATER }));
    commitAt(repo, "docs(wiki): repair ADR-0001", LATER);
    const result = checker(repo.dir)();
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /unverified/);
  });

  await t.test("a shallow clone cannot prove history, so it is an error", (t) => {
    const repo = history(t);
    repo.write(RUNBOOK, runbook({ updated: LATER }, "## Steps\n\nNew.\n"));
    repo.commitAt("docs(wiki): change the steps", LATER);
    const parent = mkdtempSync(join(tmpdir(), "wiki-history-shallow-"));
    t.after(() => rmSync(parent, { recursive: true, force: true }));
    const clone = join(parent, "clone");
    const run = (args: readonly string[], cwd: string): string => execFileSync("git", args, { cwd, env: cleanGitEnv, encoding: "utf8" });
    run(["clone", "--quiet", "--depth", "1", "--branch", "feature", `file://${repo.dir}`, clone], parent);
    run(["update-ref", "refs/remotes/origin/main", "HEAD"], clone);
    const result = checker(clone)();
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /shallow/);
  });
});

const change = (overrides: Partial<NoteChange>): NoteChange => ({
  oldPath: RUNBOOK, newPath: RUNBOOK, oldText: runbook(), newText: runbook(), editDate: DAY, ...overrides,
});

await test("historyFindings", async (t) => {
  await t.test("an unchanged note has no findings", () => {
    assert.deepEqual(historyFindings([change({})]), { violations: [], unverified: [] });
  });

  await t.test("an edit with no known date is unverified", () => {
    const result = historyFindings([change({ newText: runbook({ updated: LATER }, "x\n"), editDate: null })]);
    assert.equal(result.unverified.length, 1);
    assert.equal(result.violations.length, 0);
  });

  await t.test("a protected note is recognised by its folder even when its type field is wrong", () => {
    const old = note({ type: "reference", title: "ADR-0001 Keep a wiki" }, "Old.\n");
    const result = historyFindings([change({ oldPath: DECISION, newPath: DECISION, oldText: old, newText: note({ type: "reference", title: "ADR-0001 Keep a wiki", updated: LATER }, "New.\n"), editDate: LATER })]);
    assert.deepEqual(result.violations.map((violation) => violation.kind), ["body"]);
  });

  await t.test("a same-day deletion of a protected note passes", () => {
    const result = historyFindings([change({ oldPath: SESSION, newPath: null, oldText: session(), newText: null, editDate: DAY })]);
    assert.deepEqual(result, { violations: [], unverified: [] });
  });

  await t.test("a note whose new frontmatter cannot be read is unverified", () => {
    const result = historyFindings([change({ newText: "---\ncreated: [\n---\n", editDate: LATER })]);
    assert.equal(result.unverified.length, 1);
  });

  await t.test("a note without frontmatter outside the protected folders is not judged", () => {
    const result = historyFindings([change({ oldPath: "wiki/Home.md", newPath: "wiki/Home.md", oldText: "# Wiki\n", newText: "# Changed\n", editDate: LATER })]);
    assert.deepEqual(result, { violations: [], unverified: [] });
  });
});
