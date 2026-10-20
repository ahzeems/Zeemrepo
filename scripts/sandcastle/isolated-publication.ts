// Trusted publication of a verified candidate (S16, finding A01). The host hands one candidate to
// its pull request using only this control checkout's code and the host's git and gh:
//   1. The receipt must validate from the host-only store (verification-receipt.ts) for exactly this
//      repository, task, run, base, candidate SHA and branch ref, with no check machinery awaiting
//      human review.
//   2. The artifact is imported again into a fresh quarantine (quarantine.ts); its candidate SHA and
//      file digests must be the ones the receipt bound.
//   3. origin must publish to the receipt's repository, the verified base must be origin's main
//      itself (on it, and not moved past), and gh must not be logged in as the owner or a code
//      owner (pr-ready.ts's checks). The control checkout must be clean and on a commit main holds.
//   4. The branch policy of the pre-push hook (branch-policy.ts) is applied to the one ref update,
//      then the SHA is pushed from the quarantine repository with hooks disabled. The receipt stands
//      in for the hook's npm run check: that check would run this control checkout's code, not the
//      candidate's, and the candidate is never checked out here.
//   5. The pull request is reused or created and must be exactly the candidate into main.
// Nothing here merges, approves, forces a push or runs candidate content.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { MAIN_REFSPEC } from "../lib/git.ts";
import { actorRefusals, destination, handoff, slug, spawnRunner, type Repository, type Run } from "../git/pr-ready.ts";
import { pushRefusals } from "../git/branch-policy.ts";
import { MANIFEST_FILE, SHA } from "./artifact.ts";
import { quarantineCandidate, type Accepted } from "./quarantine.ts";
import { defaultStore, sha256, validateReceipt, type Receipt } from "./verification-receipt.ts";
import { trustedChecksDigest } from "./verifier-driver.ts";

/** The only programs publication starts on the host, both resolved from the host's PATH. */
export const HOST_EXECUTABLES: readonly string[] = ["git", "gh"];
// Git acting on the quarantine repository runs no hook and no fsmonitor, whatever the host user's
// global config says; the repository itself was created with no template and has no hooks.
const CANDIDATE_GIT = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "--no-replace-objects"];
const ZERO = "0".repeat(40);
const CONTROL_ROOT = join(import.meta.dirname, "..", "..");

export type Request = { artifacts: string; receipt: string; repository: string; task: string; run: string; base: string; candidate: string; ref: string };
export type Options = { output?: Output; run?: Run; control?: string; store?: string; checks?: readonly string[]; quarantineRoot?: string };
type Refusals = { refusals: string[] };
type Context = { request: Request; run: Run; control: string; options: Options };
type Verified = { receipt: Receipt; accepted: Accepted; controlHead: string; mainCommit: string };
type Ready = Verified & { repository: Repository; pushUrl: string; branch: string };

const USAGE = `Usage: node scripts/sandcastle/isolated-publication.ts --artifacts <dir> --receipt <sha256>
  --repository <owner/name> --task <id> --run <id> --base <sha> --candidate <sha> --ref <refs/heads/...>
Publishes one verified Sandcastle candidate: the receipt must validate from the host-only store
${defaultStore()} for exactly these values, the artifact must be the one it verified, and the SHA
is pushed from a fresh quarantine with hooks disabled, then handed to its exact pull request.
This control checkout's own checks do not run and do not verify the candidate. Never merges.
Exit: 0 published, 1 refused, 2 the tool failed or was called wrongly.`;

const FLAGS: readonly string[] = ["--artifacts", "--receipt", "--repository", "--task", "--run", "--base", "--candidate", "--ref"];
const BRANCH_REF = /^refs\/heads\/(?!.*\.\.)(?!.*\/\.)[A-Za-z0-9._/-]+$/;
const DIGEST = /^[0-9a-f]{64}$/;

function parseArgs(args: readonly string[]): Request | string {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const [flag = "", value] = [args[i], args[i + 1]];
    if (!FLAGS.includes(flag) || value === undefined || values.has(flag)) return `isolated-publication: unknown, repeated or valueless argument ${flag}. See --help.`;
    values.set(flag, value);
  }
  const missing = FLAGS.filter((flag) => !values.has(flag));
  if (missing.length > 0) return `isolated-publication: missing ${missing.join(", ")}. See --help.`;
  const value = (flag: string): string => values.get(flag) ?? "";
  if (!SHA.test(value("--base")) || !SHA.test(value("--candidate"))) return "isolated-publication: --base and --candidate must be full lowercase SHA-1s.";
  if (!DIGEST.test(value("--receipt"))) return "isolated-publication: --receipt must be a receipt's SHA-256.";
  if (!BRANCH_REF.test(value("--ref"))) return "isolated-publication: --ref must be one branch ref under refs/heads/.";
  return {
    artifacts: value("--artifacts"), receipt: value("--receipt"), repository: value("--repository"), task: value("--task"),
    run: value("--run"), base: value("--base"), candidate: value("--candidate"), ref: value("--ref"),
  };
}

