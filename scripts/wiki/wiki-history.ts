import { parseFrontmatter } from "../lib/frontmatter.ts";
import { git, gitLines, gitPaths, type GitOptions } from "../lib/git.ts";
import { WIKI_DIR } from "../lib/paths.ts";
import { REMERGE, isConflictResolution } from "./wiki-compliance-validation.ts";

// The wiki's history rules, judged by comparing each note at the branch's base with HEAD:
// created and agent never change; updated changes on every edit made after the day it names;
// a decision or session body is not edited, renamed or deleted after its created day, and its
// frontmatter may then change only to supersede it (status, superseded_by, updated) or to
// relink and retag it (related, tags; OWNER DECISION, 2026-10-18).
// Pure apart from readNoteChanges; the CLI is wiki-compliance.ts.
export type NoteChange = { oldPath: string; newPath: string | null; oldText: string; newText: string | null; editDate: string | null };
export type HistoryFinding = { path: string; kind: string; detail: string };
export type HistoryResult = { violations: HistoryFinding[]; unverified: HistoryFinding[] };

type Note = { data: Readonly<Record<string, unknown>>; body: string };

const PROTECTED_TYPES = new Set(["decision", "session"]);
const PROTECTED_DIRS = [`${WIKI_DIR}decisions/`, `${WIKI_DIR}sessions/`];
// Templates declare a type but are examples, and Home.md has no frontmatter.
const UNJUDGED = [`${WIKI_DIR}templates/`, `${WIKI_DIR}Home.md`];
const IMMUTABLE = ["created", "agent"];
const LATER_FIELDS = new Set(["updated", "status", "superseded_by", "related", "tags"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value) ?? "");
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function isProtected(path: string, data: Readonly<Record<string, unknown>> | null): boolean {
  return PROTECTED_DIRS.some((dir) => path.startsWith(dir)) || PROTECTED_TYPES.has(text(data?.type));
}

function immutableFindings(path: string, before: Note, after: Note): HistoryFinding[] {
  return IMMUTABLE.filter((key) => before.data[key] !== undefined && !same(before.data[key], after.data[key]))
    .map((key) => ({ path, kind: "immutable", detail: `${key} changed from ${text(before.data[key])} to ${text(after.data[key])}; it never changes` }));
}

function updatedFindings(path: string, before: Note, after: Note, editDate: string): HistoryFinding[] {
  const was = text(before.data.updated);
  const now = text(after.data.updated);
  if (!DATE.test(was)) return [];
  if (!DATE.test(now) || now < was) return [{ path, kind: "updated", detail: `updated went from ${was} to ${now}; it may only move forward` }];
  if (now === was && editDate > was) return [{ path, kind: "updated", detail: `edited on ${editDate} but updated still says ${was}` }];
  if (now > editDate) return [{ path, kind: "updated", detail: `updated says ${now}, after the edit on ${editDate}` }];
  return [];
}

function protectedFindings(change: NoteChange, before: Note, after: Note, created: string): HistoryFinding[] {
  const path = change.oldPath;
  const day = `after its day (${created}); write a new note and mark this one superseded with superseded_by instead`;
  const findings: HistoryFinding[] = [];
  if (change.newPath !== path) findings.push({ path, kind: "renamed", detail: `moved to ${change.newPath ?? ""} ${day}` });
  if (before.body !== after.body) findings.push({ path, kind: "body", detail: `body edited ${day}` });
  const keys = [...new Set([...Object.keys(before.data), ...Object.keys(after.data)])];
  const changed = keys.filter((key) => !IMMUTABLE.includes(key) && !LATER_FIELDS.has(key) && !same(before.data[key], after.data[key]));
  if (changed.length > 0) findings.push({ path, kind: "metadata", detail: `${changed.join(", ")} changed ${day}` });
  if (!same(before.data.status, after.data.status) && after.data.status !== "superseded") {
    findings.push({ path, kind: "metadata", detail: `status may only become superseded ${day}` });
  }
  return findings;
}

function readNote(raw: string): Note | string {
  const parsed = parseFrontmatter(raw);
  if (parsed.kind === "invalid") return parsed.reason;
  return parsed.kind === "none" ? { data: {}, body: raw } : parsed;
}

