// Durable run state (S17, finding A10): what a Sandcastle run has established for one issue, so a
// restart resumes the phases that are missing instead of repeating finished ones. One small JSON
// file per issue, in a host-only directory beside the receipt store (the same placement and
// permission rules, verification-receipt.ts), never in the candidate, the artifact or a guest.
// A save writes a temporary file and renames it over the old one, so a crash leaves either the
// previous state or the new one. State only says what to skip: every phase it records is bound to
// the inputs it was reached with, and publication still validates its receipt for itself.
import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, openSync, readdirSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { isRecord } from "../lib/record.ts";
import { readPrivate, sha256 } from "./verification-receipt.ts";

export const STATE_VERSION = 1;
const STATE_BYTES = 64 * 1024;
const DIGEST = /^[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;

/** What every recorded phase depends on: a change to any of these makes the recorded phases stale. */
export type Inputs = { repository: string; task: string; taskSha256: string; base: string; ref: string; candidate: string; manifestSha256: string };
/** A remote write: attempted is recorded before it starts, so a crash leaves evidence that it may have happened. */
export type Delivery = { status: "attempted" } | { status: "delivered"; url: string };
export type Verified = { receipt: string; run: string; outcome: "passed" | "failed" };
export type IssueState = { version: 1; inputs: Inputs; artifacts: string; verification: Verified | null; publication: Delivery | null; notification: Delivery | null };
type Refusals = { refusals: string[] };

const INPUT_KEYS = ["repository", "task", "taskSha256", "base", "ref", "candidate", "manifestSha256"] as const;
const STATE_KEYS = ["version", "inputs", "artifacts", "verification", "publication", "notification"];

/** $XDG_STATE_HOME/zeemrepo/run-state, or ~/.local/state/... when that is unset or relative. */
export function defaultStateStore(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const state = env.XDG_STATE_HOME !== undefined && isAbsolute(env.XDG_STATE_HOME) ? env.XDG_STATE_HOME : join(home, ".local", "state");
  return join(state, "zeemrepo", "run-state");
}

export const sameInputs = (a: Inputs, b: Inputs): boolean => INPUT_KEYS.every((key) => a[key] === b[key]);

export const stateKey = (repository: string, task: string): string => sha256(JSON.stringify([repository, task]));
const stateFile = (dir: string, inputs: { repository: string; task: string }): string => join(dir, `${stateKey(inputs.repository, inputs.task)}.json`);

const sameKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).sort().join() === [...keys].sort().join();

function inputsRefusals(value: unknown, repository: string, task: string): string[] {
  if (!isRecord(value) || !sameKeys(value, INPUT_KEYS) || !INPUT_KEYS.every((key) => typeof value[key] === "string")) return ["the state's inputs are malformed"];
  if (value.repository !== repository || value.task !== task) return [`the state names repository ${String(value.repository)} task ${String(value.task)}, not ${repository} ${task}`];
  const shaShaped = SHA.test(String(value.base)) && SHA.test(String(value.candidate));
  const digestShaped = DIGEST.test(String(value.taskSha256)) && DIGEST.test(String(value.manifestSha256));
  return shaShaped && digestShaped ? [] : ["the state's inputs are malformed"];
}

function verificationRefusals(value: unknown): string[] {
  if (value === null) return [];
  const valid = isRecord(value) && sameKeys(value, ["receipt", "run", "outcome"]) && typeof value.receipt === "string" && DIGEST.test(value.receipt)
    && typeof value.run === "string" && value.run !== "" && (value.outcome === "passed" || value.outcome === "failed");
  return valid ? [] : ["the state's verification is malformed"];
}

function deliveryRefusals(value: unknown, name: string): string[] {
  if (value === null) return [];
  if (isRecord(value) && sameKeys(value, ["status"]) && value.status === "attempted") return [];
  if (isRecord(value) && sameKeys(value, ["status", "url"]) && value.status === "delivered" && typeof value.url === "string" && value.url !== "") return [];
  return [`the state's ${name} is malformed`];
}

function stateFrom(value: unknown, repository: string, task: string): { state: IssueState } | Refusals {
  if (!isRecord(value)) return { refusals: ["the state is not a JSON object"] };
  if (value.version !== STATE_VERSION) return { refusals: [`the state is version ${JSON.stringify(value.version) ?? "undefined"}; this code reads only version ${String(STATE_VERSION)}`] };
  const unknown = Object.keys(value).filter((key) => !STATE_KEYS.includes(key)).map((key) => `unknown key ${key} in the state`);
  const refusals = [
    ...unknown, ...inputsRefusals(value.inputs, repository, task), ...verificationRefusals(value.verification),
    ...deliveryRefusals(value.publication, "publication"), ...deliveryRefusals(value.notification, "notification"),
  ];
  if (typeof value.artifacts !== "string" || !isAbsolute(value.artifacts)) refusals.push("the state's artifact path is not absolute");
  if (refusals.length > 0) return { refusals };
  // Every field was checked above; the guard only gives the checked value its static type.
  return isState(value) ? { state: value } : { refusals: ["the state is malformed"] };
}

const isState = (value: unknown): value is IssueState => isRecord(value) && value.version === STATE_VERSION;

/**
 * The issue's state in `dir`: null when there is none, refused when it cannot be trusted. A refused
 * file is left exactly as it is for an operator to inspect; nothing here deletes or rewrites it.
 */
export function loadState(dir: string, repository: string, task: string): { state: IssueState | null } | Refusals {
  const path = stateFile(dir, { repository, task });
  try {
    lstatSync(path);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return { state: null };
    throw error;
  }
  const kept = `The file ${path} is kept as it is: inspect it, then move it aside by hand to start this issue over.`;
  const bytes = readPrivate(path, STATE_BYTES);
  if (typeof bytes === "string") return { refusals: [`the run state ${bytes}. ${kept}`] };
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { refusals: [`the run state is not valid JSON. ${kept}`] };
  }
  const read = stateFrom(value, repository, task);
  return "refusals" in read ? { refusals: read.refusals.map((refusal) => `${refusal}. ${kept}`) } : read;
}

function syncDirectory(dir: string): void {
  const fd = openSync(dir, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Writes the state through a private temporary file renamed over the old one, flushed to disk. */
export function saveState(dir: string, state: IssueState): void {
  const path = stateFile(dir, state.inputs);
  const temporary = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeSync(fd, `${JSON.stringify(state)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  removeStaleTemporaries(dir, path);
  syncDirectory(dir);
}

// A crash between the temporary write and the rename leaves a temporary file behind. Once this
// save has landed, the issue's leftovers are removed: only regular files named as saveState names
// them for this issue, checked with lstat so a link is never followed or removed.
function removeStaleTemporaries(dir: string, path: string): void {
  const prefix = basename(path);
  const pattern = new RegExp(`^${prefix.replaceAll(".", "\\.")}\\.[0-9a-f]{12}\\.tmp$`);
  for (const name of readdirSync(dir).filter((entry) => pattern.test(entry))) {
    const stale = join(dir, name);
    if (lstatSync(stale).isFile()) unlinkSync(stale);
  }
}

/** Moves the issue's state aside, kept for inspection, so changed inputs start from nothing; returns where it went. */
export function supersede(dir: string, state: IssueState): string {
  const path = stateFile(dir, state.inputs);
  const kept = `${path.slice(0, -".json".length)}.${new Date().toISOString().replaceAll(":", "-")}.${randomBytes(3).toString("hex")}.superseded.json`;
  renameSync(path, kept);
  syncDirectory(dir);
  return kept;
}