function must(run: Run, args: readonly string[]): string {
  const result = run("git", args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed (exit ${String(result.status)})`);
  return result.stdout.trim();
}

const candidateGit = (accepted: Accepted, args: readonly string[]): string[] => [`--git-dir=${accepted.gitDir}`, ...CANDIDATE_GIT, ...args];

/** The control checkout's commit and fetched main, refused when its tracked files differ from that commit. */
function controlState(run: Run): { controlHead: string; mainCommit: string } | Refusals {
  if (must(run, ["status", "--porcelain", "--untracked-files=no"]) !== "") {
    return { refusals: ["the control checkout has uncommitted changes to tracked files, so the code publishing would not be its pinned commit. Commit or restore them, then rerun."] };
  }
  must(run, ["-c", "core.hooksPath=/dev/null", "fetch", "--quiet", "origin", MAIN_REFSPEC]);
  const controlHead = must(run, ["rev-parse", "HEAD"]);
  const mainCommit = must(run, ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main^{commit}"]);
  if (run("git", ["merge-base", "--is-ancestor", controlHead, mainCommit]).status !== 0) {
    return { refusals: [`the control checkout is on ${controlHead}, which origin's main does not contain, so the publishing code is not a landed commit. Check out main or a commit on it, then rerun.`] };
  }
  return { controlHead, mainCommit };
}

/** The receipt, if it authorizes exactly this request on its own. */
function receiptFor({ request, control, options }: Context): { receipt: Receipt } | Refusals {
  const checks = trustedChecksDigest(control, request.base, options.checks);
  if ("refusals" in checks) return checks;
  const expectation = { repository: request.repository, task: request.task, run: request.run, base: request.base, candidate: request.candidate, checksSha256: checks.digest };
  const valid = validateReceipt(options.store ?? defaultStore(), request.receipt, expectation, { source: control, artifacts: request.artifacts });
  if ("refusals" in valid) return valid;
  const refusals: string[] = [];
  if (valid.humanReview.length > 0) refusals.push(`the candidate changes check machinery that needs human review before it can publish: ${valid.humanReview.join(", ")}`);
  if (valid.receipt.candidate.ref !== request.ref) refusals.push(`the receipt binds ref ${valid.receipt.candidate.ref}, not ${request.ref}`);
  return refusals.length > 0 ? { refusals } : { receipt: valid.receipt };
}

/** The artifact imported afresh, refused unless it is byte for byte the one the receipt verified. */
async function importedCandidate({ request, control, options }: Context, receipt: Receipt): Promise<{ accepted: Accepted } | Refusals> {
  const expected = { repository: request.repository, task: request.task, base: request.base, ref: request.ref };
  const outcome = await quarantineCandidate({ artifacts: request.artifacts, source: control, expected, ...(options.quarantineRoot === undefined ? {} : { root: options.quarantineRoot }) });
  if (!outcome.accepted) return { refusals: outcome.refusals };
  const refusals: string[] = [];
  if (outcome.candidate.sha !== receipt.candidate.sha) refusals.push(`the artifact imported ${outcome.candidate.sha}, not the verified candidate ${receipt.candidate.sha}`);
  // The manifest names the bundle's SHA-256 and quarantine checked the bundle against it, so the
  // manifest's digest binds the bundle too.
  if (sha256(readFileSync(join(outcome.quarantine, MANIFEST_FILE))) !== receipt.artifact.manifestSha256) refusals.push("the artifact's manifest is not the one the receipt verified");
  return refusals.length > 0 ? { refusals } : { accepted: outcome };
}

/** origin's repository and push URL, the login and main's position, all checked before anything leaves. */
function destinationRefusals(context: Context, verified: Verified): { repository: Repository; pushUrl: string } | Refusals {
  const { run, request } = context;
  const repository = destination(run);
  if ("refusal" in repository) return { refusals: [repository.refusal] };
  const refusals: string[] = [];
  if (`${repository.owner}/${repository.name}`.toLowerCase() !== request.repository.toLowerCase()) {
    refusals.push(`origin publishes to ${slug(repository)}, but the receipt verified the candidate for repository ${request.repository}`);
  }
  if (run("git", ["merge-base", "--is-ancestor", request.base, verified.mainCommit]).status !== 0) {
    refusals.push(`the verified base ${request.base} is not on origin's main (${verified.mainCommit}), so the pull request would carry base commits nobody reviewed. Build and verify the candidate on main.`);
  }
  if (run("git", ["merge-base", "--is-ancestor", verified.mainCommit, request.base]).status !== 0) {
    refusals.push(`main has moved past the verified base ${request.base} (origin's main is ${verified.mainCommit}), so the pull request would not be what was verified. Rebuild and reverify the candidate on current main.`);
  }
  refusals.push(...actorRefusals(run, repository, verified.mainCommit));
  return refusals.length > 0 ? { refusals } : { repository, pushUrl: must(run, ["remote", "get-url", "--push", "origin"]) };
}