function judge(change: NoteChange): HistoryResult {
  const none: HistoryResult = { violations: [], unverified: [] };
  if (change.newText === change.oldText && change.newPath === change.oldPath) return none;
  const path = change.oldPath;
  const unverified = (detail: string): HistoryResult => ({ violations: [], unverified: [{ path, kind: "unverified", detail }] });
  const oldParsed = parseFrontmatter(change.oldText);
  const before = oldParsed.kind === "ok" ? oldParsed : null;
  const guarded = isProtected(path, before?.data ?? null);
  if (before === null) return guarded ? unverified(`its earlier frontmatter cannot be read (${oldParsed.kind === "invalid" ? oldParsed.reason : "none"})`) : none;
  if (change.editDate === null) return unverified("no commit on this branch dates the change");
  const created = text(before.data.created);
  if (guarded && !DATE.test(created)) return unverified(`its earlier created date "${created}" is not a date`);
  const later = guarded && change.editDate > created;
  if (change.newText === null) {
    return later ? { violations: [{ path, kind: "deleted", detail: `deleted after its day (${created}); supersede it instead` }], unverified: [] } : none;
  }
  const after = readNote(change.newText);
  if (typeof after === "string") return unverified(`its new frontmatter cannot be read (${after})`);
  const violations = [...immutableFindings(path, before, after), ...(change.newText === change.oldText ? [] : updatedFindings(path, before, after, change.editDate))];
  return { violations: later ? [...violations, ...protectedFindings(change, before, after, created)] : violations, unverified: [] };
}

export function historyFindings(changes: readonly NoteChange[]): HistoryResult {
  const results = changes.map(judge);
  return { violations: results.flatMap((result) => result.violations), unverified: results.flatMap((result) => result.unverified) };
}

type Entry = { oldPath: string; newPath: string | null };

// name-status -z: "M\0path", "D\0path", "A\0path", "R<score>\0old\0new". Additions have no
// history to protect; a rename keeps its old path so the old note's rules follow it.
function entries(base: string, options: GitOptions): Entry[] {
  const fields = gitPaths(["diff", "--find-renames", "--name-status", base, "HEAD", "--", WIKI_DIR], options);
  const found: Entry[] = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index] ?? "";
    const first = fields[index + 1] ?? "";
    const renamed = status.startsWith("R") || status.startsWith("C");
    const second = renamed ? fields[index + 2] ?? "" : first;
    index += renamed ? 3 : 2;
    if (status === "A" || status.startsWith("C")) continue;
    found.push({ oldPath: first, newPath: status === "D" ? null : second });
  }
  return found;
}

const judged = (path: string): boolean => path.toLowerCase().endsWith(".md") && !UNJUDGED.some((prefix) => path.startsWith(prefix));

// The latest author or committer date among the branch commits touching the note and their
// branch ancestors: an amend or rebase moves the committer date, and a commit cannot be older
// than its parents, so a backdated commit or merge cannot hide later work beneath it. A merge
// whose own changes to the note (its remerge-diff) are none or only resolve a conflict wrote
// nothing, so it does not date the edit; a merge that writes lines of its own does.
function editDate(base: string, paths: readonly string[], options: GitOptions): string | null {
  const commits = gitLines(["log", "--format=%H %P", `${base}..HEAD`, "--", ...paths], options);
  const dating = commits.flatMap((line) => {
    const [sha = "", ...parents] = line.split(" ");
    if (parents.length < 2) return [sha];
    const own = git([...REMERGE, "--format=", sha, "--", ...paths], options);
    return own === "" || isConflictResolution(own) ? [] : [sha];
  });
  const dates = dating.flatMap((sha) => gitLines(["log", "--format=%as%n%cs", `${base}..${sha}`], options));
  return dates.length === 0 ? null : dates.reduce((latest, date) => (date > latest ? date : latest));
}

export function readNoteChanges(base: string, options: GitOptions): NoteChange[] {
  return entries(base, options).filter((entry) => judged(entry.oldPath)).map((entry) => ({
    ...entry,
    oldText: git(["show", `${base}:${entry.oldPath}`], options),
    newText: entry.newPath === null ? null : git(["show", `HEAD:${entry.newPath}`], options),
    editDate: editDate(base, entry.newPath === null || entry.newPath === entry.oldPath ? [entry.oldPath] : [entry.oldPath, entry.newPath], options),
  }));
}
