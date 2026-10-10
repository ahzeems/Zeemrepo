import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { parseDocument } from "yaml";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { WIKI_DIR, WIKI_SCHEMA } from "../lib/paths.ts";
import { isRecord, isStringArray, stringValue } from "../lib/record.ts";
import { walk } from "../lib/walk.ts";
import { currentIdentity, findSensitive, redactionChecks, redactionTargets, type Identity } from "./redaction.ts";
import { MEMORY_STATUSES, MEMORY_TYPES, REQUIRED_STRINGS, allowedList, missingSections } from "./schema.ts";
import { WORK_STATUSES, WORK_TYPES, validateWork, type Fail, type WorkRecord } from "./work-tracking.ts";

type WikiValidation = { errors: string[]; noteCount: number; tagCount: number };
type ValidateOptions = { identity?: Identity };

const BAD_FILENAME = /[\\:*?"<>|#^[\]]/;
const SINGLE_WIKILINK = /^\[\[[^[\]\n]+\]\]$/;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Vault = {
  root: string;
  wikiDir: string;
  tags: ReadonlySet<string>;
  agents: ReadonlySet<string>;
  titles: ReadonlySet<string>;
  indexed: ReadonlySet<string>;
  seen: Map<string, string>;
  fail: Fail;
};

// Code and comments hold examples, not links: `[[Note title]]` in a code block neither
// breaks nor indexes anything.
function withoutCode(text: string): string {
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "").replace(/<!--[\s\S]*?-->/g, "");
}

function wikilinks(text: string): string[] {
  return [...withoutCode(text).matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1].trim()]);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const toPosix = (path: string): string => path.split(sep).join("/");

function loadAllowlists(root: string, fail: Fail): { tags: ReadonlySet<string>; agents: ReadonlySet<string> } {
  const schemaPath = join(root, WIKI_SCHEMA);
  if (!existsSync(schemaPath)) {
    fail(schemaPath, "note schema is missing; the tag and agent allowlists live there");
    return { tags: new Set(), agents: new Set() };
  }
  const schema = readFileSync(schemaPath, "utf8");
  const tags = allowedList(schema, "tags");
  const agents = allowedList(schema, "agents");
  if (tags.size === 0) fail(schemaPath, "no allowed tags found between tags:start and tags:end markers");
  if (agents.size === 0) fail(schemaPath, "no allowed agents found between agents:start and agents:end markers");
  return { tags, agents };
}

// Every name a wikilink may use for a note or Bases file: title, file name, and vault path.
function knownTitles(wikiDir: string, notes: readonly string[], bases: readonly string[], fail: Fail): Set<string> {
  const titles = new Set<string>();
  for (const file of bases) {
    titles.add(basename(file));
    titles.add(basename(file, ".base"));
    const doc = parseDocument(readFileSync(file, "utf8"));
    const value: unknown = doc.errors.length > 0 ? null : doc.toJS({ maxAliasCount: 20 });
    if (!isRecord(value) || !Array.isArray(value.views) || value.views.length === 0) fail(file, "invalid Bases YAML or missing views");
  }
  for (const file of notes) {
    const path = toPosix(relative(wikiDir, file));
    for (const name of [basename(file, ".md"), basename(file), path, path.replace(/\.md$/, "")]) titles.add(name);
  }
  return titles;
}

// A symlinked index is reported elsewhere and never read: it could point anywhere.
function readRegular(file: string): string | null {
  const stat = lstatSync(file, { throwIfNoEntry: false });
  return stat?.isFile() === true ? readFileSync(file, "utf8") : null;
}

// Memory notes must be reachable from Home, directly or through the Memory index.
function indexedTitles(wikiDir: string): Set<string> {
  const homeLinks = wikilinks(readRegular(join(wikiDir, "Home.md")) ?? "");
  const indexed = new Set(homeLinks);
  const memoryIndex = join(wikiDir, "reference", "Memory index.md");
  if (indexed.has("Memory index")) {
    for (const link of wikilinks(readRegular(memoryIndex) ?? "")) indexed.add(link);
  }
  return indexed;
}

