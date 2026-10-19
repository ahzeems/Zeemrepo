import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { isRecord } from "../lib/record.ts";
import { walk } from "../lib/walk.ts";

// Third-party and owner-approved skill text is recorded by hash in import-baseline.json.
// Every file in an imported skill's folder must match the latest approved inventory, and every
// revision and inventory cites an approval record that holds the owner's words and names the
// skill. The first inventory continues the SKILL.md chain of installedSha256 and revisions.
// Landed provenance is append-only.
export const BASELINE_PATH = ".claude/skills/import-baseline.json";

type Approval = { record: string; quote: string };
type Revision = { sha256: string; approval: Approval; reason: string };
type Inventory = { files: ReadonlyMap<string, string>; approval: Approval };
type BaselineEntry = { name: string; source: string; sourceSha256: string; installedSha256: string; revisions: Revision[]; inventory: Inventory[] };

const SHA256 = /^[a-f0-9]{64}$/;
const SKILL_NAME = /^[a-z][a-z0-9-]*$/;
const ENTRY_POINT = "SKILL.md";
// A first inventory is a migration baseline (hashes of files as they were when recorded, not
// verified upstream text) or a later import; every later one is an approved revision.
const FIRST_BASES = new Set(["migration-baseline", "import"]);

/** UTF-8 text, LF line endings, no byte-order mark. */
export function provenanceHash(text: string): string {
  return createHash("sha256").update(text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function readApproval(value: Record<string, unknown>, label: string, problems: string[]): Approval | null {
  const { approval, reason } = value;
  const record = isRecord(approval) ? approval.record : undefined;
  const quote = isRecord(approval) ? approval.quote : undefined;
  if (typeof reason !== "string" || reason.trim() === "") problems.push(`${label} needs a reason`);
  if (typeof record !== "string" || typeof quote !== "string" || quote.trim().length < 12) {
    problems.push(`${label} needs an approval record path and a verbatim quote`);
    return null;
  }
  return { record, quote };
}

function readRevision(value: unknown, label: string, errors: string[]): Revision | null {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  const { sha256, reason } = value;
  const problems: string[] = [];
  if (typeof sha256 !== "string" || !SHA256.test(sha256)) problems.push(`${label} needs a 64-character sha256`);
  const approval = readApproval(value, label, problems);
  errors.push(...problems);
  if (problems.length > 0 || approval === null || typeof sha256 !== "string" || typeof reason !== "string") return null;
  return { sha256, reason, approval };
}

// Inventory paths are relative to the skill folder, with "/" separators and no empty, "." or
// ".." segment, so a listed path can only name a file inside that folder.
const safePath = (path: string): boolean => !/[\\\0]/.test(path) && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");

function readFiles(value: unknown, label: string, problems: string[]): ReadonlyMap<string, string> {
  if (!isRecord(value) || !(ENTRY_POINT in value)) {
    problems.push(`${label} needs files listing ${ENTRY_POINT} and every companion with its sha256`);
    return new Map();
  }
  for (const [path, hash] of Object.entries(value)) {
    if (!safePath(path)) problems.push(`${label} file ${path} is not a safe relative path`);
    if (typeof hash !== "string" || !SHA256.test(hash)) problems.push(`${label} file ${path} needs a 64-character sha256`);
  }
  return new Map(Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
}

function readInventory(value: unknown, index: number, label: string, errors: string[]): Inventory | null {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  const problems: string[] = [];
  const basis = value.basis;
  if (index === 0 && (typeof basis !== "string" || !FIRST_BASES.has(basis))) problems.push(`${label} basis must be migration-baseline or import`);
  if (index > 0 && basis !== "revision") problems.push(`${label} basis must be revision`);
  const files = readFiles(value.files, label, problems);
  const approval = readApproval(value, label, problems);
  errors.push(...problems);
  return problems.length > 0 || approval === null ? null : { files, approval };
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
  if (!Array.isArray(entry.inventory) || entry.inventory.length === 0) {
    errors.push(`${name}: baseline entry needs an inventory of its installed files`);
    return null;
  }
  const checked = (revisions ?? []).flatMap((revision, index) => readRevision(revision, `${name}: revision ${index + 1}`, errors) ?? []);
  const inventory = entry.inventory.map((item: unknown, index) => readInventory(item, index, `${name}: inventory ${index + 1}`, errors));
  if (inventory.some((item) => item === null)) return null;
  return { name, source, sourceSha256, installedSha256, revisions: checked, inventory: inventory.filter((item) => item !== null) };
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

function approvalErrors(root: string, entry: BaselineEntry, approval: Approval, label: string): string[] {
  const record = resolve(root, approval.record);
  const inside = relative(root, record);
  if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside) || !existsSync(record) || !statSync(record).isFile()) {
    return [`${label} approval record ${approval.record} does not exist`];
  }
  const text = normalizeSpace(readFileSync(record, "utf8"));
  const errors: string[] = [];
  if (!text.includes(normalizeSpace(approval.quote))) errors.push(`${label} approval record does not contain its approval quote`);
  // Skill names are kebab-case, so a name inside a longer word or name is not a mention.
  if (!new RegExp(`(?<![a-z0-9-])${entry.name}(?![a-z0-9-])`).test(text)) errors.push(`${label} approval record does not name the skill`);
  return errors;
}

// Hashes every file in the skill folder. Links are refused, not followed, and text that is not
// valid UTF-8 is refused, because the normalized hash would not tell two such files apart.
function installedFiles(dir: string, name: string, errors: string[]): Map<string, string> {
  const { files, symlinks } = walk(dir, { includeDot: true, skipDirs: new Set() });
  const toPath = (file: string): string => relative(dir, file).split(sep).join("/");
  for (const link of symlinks) errors.push(`${name}: ${toPath(link)} is a symbolic link; provenance hashes only regular files`);
  const hashes = new Map<string, string>();
  for (const file of files) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file));
    } catch (error) {
      errors.push(`${name}: ${toPath(file)} ${error instanceof TypeError ? "is not UTF-8 text" : "cannot be read"}`);
      continue;
    }
    hashes.set(toPath(file), provenanceHash(text));
  }
  return hashes;
}

