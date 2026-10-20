// CLI for the wiki commit rule. Read-only; run with npm run wiki:compliance.
//
// The rule is always on. A policy file that switched it on would let a branch switch it off
// by deleting that file, so there is no switch to delete.
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED, consoleOutput, isEntryPoint, readMode, runCli, type Output } from "../lib/cli.ts";
import { git, gitLines, gitOptionsAt, gitPaths, mergeBase, refExists, type GitOptions } from "../lib/git.ts";
import { REMERGE, commitViolations, isConflictResolution, stagedMix, type Commit, type Violation } from "./wiki-compliance-validation.ts";
import { historyFindings, readNoteChanges, type HistoryResult } from "./wiki-history.ts";

export type Options = { cwd?: string; output?: Output };

const USAGE = `Usage: node scripts/wiki/wiki-compliance.ts [--json | --staged]
Refuses a branch whose commits mix wiki/ with other files, or whose wiki-only commits lack a
"docs(wiki): " subject. It also compares each wiki note at the branch's base with HEAD and
refuses a changed created or agent, an edit that leaves updated behind, and a decision or
session body, rename or deletion after its day other than supersession. --staged checks the
index instead, for pre-commit, and judges neither subjects nor history.
Exit: 0 compliant, 1 refused, 2 the check could not run or the history could not be verified.`;
const SPLIT_ADVICE = "Commit the wiki/ files alone and the rest separately; to move a file across the boundary, add it in one commit and delete it in the next.";

// --no-renames: a rename is otherwise reported only at its destination, so moving a note out
// of wiki/ would hide the wiki side of a mixed commit.

function readCommit(sha: string, options: GitOptions): Commit {
  const parents = git(["rev-list", "--parents", "-n", "1", sha], options).split(" ").length - 1;
  const subject = git(["log", "-1", "--format=%s", sha], options);
  if (parents > 2) return { sha, subject, files: [], octopus: true };
  if (parents < 2) return { sha, subject, files: gitPaths(["show", "--no-renames", "--name-only", "--format=", sha], options) };
  const files = gitPaths([...REMERGE, "--name-only", "--format=", sha], options);
  return { sha, subject, files, resolutionOnly: isConflictResolution(git([...REMERGE, "--format=", sha], options)) };
}

function branchCommits(base: string, options: GitOptions): Commit[] {
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

const HISTORY_ADVICE = "wiki-compliance: created and agent never change, updated changes on every later edit, and a decision or session is not edited, renamed or deleted after its day. Write a new note and mark the old one superseded with superseded_by.";

function reportHistory(history: HistoryResult, output: Output): void {
  for (const finding of history.violations) output.warn(`  x [${finding.kind}] ${finding.path}: ${finding.detail}`);
  for (const finding of history.unverified) output.warn(`  ? [unverified] ${finding.path}: ${finding.detail}`);
  if (history.violations.length > 0) output.warn(HISTORY_ADVICE);
  if (history.unverified.length > 0) output.warn("wiki-compliance: the wiki history could not be verified; that is an error, not a pass.");
}

// A shallow clone may lack the base commit's notes or the commits that date an edit, so a
// missing history is an error rather than an empty one.
const SHALLOW = "the repository is shallow, so the wiki history cannot be verified; fetch the full history (fetch-depth: 0)";

function checkHistory(options: GitOptions, output: Output, json: boolean): number {
  if (git(["rev-parse", "--is-shallow-repository"], options) === "true") {
    if (json) output.write(JSON.stringify({ compliant: false, error: SHALLOW }));
    else output.warn(`wiki-compliance: ${SHALLOW}`);
    return EXIT_ERROR;
  }
  const base = mergeBase(options);
  if (base === git(["rev-parse", "HEAD"], options) && !json) {
    // On main itself, or a branch with no commits yet: say so rather than report "0 commits".
    output.write("wiki-compliance: HEAD is the base; there are no branch commits to inspect");
    return EXIT_OK;
  }
  const commits = branchCommits(base, options);
  const violations = commitViolations(commits);
  const history = historyFindings(readNoteChanges(base, options));
  const compliant = violations.length === 0 && history.violations.length === 0 && history.unverified.length === 0;
  if (json) output.write(JSON.stringify({ compliant, inspected: commits.length, violations, history }));
  else if (compliant) output.write(`wiki-compliance: ${commits.length} commit(s) on this branch keep wiki and other files apart and keep wiki history`);
  else {
    if (violations.length > 0) reportViolations(violations, output);
    reportHistory(history, output);
  }
  if (history.unverified.length > 0) return EXIT_ERROR;
  return compliant ? EXIT_OK : EXIT_REFUSED;
}

export function main(args: readonly string[], options: Options = {}): number {
  const output = options.output ?? consoleOutput;
  const gitOptions = gitOptionsAt(options.cwd);
  const parsed = readMode(args, { name: "wiki-compliance", usage: USAGE, modes: ["--json", "--staged"] }, output);
  if ("exit" in parsed) return parsed.exit;
  const first = parsed.mode;
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