function checkName(vault: Vault, file: string, name: string): void {
  if (BAD_FILENAME.test(name)) vault.fail(file, "file name contains a character Obsidian or Windows cannot handle");
  const previous = vault.seen.get(name.toLowerCase());
  if (previous !== undefined) vault.fail(file, `duplicate note title, also at ${previous}`);
  vault.seen.set(name.toLowerCase(), toPosix(relative(vault.root, file)));
}

function checkFields(vault: Vault, file: string, name: string, data: Readonly<Record<string, unknown>>): void {
  const fail = (message: string): void => vault.fail(file, message);
  for (const key of REQUIRED_STRINGS) if (!stringValue(data[key]).trim()) fail(`missing or non-string required field "${key}"`);
  if (stringValue(data.title) !== name) fail("title does not match file name");
  if (stringValue(data.summary).length >= 200) fail("summary must be under 200 characters");
  const dates = ["created", "updated"].map((key) => ({ key, value: stringValue(data[key]) }));
  for (const { key, value } of dates) if (!validDate(value)) fail(`${key} must be a real YYYY-MM-DD date`);
  // Order is only meaningful between real dates; comparing a malformed one adds noise.
  if (dates.every(({ value }) => validDate(value)) && stringValue(data.updated) < stringValue(data.created)) fail("updated is earlier than created");
  const statuses = WORK_TYPES.has(stringValue(data.type)) ? WORK_STATUSES : MEMORY_STATUSES;
  if (!statuses.includes(stringValue(data.status))) fail(`status must be one of ${statuses.join(", ")}`);
  if (data.status === "superseded" && !SINGLE_WIKILINK.test(stringValue(data.superseded_by))) fail("superseded notes need a wikilink in superseded_by");
  const agent = stringValue(data.agent);
  if (!KEBAB.test(agent)) fail("agent must be a kebab-case short name");
  else if (!vault.agents.has(agent)) fail("agent is not in the allowed agent list in note-schema.md");
  if (!isStringArray(data.tags) || data.tags.length === 0) fail("tags must be a nonempty list of strings");
  else for (const tag of data.tags) if (!vault.tags.has(tag)) fail("tag is not in the allowed list in note-schema.md");
  if (data.related !== undefined && (!isStringArray(data.related) || !data.related.every((link) => SINGLE_WIKILINK.test(link)))) {
    fail("related must be a list of wikilink strings");
  }
}

function checkPlacement(vault: Vault, file: string, name: string, data: Readonly<Record<string, unknown>>, body: string): void {
  const type = stringValue(data.type);
  const spec = MEMORY_TYPES.get(type) ?? WORK_TYPES.get(type);
  if (spec === undefined) {
    vault.fail(file, "unknown note type");
    if (!vault.indexed.has(name)) vault.fail(file, "not indexed through Home or Memory index");
    return;
  }
  if (toPosix(relative(vault.wikiDir, dirname(file))) !== spec.folder) vault.fail(file, `note belongs in wiki/${spec.folder}/`);
  if (type === "decision" && !/^ADR-\d{4} /.test(name)) vault.fail(file, 'decision titles start with "ADR-NNNN "');
  if (type === "session" && !/^\d{4}-\d{2}-\d{2} /.test(name)) vault.fail(file, 'session titles start with "YYYY-MM-DD "');
  for (const section of missingSections(body, spec.sections)) vault.fail(file, `missing section "## ${section}"`);
  if (!WORK_TYPES.has(type) && !vault.indexed.has(name)) vault.fail(file, "not indexed through Home or Memory index");
}

function checkNote(vault: Vault, file: string): WorkRecord | null {
  const name = basename(file, ".md");
  const text = readFileSync(file, "utf8");
  checkName(vault, file, name);
  const frontmatter = parseFrontmatter(text);
  if (frontmatter.kind === "none") {
    vault.fail(file, "missing YAML frontmatter; start the note with a --- block");
    return null;
  }
  if (frontmatter.kind === "invalid") {
    vault.fail(file, `${frontmatter.reason}; use exact --- delimiters and unique fields`);
    return null;
  }
  checkFields(vault, file, name, frontmatter.data);
  checkPlacement(vault, file, name, frontmatter.data, frontmatter.body);
  for (const link of wikilinks(text)) if (!vault.titles.has(link) && link !== "Home") vault.fail(file, "broken wikilink");
  return { file, title: name, data: frontmatter.data, body: frontmatter.body };
}