/** The pre-push hook's branch policy for this one update, with origin's current tip of the branch. */
function policyRefusals(run: Run, ready: Ready): string[] {
  const remoteRef = `refs/heads/${ready.branch}`;
  const listed = must(run, candidateGit(ready.accepted, ["ls-remote", ready.pushUrl, remoteRef]));
  const remoteOid = /^([0-9a-f]{40})\s/.exec(listed)?.[1] ?? ZERO;
  const isAncestor = (ancestor: string, descendant: string): boolean => run("git", candidateGit(ready.accepted, ["merge-base", "--is-ancestor", ancestor, descendant])).status === 0;
  return pushRefusals([{ localRef: "refs/quarantine/candidate", localOid: ready.accepted.candidate.sha, remoteRef, remoteOid }], isAncestor);
}

async function verify(context: Context): Promise<Ready | Refusals> {
  const { request, run } = context;
  const early = pushRefusals([{ localRef: "refs/quarantine/candidate", localOid: request.candidate, remoteRef: request.ref, remoteOid: ZERO }], () => false);
  if (early.length > 0) return { refusals: early };
  const state = controlState(run);
  if ("refusals" in state) return state;
  const receipt = receiptFor(context);
  if ("refusals" in receipt) return receipt;
  const imported = await importedCandidate(context, receipt.receipt);
  if ("refusals" in imported) return imported;
  const verified: Verified = { ...state, receipt: receipt.receipt, accepted: imported.accepted };
  const target = destinationRefusals(context, verified);
  if ("refusals" in target) return target;
  const ready: Ready = { ...verified, ...target, branch: request.ref.slice("refs/heads/".length) };
  const policy = policyRefusals(run, ready);
  return policy.length > 0 ? { refusals: policy } : ready;
}

const pushedNote = (sha: string, branch: string): string =>
  `${sha} is already pushed to ${branch}; nothing was merged or retargeted. Inspect origin, fix the cause and rerun with the same receipt: it pushes the same commit again (a no-op) and reuses a matching open pull request instead of opening another. Never force-push to recover.`;

function content(request: Request, ready: Ready): { title: string; body: string } {
  return {
    title: `${request.task}: verified candidate ${ready.accepted.candidate.sha.slice(0, 12)}`,
    body: [
      `Sandcastle candidate ${ready.accepted.candidate.sha} for ${request.task}, on base ${request.base}.`,
      `Candidate verification: receipt ${request.receipt} (run ${request.run}), issued by ${ready.receipt.issuer}: the base commit's checks ran on the candidate in an isolated container and an independent reviewer judged the diff.`,
      `Published by isolated publication from control checkout ${ready.controlHead}. The control checkout's own checks were not run and do not verify this candidate; this pull request's CI is the merge gate.`,
      "Only the owner merges.",
    ].join("\n\n"),
  };
}

function publish(context: Context, ready: Ready): string | Refusals {
  const { run, request } = context;
  const sha = ready.accepted.candidate.sha;
  const pushed = run("git", candidateGit(ready.accepted, ["push", ready.pushUrl, `${sha}:refs/heads/${ready.branch}`]));
  if (pushed.status !== 0) {
    throw new Error(`git push of ${sha} to ${ready.branch} failed (exit ${String(pushed.status)}). The push may or may not have reached origin: inspect origin's ${ready.branch} before rerunning, and never force-push.`);
  }
  let handed: string | { refusal: string };
  try {
    handed = handoff(run, { repository: ready.repository, branch: ready.branch, head: sha }, content(request, ready));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}. ${pushedNote(sha, ready.branch)}`, { cause: error });
  }
  return typeof handed === "string" ? handed : { refusals: [handed.refusal, pushedNote(sha, ready.branch)] };
}

/** Publish one verified candidate; refusals before the push leave origin unchanged. */
export async function publishCandidate(request: Request, options: Options = {}): Promise<{ url: string; ready: Ready } | Refusals> {
  const control = options.control ?? CONTROL_ROOT;
  const context: Context = { request, control, options, run: options.run ?? spawnRunner(control) };
  const ready = await verify(context);
  if ("refusals" in ready) return ready;
  const url = publish(context, ready);
  return typeof url === "string" ? { url, ready } : url;
}

export async function main(args: readonly string[], options: Options = {}): Promise<number> {
  const output = options.output ?? consoleOutput;
  if (args[0] === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  const request = parseArgs(args);
  if (typeof request === "string") {
    output.warn(request);
    return EXIT_ERROR;
  }
  const published = await publishCandidate(request, options);
  if ("refusals" in published) {
    for (const refusal of published.refusals) output.warn(`isolated-publication: ${refusal}`);
    return EXIT_REFUSED;
  }
  const { url, ready } = published;
  output.write(`isolated-publication: pull request ${url} is open for candidate ${ready.accepted.candidate.sha} on ${ready.branch}. Only the owner merges; this tool never does.`);
  output.write(`isolated-publication: candidate verification is receipt ${request.receipt} (base checks in an isolated container and an independent review).`);
  output.write(`isolated-publication: the control checkout ${ready.controlHead} supplied the publishing code and was not checked by this command; its checks say nothing about the candidate.`);
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
