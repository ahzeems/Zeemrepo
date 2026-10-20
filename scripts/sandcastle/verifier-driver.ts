// The trusted verifier driver (S15, findings A01 and A13). It runs on the host, never in a builder
// context, and turns one quarantined candidate into a verification receipt:
//   1. quarantine.ts checks and imports the artifact; builder claims stay data.
//   2. The check commands come from the base commit's package.json, never the candidate's (OWNER
//      DECISION, 2026-10-18, relayed by the coordinator: "Base commit's checks (Recommended)").
//      Candidate changes to check machinery are named for human review instead of trusted.
//   3. The candidate's tracked tree runs those checks in a fresh container (container-runtime.ts).
//   4. An independent reviewer judges the diff; its raw response is bound into the receipt.
//   5. The receipt goes into the host-only store (verification-receipt.ts).
// Unchanged inputs reuse a stored passing receipt by issuing a new receipt for the new run.
// No reviewer or no runtime is a blocked result, never a pass.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "../lib/git.ts";
import { isRecord } from "../lib/record.ts";
import { BUNDLE_FILE, LIMITS, MANIFEST_FILE, type Expected } from "./artifact.ts";
import type { Runtime, RuntimeIdentity, Step, StepResult, StepRun } from "./container-runtime.ts";
import { quarantineCandidate, runGit, type Accepted } from "./quarantine.ts";
import {
  definitionsDigest, ISSUER, parseReview, prepareStore, RECEIPT_VERSION, sha256, storedReceipts, writeReceipt,
  type Receipt, type ReviewerIdentity,
} from "./verification-receipt.ts";

export const INSTALL_COMMAND = "npm ci --no-audit --no-fund";
// Files whose change can alter what a check does or decides. A candidate may change them, but then
// the checks it passed are partly its own, so a human reviews them.
const MACHINERY = [
  /^package(-lock)?\.json$/, /^\.npmrc$/, /^\.nvmrc$/, /^tsconfig[^/]*\.json$/, /^eslint\.config\.[^/]+$/, /^scripts\//, /^evals\//,
  /^config\//, /^\.sandcastle\//, /^\.githooks\//, /^\.github\//, /(^|\/)\.gitattributes$/, /^\.claude\/skills\/import-baseline\.json$/,
];
// Inputs that can shadow a module or configuration a check loads: Python files and path hooks
// anywhere, Python and Git configuration, and node_modules.
const SHADOWING = [/\.py$/, /\.pth$/, /(^|\/)(pyproject\.toml|setup\.cfg)$/, /(^|\/)\.gitignore$/, /^node_modules\//];
// A new top-level file that a tool could load by name from the working directory.
const TOP_LEVEL_CODE = /^[^/]+\.(py|pth|js|mjs|cjs|ts|mts|cts|json|toml|cfg|ini)$/;
// A command that goes through a package manager would read the candidate's package.json after all.
// Quotes and backslashes are dropped first, since the shell would join n"p"m into npm.
const DELEGATES = /\b(npm|npx|pnpm|pnpx|yarn|bun|bunx|corepack)\b|--run\b|npm_execpath/;
const CHAIN_LINK = /^npm (?:run ([A-Za-z0-9:_-]+)|(test))$/;
const RUNNER_FILES = ["verifier-driver.ts", "container-runtime.ts", "verification-receipt.ts", "quarantine.ts", "artifact.ts", "containment-smoke.ts"];
const GIT_TIMEOUT_MS = 120_000;

export type ReviewInput = { repository: string; task: string; base: string; candidate: string; diff: string; checkMachinery: string[]; checks: StepResult[] };
/** A reviewer in its own context. `identity` is null when no reviewer is authorised; `review` returns the raw model response. */
export type Reviewer = { identity: ReviewerIdentity | null; review(input: ReviewInput): Promise<string> };
export type VerifyRequest = { artifacts: string; source: string; expected: Expected; run: string; store: string; root?: string; checks?: readonly string[] };
export type Verification =
  | { status: "passed" | "failed"; digest: string; receipt: Receipt; reused: boolean; quarantine: string }
  | { status: "refused"; refusals: string[]; quarantine: string | null }
  | { status: "blocked"; reasons: string[] };
type Deps = { runtime: Runtime; reviewer: Reviewer };

/** No live reviewer is authorised (OWNER DECISION, 2026-10-18, relayed by the coordinator: "Fake reviewer only (Recommended)"). */
export const noReviewer: Reviewer = { identity: null, review: () => Promise.reject(new Error("verifier-driver: no reviewer is authorised")) };

/** Changed paths whose content can change what a check runs or decides, given the base's top-level entries. */
export function machineryPaths(paths: readonly string[], baseTop: readonly string[]): string[] {
  const newDirectory = (path: string): boolean => path.includes("/") && !baseTop.includes(path.split("/")[0] ?? "");
  return paths.filter((path) => [...MACHINERY, ...SHADOWING, TOP_LEVEL_CODE].some((pattern) => pattern.test(path)) || newDirectory(path));
}

const scriptsOf = (packageJson: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(packageJson);
    return isRecord(value) && isRecord(value.scripts) ? value.scripts : {};
  } catch {
    return null;
  }
};

