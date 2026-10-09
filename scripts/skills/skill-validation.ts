import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { walk } from "../lib/walk.ts";
import { markdownReferences } from "./markdown-references.ts";
import { provenanceErrors, readBaseline } from "./provenance.ts";
import { readStandards, type SkillStandards } from "./skill-standards.ts";

// Structural checks for the skill library, from write-skill's contract. Structure only:
// whether the model actually selects and follows a skill is measured by ECC skill-comply.
export type SkillValidation = { errors: string[]; skillCount: number };

type Skill = { name: string; dir: string; file: string; body: string; data: Readonly<Record<string, unknown>>; baseline: boolean };
type Context = { standards: SkillStandards; used: Set<string>; errors: string[] };

export const SKILLS_DIR = ".claude/skills";
const KEYS = new Set(["name", "description", "disable-model-invocation"]);
const EM_DASH = "\u2014";
const OTHER_HARNESS = /(^|\/)(openai\.ya?ml|opencode[^/]*)$/i;

function decode(target: string): string | null {
  try {
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

// Markdown links encode spaces, so a target is decoded before it is looked for on disk.
function citationError(file: string, target: string): string | null {
  const [rawPath = "", rawFragment] = target.split("#", 2);
  const path = decode(rawPath);
  const fragment = rawFragment === undefined ? undefined : decode(rawFragment);
  if (path === null || fragment === null) return `cites a malformed path: ${target}`;
  const destination = path === "" ? file : resolve(dirname(file), path);
  if (!existsSync(destination)) return `cites a path that does not exist: ${target}`;
  if (fragment === undefined || fragment === "" || !destination.endsWith(".md")) return null;
  if (!statSync(destination).isFile()) return `heading target is not a file: ${target}`;
  return markdownReferences(readFileSync(destination, "utf8")).headings.has(fragment) ? null : `cites a heading that does not exist: ${target}`;
}

function loadSkill(root: string, name: string, baseline: ReadonlySet<string>, errors: string[]): Skill | null {
  const dir = join(root, SKILLS_DIR, name);
  const file = join(dir, "SKILL.md");
  if (!existsSync(file)) {
    errors.push(`${name}: no SKILL.md`);
    return null;
  }
  const parsed = parseFrontmatter(readFileSync(file, "utf8"));
  if (parsed.kind === "none") errors.push(`${name}: missing YAML frontmatter`);
  if (parsed.kind === "invalid") errors.push(`${name}: ${parsed.reason}`);
  if (parsed.kind !== "ok") return null;
  return { name, dir, file, body: parsed.body, data: parsed.data, baseline: baseline.has(name) };
}

// Every skill, whoever wrote it: findable by name, described, and citing only what exists.
function checkStructure(skill: Skill, fail: (message: string) => void): void {
  const declared = skill.data.name;
  if (declared !== skill.name) fail(`name must equal the directory name, found ${typeof declared === "string" ? declared : "none"}`);
  const description = skill.data.description;
  if (typeof description !== "string" || description.trim() === "") fail("a description is required");
  const citations = markdownReferences(skill.body);
  for (const target of [...citations.links, ...citations.images]) {
    const error = citationError(skill.file, target);
    if (error !== null) fail(error);
  }
}

// write-skill's budgets apply to skills authored here; baseline text is exempt.
function checkBudgets(skill: Skill, context: Context, fail: (message: string) => void): void {
  if (skill.baseline) return;
  const allowed = (rule: string): boolean => {
    const hit = context.standards.allowances.some((entry) => entry.skill === skill.name && entry.rule === rule);
    if (hit) context.used.add(`${skill.name}:${rule}`);
    return hit;
  };
  const description = typeof skill.data.description === "string" ? skill.data.description : "";
  if (description.length > context.standards.descriptionLimit && !allowed("descriptionLimit")) {
    fail(`description is ${description.length} characters, over the ${context.standards.descriptionLimit} standard`);
  }
  const body = skill.body.trim().length;
  if (body > context.standards.bodyLimit && !allowed("bodyLimit")) fail(`body is ${body} characters, over the ${context.standards.bodyLimit} budget`);
  const extra = Object.keys(skill.data).filter((key) => !KEYS.has(key));
  if (extra.length > 0) fail(`frontmatter carries ${extra.join(", ")}; the contract is name, description and disable-model-invocation`);
}

// Avoid em dashes (owner decision); Codex and OpenCode configuration has no reader here.
// Every file is checked, dot folders and node_modules included, and links are reported
// rather than followed, so nothing in a skill escapes these checks.
const ROOT_FILES = new Set(["import-baseline.json", "THIRD-PARTY-NOTICES.md"]);

function checkFile(file: string, path: string, errors: string[]): void {
  if (OTHER_HARNESS.test(path)) errors.push(`${path}: Codex and OpenCode files are not used; delete it`);
  if (!/\.md$/i.test(file)) return;
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (line.includes(EM_DASH)) errors.push(`${path}: line ${index + 1}: em dash; use a comma, colon, parentheses or a new sentence`);
  });
}

