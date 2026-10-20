import { tryGit } from "../lib/git.ts";

// The SDK runs each !`...` block of a prompt file with `sh -c` after substituting {{KEY}} values,
// so a value that reaches a block is shell code. The review prompt's blocks take only BASE and
// CANDIDATE, full commit ids that can hold no shell syntax and name exactly one commit. Branch
// names stay in the prose, where the SDK treats them as text.
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export type ReviewArgs = { readonly BRANCH: string; readonly BASE: string; readonly CANDIDATE: string };

/** The reviewer's prompt arguments, or why the review cannot be prepared. */
export function reviewInputs(cwd: string, branch: string, candidate: string): { promptArgs: ReviewArgs } | { refusal: string } {
  const base = tryGit(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"], { cwd });
  if (base === null) return { refusal: "the checked-out branch has no commit to review against" };
  const invalid = Object.entries({ base, candidate }).filter(([, sha]) => !OBJECT_ID.test(sha)).map(([name]) => name);
  if (invalid.length > 0) return { refusal: `the review ${invalid.join(" and ")} must be a full commit id` };
  return { promptArgs: { BRANCH: branch, BASE: base, CANDIDATE: candidate } };
}