// Templates are examples, not notes: each must be a known template whose frontmatter parses
// and declares a known type, so a real note cannot hide in templates/ and skip validation.
const TEMPLATE_NAMES = new Set([...MEMORY_TYPES.keys(), ...WORK_TYPES.keys(), "build-ticket", "decision-ticket"]);

function checkTemplate(fail: Fail, file: string): void {
  const name = basename(file, ".md");
  if (!TEMPLATE_NAMES.has(name)) {
    fail(file, `unknown template; templates/ holds only ${[...TEMPLATE_NAMES].join(", ")}`);
    return;
  }
  const frontmatter = parseFrontmatter(readFileSync(file, "utf8"));
  if (frontmatter.kind !== "ok") {
    fail(file, "template frontmatter must parse");
    return;
  }
  const type = stringValue(frontmatter.data.type);
  if (!MEMORY_TYPES.has(type) && !WORK_TYPES.has(type)) fail(file, "template declares an unknown note type");
  else if (name !== type && !(type === "ticket" && name.endsWith("-ticket"))) fail(file, `template ${name} declares type ${type}`);
}

// Everything in wiki/ is a note, a Bases file or a template. Obsidian's own settings folder
// is the one exception; any other file type would otherwise go unvalidated.
const VAULT_FILE = /\.(md|base)$/;

type VaultFiles = { notes: string[]; templates: string[]; bases: string[] };

function vaultFiles(wikiDir: string, home: string, fail: Fail): VaultFiles {
  const { files, symlinks } = walk(wikiDir, { includeDot: true, skipDirs: new Set([".obsidian", ".git", "node_modules"]) });
  for (const link of symlinks) fail(link, "symbolic links are not supported in the vault");
  for (const file of files.filter((file) => !VAULT_FILE.test(file))) fail(file, "unrecognised file in wiki/: notes are .md, Bases files are .base");
  for (const file of files.filter((file) => basename(file).startsWith("."))) fail(file, "dot files are not notes; remove it or rename it");
  const inTemplates = (file: string): boolean => toPosix(relative(wikiDir, file)).split("/")[0] === "templates";
  const markdown = files.filter((file) => file.endsWith(".md") && !basename(file).startsWith("."));
  return {
    notes: markdown.filter((file) => file !== home && !inTemplates(file)),
    templates: markdown.filter(inTemplates),
    bases: files.filter((file) => file.endsWith(".base")),
  };
}

function checkRedaction(root: string, identity: Identity, fail: Fail): void {
  const checks = redactionChecks(identity);
  const { files, symlinks, staged } = redactionTargets(root);
  for (const link of symlinks) fail(link, "symbolic link: not scanned for secrets; replace it with the file");
  for (const file of files) {
    for (const finding of findSensitive(readFileSync(file, "utf8"), checks)) fail(file, `line ${finding.line}: possible ${finding.name}`);
  }
  // What a commit publishes is the staged copy, which can differ from the file on disk.
  for (const { file, text } of staged) {
    for (const finding of findSensitive(text, checks)) fail(file, `line ${finding.line} of the staged copy: possible ${finding.name}`);
  }
}

export function validateWiki(root: string, options: ValidateOptions = {}): WikiValidation {
  const errors: string[] = [];
  const fail: Fail = (file, message) => errors.push(`${toPosix(relative(root, file))}: ${message}`);
  const wikiDir = join(root, WIKI_DIR);
  const home = join(wikiDir, "Home.md");
  const { tags, agents } = loadAllowlists(root, fail);
  const { notes, templates, bases } = vaultFiles(wikiDir, home, fail);
  for (const template of templates) checkTemplate(fail, template);
  const titles = knownTitles(wikiDir, notes, bases, fail);
  const indexed = indexedTitles(wikiDir);
  if (!existsSync(home)) fail(home, "missing index");
  const vault: Vault = { root, wikiDir, tags, agents, titles, indexed, seen: new Map(), fail };
  const records = notes.flatMap((file) => checkNote(vault, file) ?? []);
  validateWork(records, fail);
  const homeLinks = wikilinks(readRegular(home) ?? "");
  for (const link of homeLinks) if (!titles.has(link)) fail(home, "broken index wikilink");
  checkRedaction(root, options.identity ?? currentIdentity(), fail);
  return { errors, noteCount: notes.length, tagCount: tags.size };
}
