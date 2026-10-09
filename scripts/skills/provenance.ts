import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isRecord } from "../lib/record.ts";

// Third-party and owner-approved skill text is recorded by hash in import-baseline.json.
// The installed text must match the latest approved revision (or the accepted installation
// when there is none), and every revision cites an approval record that holds the owner's
// words and names the skill. Landed provenance is append-only.
export const BASELINE_PATH = ".claude/skills/import-baseline.json";

type Revision = { sha256: string; approval: { record: string; quote: string }; reason: string };
export type BaselineEntry = { name: string; source: string; sourceSha256: string; installedSha256: string; revisions: Revision[] };

const SHA256 = /^[a-f0-9]{64}$/;
const SKILL_NAME = /^[a-z][a-z0-9-]*$/;

/** UTF-8 text, LF line endings, no byte-order mark. */
export function provenanceHash(text: string): string {
  return createHash("sha256").update(text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function readRevision(value: unknown, label: string, errors: string[]): Revision | null {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  const { sha256, approval, reason } = value;
  const problems: string[] = [];
  if (typeof sha256 !== "string" || !SHA256.test(sha256)) problems.push(`${label} needs a 64-character sha256`);
  if (typeof reason !== "string" || reason.trim() === "") problems.push(`${label} needs a reason`);
  const validApproval = isRecord(approval) && typeof approval.record === "string" && typeof approval.quote === "string" && approval.quote.trim().length >= 12;
  if (!validApproval) problems.push(`${label} needs an approval record path and a verbatim quote`);
  errors.push(...problems);
  if (problems.length > 0 || typeof sha256 !== "string" || typeof reason !== "string" || !validApproval) return null;
  return { sha256, reason, approval: { record: String(approval.record), quote: String(approval.quote) } };
}

function readEntry(entry: Record<string, unknown>, name: string, errors: string[]): BaselineEntry | null {
  const { source, sourceSha256, installedSha256, revisions } = entry;
  if (typeof sourceSha256 !== "string" || !SHA256.test(sourceSha256) || typeof installedSha256 !== "string" || !SHA256.test(installedSha256)) {
    errors.push(`${name}: baseline entry needs sourceSha256 and installedSha256`);
    return null;
  }
  if (typeof source !== "string" || source.trim() === "") {
    errors.push(`${name}: baseline entry needs a source naming where the text came from`);
    return null;
  }
  if (revisions !== undefined && !Array.isArray(revisions)) {
    errors.push(`${name}: revisions must be a list`);
    return null;
  }
  const checked = (revisions ?? []).flatMap((revision, index) => readRevision(revision, `${name}: revision ${index + 1}`, errors) ?? []);
  return { name, source, sourceSha256, installedSha256, revisions: checked };
}

export function readBaseline(root: string, errors: string[]): BaselineEntry[] {
  const path = join(root, BASELINE_PATH);
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(parsed) || !Array.isArray(parsed.skills)) throw new Error("skills must be an array");
    const names = new Set<string>();
    return parsed.skills.flatMap((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.name !== "string" || !SKILL_NAME.test(entry.name)) throw new Error("each entry needs a skill name");
      if (names.has(entry.name)) throw new Error(`duplicate skill name ${entry.name}`);
      names.add(entry.name);
      return readEntry(entry, entry.name, errors) ?? [];
    });
  } catch (error) {
    errors.push(`import-baseline.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

const normalizeSpace = (text: string): string => text.replace(/\s+/g, " ").trim();

function approvalErrors(root: string, entry: BaselineEntry, revision: Revision, label: string): string[] {
  const record = resolve(root, revision.approval.record);
  if (relative(root, record).startsWith("..") || !existsSync(record) || !statSync(record).isFile()) {
    return [`${label} approval record ${revision.approval.record} does not exist`];
  }
  const text = normalizeSpace(readFileSync(record, "utf8"));
  const errors: string[] = [];
  if (!text.includes(normalizeSpace(revision.approval.quote))) errors.push(`${label} approval record does not contain its approval quote`);
  // Skill names are kebab-case, so a name inside a longer word or name is not a mention.
  if (!new RegExp(`(?<![a-z0-9-])${entry.name}(?![a-z0-9-])`).test(text)) errors.push(`${label} approval record does not name the skill`);
  return errors;
}

export function provenanceErrors(root: string, entry: BaselineEntry): string[] {
  const file = join(root, ".claude/skills", entry.name, "SKILL.md");
  if (!existsSync(file)) return [`${entry.name}: baseline entry has no installed SKILL.md`];
  const errors: string[] = [];
  const expected = entry.revisions.at(-1)?.sha256 ?? entry.installedSha256;
  if (provenanceHash(readFileSync(file, "utf8")) !== expected) {
    errors.push(`${entry.name}: SKILL.md does not match its recorded provenance; record an approved revision or restore the accepted text`);
  }
  entry.revisions.forEach((revision, index) => errors.push(...approvalErrors(root, entry, revision, `${entry.name}: revision ${index + 1}`)));
  return errors;
}

/** Landed provenance is append-only: entries, their two hashes and landed revisions never change. */
export function baselineHistoryErrors(landed: unknown, current: unknown): string[] {
  if (!isRecord(landed) || !Array.isArray(landed.skills)) return ["import-baseline.json history is unverified: the landed copy could not be read"];
  const currentSkills = isRecord(current) && Array.isArray(current.skills) ? current.skills.filter(isRecord) : [];
  const errors: string[] = [];
  for (const previous of landed.skills.filter(isRecord)) {
    const name = typeof previous.name === "string" ? previous.name : "?";
    const now = currentSkills.find((entry) => entry.name === previous.name);
    if (now === undefined) {
      errors.push(`${name}: landed baseline entry was removed`);
      continue;
    }
    for (const field of ["sourceSha256", "installedSha256"] as const) {
      if (now[field] !== previous[field]) errors.push(`${name}: landed ${field} was rewritten`);
    }
    const before = Array.isArray(previous.revisions) ? previous.revisions : [];
    const after = Array.isArray(now.revisions) ? now.revisions : [];
    before.forEach((revision, index) => {
      if (JSON.stringify(after[index]) !== JSON.stringify(revision)) errors.push(`${name}: landed revision ${index + 1} was changed or removed`);
    });
  }
  return errors;
}
