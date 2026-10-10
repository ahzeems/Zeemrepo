import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../lib/record.ts";
import { CONFIG_DIR } from "../lib/paths.ts";

// Structural standards for the skill library, from write-skill's contract. Zimi also listed
// "routes" (documents that had to link every skill) because OpenCode and Codex only found
// skills that way; Claude Code discovers skills from their descriptions, so that is gone.
export type Allowance = { skill: string; rule: AllowanceRule; reason: string };
export type SkillStandards = {
  descriptionLimit: number;
  bodyLimit: number;
  allowances: Allowance[];
  /** Skills the user must ask for: the single list that disable-model-invocation must match. */
  userOnly: string[];
};

const STANDARDS_PATH = `${CONFIG_DIR}skill-standards.json`;
const ALLOWANCE_RULES = ["descriptionLimit", "bodyLimit"] as const;
type AllowanceRule = (typeof ALLOWANCE_RULES)[number];
const FIELDS = new Set(["note", "descriptionLimit", "bodyLimit", "allowances", "userOnly"]);
const isRule = (rule: string): rule is AllowanceRule => ALLOWANCE_RULES.some((known) => known === rule);

function readAllowance(entry: unknown): Allowance | string {
  if (!isRecord(entry)) return "each allowance must be an object";
  const { skill, rule, reason } = entry;
  if (typeof skill !== "string" || typeof rule !== "string") return "each allowance names a skill and a rule";
  if (!isRule(rule)) return `the allowance for ${skill} names an unknown rule "${rule}"; use ${ALLOWANCE_RULES.join(" or ")}`;
  if (typeof reason !== "string" || reason.trim().length < 12) return `the allowance for ${skill} needs a reason`;
  return { skill, rule, reason };
}

function parse(root: string): unknown {
  const path = join(root, STANDARDS_PATH);
  if (!existsSync(path)) throw new Error(`${STANDARDS_PATH} is missing`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${STANDARDS_PATH} is not valid JSON`);
  }
}

/** The standards, or a message saying what is wrong with the file. */
export function readStandards(root: string): SkillStandards | string {
  let parsed: unknown;
  try {
    parsed = parse(root);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (!isRecord(parsed)) return `${STANDARDS_PATH} must be an object`;
  const unknown = Object.keys(parsed).find((key) => !FIELDS.has(key));
  if (unknown !== undefined) return `${STANDARDS_PATH} has an unknown field "${unknown}"`;
  const { descriptionLimit, bodyLimit, allowances, userOnly } = parsed;
  if (typeof descriptionLimit !== "number" || typeof bodyLimit !== "number") return `${STANDARDS_PATH} needs numeric descriptionLimit and bodyLimit`;
  if (!Array.isArray(allowances)) return `${STANDARDS_PATH} needs an allowances list`;
  if (!Array.isArray(userOnly) || !userOnly.every((name) => typeof name === "string")) return `${STANDARDS_PATH} needs a userOnly list of skill names`;
  const checked: Allowance[] = [];
  for (const entry of allowances) {
    const allowance = readAllowance(entry);
    if (typeof allowance === "string") return allowance;
    checked.push(allowance);
  }
  return { descriptionLimit, bodyLimit, allowances: checked, userOnly };
}