/** The checks the base itself runs: the `npm run <name>` and `npm test` links of its check:base, in order. */
export function checkNamesOf(packageJson: string): { names: string[] } | { refusals: string[] } {
  const chain = scriptsOf(packageJson)?.["check:base"];
  if (typeof chain !== "string") return { refusals: ["the base package.json defines no check:base"] };
  const links = chain.split(" && ").map((link) => link.trim());
  const names = links.map((link) => CHAIN_LINK.exec(link)).map((match) => (match === null ? null : match[1] ?? "test"));
  const bad = links.filter((_, index) => names[index] === null);
  return bad.length > 0 ? { refusals: bad.map((link) => `the base's check:base link ${JSON.stringify(link)} is not npm run <script> or npm test`) } : { names: names.filter((name) => name !== null) };
}

/** The named scripts as defined in a base package.json; a missing or delegating script refuses. */
export function checkDefinitions(packageJson: string, names: readonly string[]): { definitions: Step[] } | { refusals: string[] } {
  const scripts = scriptsOf(packageJson);
  if (scripts === null) return { refusals: ["the base package.json is not JSON"] };
  const refusals: string[] = [];
  const definitions: Step[] = [];
  for (const name of names) {
    const command = scripts[name];
    if (command === undefined) refusals.push(`the base defines no check ${name}`);
    else if (typeof command !== "string") refusals.push(`the base check ${name} is not a command string`);
    else if (DELEGATES.test(command.replace(/["'\\]/g, ""))) refusals.push(`the base check ${name} delegates to a package manager, which would read the candidate's scripts: ${command}`);
    else definitions.push({ name, command });
  }
  return refusals.length > 0 ? { refusals } : { definitions };
}

/** The base's check definitions: `names`, or the links of its own check:base. */
function baseDefinitions(packageJson: string, names: readonly string[] | undefined): { definitions: Step[] } | { refusals: string[] } {
  const chosen = names === undefined ? checkNamesOf(packageJson) : { names: [...names] };
  return "refusals" in chosen ? chosen : checkDefinitions(packageJson, chosen.names);
}

/** The check definitions digest a consumer expects, read from the base in its own trusted repository. */
export function trustedChecksDigest(source: string, base: string, names?: readonly string[]): { digest: string } | { refusals: string[] } {
  let packageJson: string;
  try {
    packageJson = git(["cat-file", "blob", `${base}:package.json`], { cwd: source });
  } catch {
    return { refusals: [`the base ${base} has no readable package.json in ${source}`] };
  }
  const read = baseDefinitions(packageJson, names);
  return "refusals" in read ? read : { digest: definitionsDigest(read.definitions) };
}

/** The driver's identity: the digest of the host code that runs and judges a verification. */
export const runnerDigest = (): string => sha256(Buffer.concat(RUNNER_FILES.map((file) => readFileSync(join(import.meta.dirname, file)))));

function blockedReasons(deps: Deps): { reasons: string[] } | { reviewer: ReviewerIdentity; runtime: RuntimeIdentity } {
  const reasons: string[] = [];
  const reviewer = deps.reviewer.identity;
  if (reviewer === null) reasons.push("blocked: no reviewer is authorised, so no independent review can be bound to a receipt");
  const runtime = deps.runtime.identity();
  if (runtime === null) reasons.push("blocked: no container runtime (Docker and the verifier image) is available, so the checks cannot run in isolation");
  return reviewer === null || runtime === null ? { reasons } : { reviewer, runtime };
}

type Inputs = { machinery: string[]; definitions: Step[]; diff: string };

async function inputsFrom(accepted: Accepted, names: readonly string[] | undefined): Promise<Inputs | { refusals: string[] }> {
  const run = (args: readonly string[]): Promise<string> => runGit(accepted.gitDir, args, { timeoutMs: GIT_TIMEOUT_MS, maxOutput: LIMITS.gitOutputBytes }).then((result) => {
    if (result.status !== 0) throw new Error(`git ${args[0] ?? ""} exited ${String(result.status)}: ${result.stderr}`);
    return result.stdout;
  });
  const { base } = accepted;
  const sha = accepted.candidate.sha;
  const diffArgs = ["--no-renames", "--no-ext-diff", "--no-textconv", "--no-color", base, sha];
  try {
    const changed = (await run(["diff", "--name-only", "-z", ...diffArgs])).split("\0").filter((path) => path !== "");
    const read = baseDefinitions(await run(["cat-file", "blob", `${base}:package.json`]), names);
    if ("refusals" in read) return read;
    const baseTop = (await run(["ls-tree", "--name-only", "-z", base])).split("\0").filter((name) => name !== "");
    return { machinery: machineryPaths(changed, baseTop), definitions: read.definitions, diff: await run(["diff", ...diffArgs]) };
  } catch (error) {
    return { refusals: [`the candidate's inputs could not be read in quarantine: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

type Binding = { request: VerifyRequest; accepted: Accepted; reviewer: ReviewerIdentity; runtime: RuntimeIdentity; definitionsSha256: string; runner: string };

function reusable(binding: Binding): { digest: string; receipt: Receipt } | undefined {
  const { request, accepted, reviewer, runtime, definitionsSha256, runner } = binding;
  return storedReceipts(request.store).find(({ receipt }) => receipt.outcome === "passed"
    && receipt.repository === request.expected.repository && receipt.task === request.expected.task && receipt.base === accepted.base
    && receipt.candidate.sha === accepted.candidate.sha && receipt.checks.definitionsSha256 === definitionsSha256
    && receipt.runner.sha256 === runner && receipt.runner.runtime === runtime.runtime && receipt.runner.image === runtime.image
    && JSON.stringify(receipt.review.reviewer) === JSON.stringify(reviewer));
}

function artifactOf(accepted: Accepted): Receipt["artifact"] {
  return { manifestSha256: sha256(readFileSync(join(accepted.quarantine, MANIFEST_FILE))), bundleSha256: sha256(readFileSync(join(accepted.quarantine, BUNDLE_FILE))) };
}

const result = ({ name, command, exit, outputSha256, outputBytes }: StepResult): StepResult => ({ name, command, exit, outputSha256, outputBytes });
const notRun = (step: Step): StepResult => ({ ...step, exit: null, outputSha256: sha256(""), outputBytes: 0 });

// Step outputs stay beside the quarantined candidate as private diagnostics; the receipt binds their digests.
function keepLogs(quarantine: string, runs: readonly StepRun[]): void {
  const logs = join(quarantine, "logs");
  mkdirSync(logs, { mode: 0o700 });
  runs.forEach((run, index) => writeFileSync(join(logs, `${String(index)}-${run.name}.log`), run.output, { flag: "wx", mode: 0o600 }));
}

function stepsOf(definitions: readonly Step[], runs: readonly StepRun[]): { install: StepResult; results: StepResult[] } {
  const install = runs[0] === undefined ? notRun({ name: "install", command: INSTALL_COMMAND }) : result(runs[0]);
  const results = definitions.map((definition, index) => {
    const ran = runs[index + 1];
    return ran?.name === definition.name && ran.command === definition.command ? result(ran) : notRun(definition);
  });
  return { install, results };
}

function issue(binding: Binding, receipt: Receipt, reused: boolean): Verification {
  const digest = writeReceipt(binding.request.store, receipt);
  return { status: receipt.outcome, digest, receipt, reused, quarantine: binding.accepted.quarantine };
}

function reuse(binding: Binding, stored: { digest: string; receipt: Receipt }): Verification {
  const { request, accepted } = binding;
  const receipt: Receipt = { ...stored.receipt, issuedAt: new Date().toISOString(), run: request.run, candidate: { ref: request.expected.ref, sha: accepted.candidate.sha }, artifact: artifactOf(accepted), reusedFrom: stored.digest };
  return issue(binding, receipt, true);
}

async function review(binding: Binding, inputs: Inputs, steps: { install: StepResult; results: StepResult[] }, deps: Deps): Promise<Receipt["review"] | { refusals: string[] }> {
  const { request, accepted } = binding;
  const input: ReviewInput = {
    repository: request.expected.repository, task: request.expected.task, base: accepted.base, candidate: accepted.candidate.sha,
    diff: inputs.diff, checkMachinery: inputs.machinery, checks: [steps.install, ...steps.results],
  };
  const response = await deps.reviewer.review(input);
  const parsed = parseReview(response);
  if ("refusal" in parsed) return { refusals: [`the reviewer's response was refused: ${parsed.refusal}`] };
  return { reviewer: binding.reviewer, inputSha256: sha256(JSON.stringify(input)), response, verdict: parsed.verdict, findings: parsed.findings };
}

async function verifyFresh(binding: Binding, inputs: Inputs, deps: Deps): Promise<Verification> {
  const { request, accepted } = binding;
  const tarPath = join(accepted.quarantine, "candidate.tar");
  const archived = await runGit(accepted.gitDir, ["archive", "--format=tar", `--output=${tarPath}`, accepted.candidate.sha], { timeoutMs: GIT_TIMEOUT_MS, maxOutput: LIMITS.gitOutputBytes });
  if (archived.status !== 0) return { status: "refused", refusals: [`git archive of the candidate failed: ${archived.stderr}`], quarantine: accepted.quarantine };
  const ran = deps.runtime.run(tarPath, [{ name: "install", command: INSTALL_COMMAND }, ...inputs.definitions]);
  if ("refusals" in ran) return { status: "refused", refusals: ran.refusals, quarantine: accepted.quarantine };
  keepLogs(accepted.quarantine, ran.results);
  const steps = stepsOf(inputs.definitions, ran.results);
  const reviewed = await review(binding, inputs, steps, deps);
  if ("refusals" in reviewed) return { status: "refused", refusals: reviewed.refusals, quarantine: accepted.quarantine };
  const passed = steps.install.exit === 0 && steps.results.every((step) => step.exit === 0) && reviewed.verdict === "pass";
  const receipt: Receipt = {
    version: RECEIPT_VERSION, issuer: ISSUER, issuedAt: new Date().toISOString(), run: request.run,
    repository: request.expected.repository, task: request.expected.task, base: accepted.base,
    candidate: { ref: request.expected.ref, sha: accepted.candidate.sha }, artifact: artifactOf(accepted),
    runner: { sha256: binding.runner, runtime: binding.runtime.runtime, image: binding.runtime.image },
    checks: { source: "base", definitionsSha256: binding.definitionsSha256, ...steps },
    checkMachinery: { changed: inputs.machinery, humanReviewRequired: inputs.machinery.length > 0 },
    review: reviewed, outcome: passed ? "passed" : "failed", reusedFrom: null,
  };
  return issue(binding, receipt, false);
}

/** Verify one candidate artifact and issue its receipt; see the file comment for the steps. */
export async function verifyCandidate(request: VerifyRequest, deps: Deps): Promise<Verification> {
  const ready = blockedReasons(deps);
  if ("reasons" in ready) return { status: "blocked", reasons: ready.reasons };
  const store = prepareStore(request.store, [request.source, request.artifacts]);
  if (store.length > 0) return { status: "refused", refusals: store, quarantine: null };
  const accepted = await quarantineCandidate({ artifacts: request.artifacts, source: request.source, expected: request.expected, ...(request.root === undefined ? {} : { root: request.root }) });
  if (!accepted.accepted) return { status: "refused", refusals: accepted.refusals, quarantine: accepted.quarantine };
  const inputs = await inputsFrom(accepted, request.checks);
  if ("refusals" in inputs) return { status: "refused", refusals: inputs.refusals, quarantine: accepted.quarantine };
  const binding: Binding = { request, accepted, reviewer: ready.reviewer, runtime: ready.runtime, definitionsSha256: definitionsDigest(inputs.definitions), runner: runnerDigest() };
  const stored = reusable(binding);
  return stored === undefined ? verifyFresh(binding, inputs, deps) : reuse(binding, stored);
}
