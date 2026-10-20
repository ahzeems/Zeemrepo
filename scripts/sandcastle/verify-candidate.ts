// npm run sandbox:verify: verify one Sandcastle candidate artifact with the trusted verifier driver
// (S15) and print its receipt digest. It builds the verifier image from this control checkout's
// .sandcastle/Dockerfile, runs the base commit's checks on the candidate in a fresh container and
// asks the reviewer. No live reviewer is authorised yet, so the command reports blocked before it
// touches Docker; a blocked or refused run never issues a receipt and is never a pass.
import { join } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { SHA, type Expected } from "./artifact.ts";
import { dockerCli, dockerRuntime, type Docker } from "./container-runtime.ts";
import { defaultStore } from "./verification-receipt.ts";
import { noReviewer, verifyCandidate, type Reviewer, type Verification } from "./verifier-driver.ts";

export type Options = { output?: Output; reviewer?: Reviewer; docker?: Docker; store?: string; checks?: readonly string[]; root?: string };

const USAGE = `Usage: node scripts/sandcastle/verify-candidate.ts --artifacts <dir> --source <trusted repo> --repository <owner/name>
  --task <id> --base <sha> --ref <refs/heads/...> --run <id>
Verifies a Sandcastle candidate artifact: the base commit's checks run on the candidate in a fresh
container, an independent reviewer judges the diff, and the receipt is written to the host-only
store ${defaultStore()}.
Exit: 0 passed, 1 failed, refused or blocked, 2 the tool failed or was called wrongly.`;

const FLAGS = ["--artifacts", "--source", "--repository", "--task", "--base", "--ref", "--run"];
const BRANCH_REF = /^refs\/heads\/(?!.*\.\.)(?!.*\/\.)[A-Za-z0-9._/-]+$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const IMAGE = "zeemrepo-sandbox:verifier";
const CONTROL_ROOT = join(import.meta.dirname, "..", "..");
// OWNER DECISION, 2026-10-18, relayed by the coordinator: "Fake reviewer only (Recommended)".
const NO_REVIEWER = "blocked: no reviewer: the owner has not authorised a live reviewer, so no independent review can be bound to a receipt";

function parseArgs(args: readonly string[]): Map<string, string> | string {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const [flag = "", value] = [args[i], args[i + 1]];
    if (!FLAGS.includes(flag) || value === undefined || values.has(flag)) return `verify-candidate: unknown, repeated or valueless argument ${flag}. See --help.`;
    values.set(flag, value);
  }
  const missing = FLAGS.filter((flag) => !values.has(flag));
  if (missing.length > 0) return `verify-candidate: missing ${missing.join(", ")}. See --help.`;
  if (!SHA.test(values.get("--base") ?? "")) return "verify-candidate: --base must be a full lowercase SHA-1.";
  if (!BRANCH_REF.test(values.get("--ref") ?? "")) return "verify-candidate: --ref must be one branch ref under refs/heads/.";
  if (!RUN_ID.test(values.get("--run") ?? "")) return "verify-candidate: --run must be letters, digits, dots, dashes or underscores.";
  return values;
}

function report(outcome: Verification, output: Output): number {
  if (outcome.status === "blocked") {
    for (const reason of outcome.reasons) output.warn(`verify-candidate: ${reason}`);
    output.warn("verify-candidate: no receipt was issued. This is not a pass.");
    return EXIT_REFUSED;
  }
  if (outcome.status === "refused") {
    for (const refusal of outcome.refusals) output.warn(`verify-candidate: ${refusal}`);
    if (outcome.quarantine !== null) output.warn(`verify-candidate: the candidate is kept for diagnostics in ${outcome.quarantine}`);
    return EXIT_REFUSED;
  }
  const line = `verify-candidate: ${outcome.status}: receipt ${outcome.digest}${outcome.reused ? ` (reuses ${outcome.receipt.reusedFrom ?? ""})` : ""}; logs in ${outcome.quarantine}`;
  if (outcome.receipt.checkMachinery.humanReviewRequired) output.warn(`verify-candidate: the candidate changes check machinery, which needs human review: ${outcome.receipt.checkMachinery.changed.join(", ")}`);
  if (outcome.status === "failed") {
    output.warn(line);
    return EXIT_REFUSED;
  }
  output.write(line);
  return EXIT_OK;
}

function buildImage(docker: Docker): string | null {
  try {
    if (docker(["version", "--format", "{{.Server.Version}}"]).status !== 0) return "blocked: Docker is not available here";
  } catch {
    return "blocked: Docker is not available here";
  }
  const built = docker(["build", "--tag", IMAGE, "--file", join(CONTROL_ROOT, ".sandcastle", "Dockerfile"), join(CONTROL_ROOT, ".sandcastle")], { inherit: true });
  return built.status === 0 ? null : `the verifier image did not build (exit ${String(built.status)})`;
}

export async function main(args: readonly string[], options: Options = {}): Promise<number> {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  const values = parseArgs(args);
  if (typeof values === "string") {
    output.warn(values);
    return EXIT_ERROR;
  }
  const reviewer = options.reviewer ?? noReviewer;
  const docker = options.docker ?? dockerCli();
  const store = options.store ?? defaultStore();
  if (reviewer.identity === null) return report({ status: "blocked", reasons: [NO_REVIEWER] }, output);
  const unbuilt = buildImage(docker);
  if (unbuilt !== null) return report(unbuilt.startsWith("blocked") ? { status: "blocked", reasons: [unbuilt] } : { status: "refused", refusals: [unbuilt], quarantine: null }, output);
  const value = (flag: string): string => values.get(flag) ?? "";
  const expected: Expected = { repository: value("--repository"), task: value("--task"), base: value("--base"), ref: value("--ref") };
  const runtime = dockerRuntime(docker, IMAGE, [store]);
  const outcome = await verifyCandidate({ artifacts: value("--artifacts"), source: value("--source"), expected, run: value("--run"), store, ...(options.root === undefined ? {} : { root: options.root }), ...(options.checks === undefined ? {} : { checks: options.checks }) }, { runtime, reviewer });
  return report(outcome, output);
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