function inventoryErrors(name: string, approved: ReadonlyMap<string, string>, installed: ReadonlyMap<string, string>): string[] {
  const errors: string[] = [];
  for (const [path, hash] of approved) {
    const actual = installed.get(path);
    if (actual === undefined) errors.push(`${name}: ${path} is in the approved inventory but missing`);
    else if (actual !== hash) errors.push(`${name}: ${path} does not match its approved inventory; record an approved inventory revision or restore the approved text`);
  }
  for (const path of installed.keys()) {
    if (!approved.has(path)) errors.push(`${name}: ${path} is not in the approved inventory; record an approved inventory revision or remove it`);
  }
  return errors;
}

export function provenanceErrors(root: string, entry: BaselineEntry): string[] {
  const dir = join(root, ".claude/skills", entry.name);
  if (!existsSync(join(dir, ENTRY_POINT))) return [`${entry.name}: baseline entry has no installed ${ENTRY_POINT}`];
  const errors: string[] = [];
  const chained = entry.revisions.at(-1)?.sha256 ?? entry.installedSha256;
  if (entry.inventory[0]?.files.get(ENTRY_POINT) !== chained) {
    errors.push(`${entry.name}: the first inventory must record ${ENTRY_POINT} at its recorded provenance hash (the last legacy revision, or installedSha256); record new changes as inventory revisions, not legacy revisions`);
  }
  const installed = installedFiles(dir, entry.name, errors);
  errors.push(...inventoryErrors(entry.name, entry.inventory.at(-1)?.files ?? new Map(), installed));
  entry.revisions.forEach((revision, index) => errors.push(...approvalErrors(root, entry, revision.approval, `${entry.name}: revision ${index + 1}`)));
  entry.inventory.forEach((item, index) => errors.push(...approvalErrors(root, entry, item.approval, `${entry.name}: inventory ${index + 1}`)));
  return errors;
}

/** Landed provenance is append-only: entries, their two hashes, landed revisions and inventories never change. */
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
    for (const field of ["source", "sourceSha256", "installedSha256"] as const) {
      if (now[field] !== previous[field]) errors.push(`${name}: landed ${field} was rewritten`);
    }
    for (const [field, label] of [["revisions", "revision"], ["inventory", "inventory"]] as const) {
      const before = Array.isArray(previous[field]) ? previous[field] : [];
      const after = Array.isArray(now[field]) ? now[field] : [];
      before.forEach((item: unknown, index) => {
        if (JSON.stringify(after[index]) !== JSON.stringify(item)) errors.push(`${name}: landed ${label} ${index + 1} was changed or removed`);
      });
    }
  }
  return errors;
}