function checkFiles(root: string, errors: string[]): void {
  const skillsRoot = join(root, SKILLS_DIR);
  const { files, symlinks } = walk(skillsRoot, { includeDot: true, skipDirs: new Set() });
  const toPath = (file: string): string => relative(skillsRoot, file).split("\\").join("/");
  for (const link of symlinks) errors.push(`${toPath(link)}: symbolic link; replace it with the file`);
  for (const file of files) {
    const path = toPath(file);
    if (!path.includes("/") && !ROOT_FILES.has(path)) errors.push(`${path}: unexpected file in .claude/skills; skills live in their own folders`);
    checkFile(file, path, errors);
  }
}

// One list decides which skills only the user may invoke, and the frontmatter must agree
// with it in both directions.
function userOnlyErrors(userOnly: readonly string[], skills: readonly Skill[]): string[] {
  const errors: string[] = [];
  for (const skill of skills) {
    const flag = skill.data["disable-model-invocation"];
    if (flag !== undefined && typeof flag !== "boolean") errors.push(`${skill.name}: disable-model-invocation must be true or false, not ${JSON.stringify(flag)}`);
  }
  for (const name of userOnly) {
    const skill = skills.find((item) => item.name === name);
    if (skill === undefined) errors.push(`${name}: user-only skill is not installed`);
    else if (skill.data["disable-model-invocation"] !== true) errors.push(`${name}: user-only skill needs disable-model-invocation: true`);
  }
  for (const skill of skills) {
    if (skill.data["disable-model-invocation"] === true && !userOnly.includes(skill.name)) {
      errors.push(`${skill.name}: disable-model-invocation is set but the skill is not in userOnly; list it in config/skill-standards.json`);
    }
  }
  return errors;
}

export function validateSkills(root: string): SkillValidation {
  const standards = readStandards(root);
  if (typeof standards === "string") return { errors: [standards], skillCount: 0 };
  const dir = join(root, SKILLS_DIR);
  if (!existsSync(dir)) return { errors: [`${SKILLS_DIR} is missing`], skillCount: 0 };
  const errors: string[] = [];
  const baseline = readBaseline(root, errors);
  const baselineNames = new Set(baseline.map((entry) => entry.name));
  const names = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const skills = names.flatMap((name) => loadSkill(root, name, baselineNames, errors) ?? []);
  const context: Context = { standards, used: new Set(), errors };
  for (const skill of skills) {
    const fail = (message: string): void => { errors.push(`${skill.name}: ${message}`); };
    checkStructure(skill, fail);
    checkBudgets(skill, context, fail);
  }
  checkFiles(root, errors);
  for (const entry of baseline) errors.push(...provenanceErrors(root, entry));
  errors.push(...userOnlyErrors(standards.userOnly, skills));
  // An allowance that no longer excuses anything is reported, so permissions cannot accumulate.
  for (const entry of standards.allowances) {
    if (!context.used.has(`${entry.skill}:${entry.rule}`)) errors.push(`allowance for ${entry.skill} (${entry.rule}) matches nothing and should be removed`);
  }
  return { errors, skillCount: skills.length };
}
