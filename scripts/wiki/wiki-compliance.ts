// CLI for the wiki commit rule. Read-only; run with npm run wiki:compliance.
//
// The rule is always on. Zimi switched it on with a policy file, which meant a branch could
// switch it off by deleting that file; there is no switch to delete here.
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, runCli, type Output } from "../lib/cli.ts";
import { git, gitLines, gitPaths, mergeBase, refExists, type GitOptions } from "../lib/git.ts";
import { commitViolations, isConflictResolution, stagedMix, type Commit, type Violation } from "./wiki-compliance-validation.ts";

export type Options = { cwd?: string; output?: Output };

const USAGE = `Usage: node scripts/wiki/wiki-compliance.ts [--json | --staged]
Refuses a branch whose commits mix wiki/ with other files, or whose wiki-only commits lack a
"docs(wiki): " subject. --staged checks the index instead, for pre-commit.
Exit: 0 compliant, 1 refused, 2 the check could not run.`;
const SPLIT_ADVICE = "Commit the wiki/ files alone and the rest separately; to move a file across the boundary, add it in one commit and delete it in the next.";

// --no-renames: a rename is otherwise reported only at its destination, so moving a note out
// of wiki/ would hide the wiki side of a mixed commit.
// A merge is judged only on what it adds itself: --cc lists files that differ from every
// parent, which is empty for a clean merge of main and catches changes slipped in during one.
// A merge is judged only on what its author changed by hand: --remerge-diff compares the
// merge with git's own automatic merge of its parents, so a clean merge of main lists
// nothing, while conflict resolutions and changes slipped in during a merge are listed.
// (--cc is not enough: it lists files whose hunks came from both sides even when git merged
// them cleanly.) Requires git 2.36 or later.
// The conflict style is pinned so a user's diff3 setting cannot add base lines to "the sides".
const REMERGE = ["-c", "merge.conflictStyle=merge", "show", "--remerge-diff"];

function readCommit(sha: string, options: GitOptions): Commit {
  const parents = git(["rev-list", "--parents", "-n", "1", sha], options).split(" ").length - 1;
  const subject = git(["log", "-1", "--format=%s", sha], options);
  if (parents > 2) return { sha, subject, files: [], octopus: true };
  if (parents < 2) return { sha, subject, files: gitPaths(["show", "--no-renames", "--name-only", "--format=", sha], options) };
  const files = gitPaths([...REMERGE, "--name-only", "--format=", sha], options);
  return { sha, subject, files, resolutionOnly: isConflictResolution(git([...REMERGE, "--format=", sha], options)) };
}

function branchCommits(options: GitOptions): Commit[] {
  const base = mergeBase(options);
  return gitLines(["rev-list", `${base}..HEAD`], options).map((sha) => readCommit(sha, options));
}

// Concluding a merge stages the other side's changes, which always mixes wiki with code, so
// the staged check stands aside; the history check judges the merge commit on what it adds.
// An amend is not visible here either (the index is compared with the commit it replaces);
// the history check in pre-push and CI is what catches a mixed amend.
function checkStaged(options: GitOptions, output: Output): number {
  if (refExists("MERGE_HEAD", options)) return EXIT_OK;
  const mix = stagedMix(gitPaths(["diff", "--cached", "--name-only", "--no-renames"], options));
  if (mix === null) return EXIT_OK;
  output.warn(`wiki-compliance: the staged files mix ${mix.wiki.length} wiki file(s) with ${mix.other.length} other file(s):`);
  for (const file of [...mix.wiki, ...mix.other]) output.warn(`  ${file}`);
  output.warn(`wiki-compliance: ${SPLIT_ADVICE} A refused commit leaves its files staged; check git diff --cached --name-only.`);
  return EXIT_REFUSED;
}

function reportViolations(violations: readonly Violation[], output: Output): void {
  for (const violation of violations) {
    output.warn(`  x ${violation.sha.slice(0, 12)} [${violation.kind}] ${violation.detail} -- "${violation.subject}"`);
  }
  output.warn("wiki-compliance: this branch breaks the wiki commit rule.");
  const kinds = new Set(violations.map((violation) => violation.kind));
  if (kinds.has("mixed")) output.warn(`wiki-compliance: split each mixed commit. ${SPLIT_ADVICE}`);
  if (kinds.has("subject")) output.warn('wiki-compliance: reword each wiki-only commit so its subject begins "docs(wiki): " (a revert of one becomes "docs(wiki): revert ..."), and give a code commit a subject other than docs(wiki).');
}

function checkHistory(options: GitOptions, output: Output, json: boolean): number {
  if (mergeBase(options) === git(["rev-parse", "HEAD"], options) && !json) {
    // On main itself, or a branch with no commits yet: say so rather than report "0 commits".
    output.write("wiki-compliance: HEAD is the base; there are no branch commits to inspect");
    return EXIT_OK;
  }
  const commits = branchCommits(options);
  const violations = commitViolations(commits);
  const compliant = violations.length === 0;
  if (json) output.write(JSON.stringify({ compliant, inspected: commits.length, violations }));
  else if (compliant) output.write(`wiki-compliance: ${commits.length} commit(s) on this branch keep wiki and other files apart`);
  else reportViolations(violations, output);
  return compliant ? EXIT_OK : EXIT_REFUSED;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const gitOptions: GitOptions = options.cwd === undefined ? {} : { cwd: options.cwd };
  const [first, ...rest] = args;
  if (rest.length > 0 || (first !== undefined && !["--help", "--json", "--staged"].includes(first))) {
    output.warn("wiki-compliance: pass no arguments, --json or --staged. See --help.");
    return EXIT_ERROR;
  }
  if (first === "--help") {
    output.write(USAGE);
    return EXIT_OK;
  }
  if (first === "--staged") return checkStaged(gitOptions, output);
  if (first !== "--json") return checkHistory(gitOptions, output, false);
  try {
    return checkHistory(gitOptions, output, true);
  } catch (error) {
    // A JSON consumer gets JSON even when the inspection itself fails.
    output.write(JSON.stringify({ compliant: false, error: error instanceof Error ? error.message : String(error) }));
    return EXIT_ERROR;
  }
}

if (isEntryPoint(import.meta.url)) await runCli(() => main(process.argv.slice(2)));
