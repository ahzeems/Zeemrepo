// The real-container control for the trusted verifier driver (S15). npm run sandbox:smoke runs it
// after the containment proof, on the image it just built, so the required CI check exercises the
// driver end to end with real Docker: a good fixture candidate must receive a receipt that validates
// from the host store, and a candidate that rewrites its test script to a no-op must still fail the
// base commit's check. The reviewer is the fake one (OWNER DECISION, 2026-10-18, relayed by the
// coordinator: "Fake reviewer only (Recommended)"); no model is called. Missing Docker is blocked.
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { CHECKS, createVerifierCandidate, fakeReviewer, packageWithTest, type VerifierFixture } from "../test-support/verifier-fixture.ts";
import { dockerCli, dockerRuntime, type Docker } from "./container-runtime.ts";
import { validateReceipt } from "./verification-receipt.ts";
import { trustedChecksDigest, verifyCandidate, type Verification } from "./verifier-driver.ts";

const USAGE = `Usage: node scripts/sandcastle/verifier-driver-smoke.ts <image>
Runs the verifier driver on two fixture candidates in real containers from <image>, with a fake
reviewer. Exit: 0 the driver behaved, 1 it did not or Docker is missing, 2 called wrongly.`;

function verify(made: VerifierFixture, docker: Docker, image: string): Promise<Verification> {
  return verifyCandidate(
    { artifacts: made.artifacts, source: made.host.dir, expected: made.expected, run: made.run, store: made.store, root: made.root, checks: CHECKS },
    { runtime: dockerRuntime(docker, image, [made.store]), reviewer: fakeReviewer() },
  );
}

const described = (outcome: Verification): string => (outcome.status === "blocked" ? outcome.reasons.join("; ") : outcome.status === "refused" ? outcome.refusals.join("; ") : outcome.status);

async function goodRefusals(made: VerifierFixture, docker: Docker, image: string): Promise<string[]> {
  const outcome = await verify(made, docker, image);
  if (outcome.status !== "passed") return [`the good candidate did not pass verification: ${described(outcome)}`];
  const checks = trustedChecksDigest(made.host.dir, made.base, CHECKS);
  if ("refusals" in checks) return checks.refusals;
  const expected = { repository: made.expected.repository, task: made.expected.task, run: made.run, base: made.base, candidate: made.candidate, checksSha256: checks.digest };
  const valid = validateReceipt(made.store, outcome.digest, expected, { source: made.host.dir, artifacts: made.artifacts });
  if ("refusals" in valid) return valid.refusals.map((refusal) => `the good candidate's receipt does not validate: ${refusal}`);
  return valid.humanReview.length === 0 ? [] : [`the good candidate was flagged for human review: ${valid.humanReview.join(", ")}`];
}

async function noopRefusals(made: VerifierFixture, docker: Docker, image: string): Promise<string[]> {
  const outcome = await verify(made, docker, image);
  if (outcome.status !== "failed") return [`the candidate that rewrote its test to a no-op was not failed: ${described(outcome)}`];
  const failing = outcome.receipt.checks.results.filter((step) => step.exit !== 0).map((step) => step.name);
  const refusals = failing.includes("test") ? [] : ["the no-op candidate failed, but not on the base commit's test"];
  if (!outcome.receipt.checkMachinery.changed.includes("package.json")) refusals.push("the no-op candidate's package.json change was not flagged for human review");
  return refusals;
}

/** Refusals unless the driver issues a valid receipt for a good candidate and fails a no-op rewrite in real containers. */
export async function verifierControl(image: string, docker: Docker = dockerCli()): Promise<string[]> {
  if (dockerRuntime(docker, image).identity() === null) return [`blocked: Docker or the image ${image} is not available, so the verifier driver was not exercised. This is not a pass.`];
  const good = createVerifierCandidate();
  const noop = createVerifierCandidate({ files: { "package.json": packageWithTest("exit 0"), "feature.txt": "broken\n" } });
  try {
    return [...await goodRefusals(good, docker, image), ...await noopRefusals(noop, docker, image)];
  } finally {
    good.cleanup();
    noop.cleanup();
  }
}

export async function main(args: readonly string[], options: { output?: Output; docker?: Docker } = {}): Promise<number> {
  const output = options.output ?? consoleOutput;
  const [image] = args;
  if (image === undefined || args.length !== 1 || image.startsWith("-")) {
    output.warn(USAGE);
    return EXIT_ERROR;
  }
  const refusals = await verifierControl(image, options.docker);
  for (const refusal of refusals) output.warn(`verifier-control: ${refusal}`);
  if (refusals.length > 0) return EXIT_REFUSED;
  output.write("verifier-control: the driver issued a receipt that validates from the host store for the good candidate and failed the no-op rewrite on the base commit's check.");
  return EXIT_OK;
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
