import type { RepoFixture } from "./repo-fixture.ts";

// Git effects a fake Sandcastle agent has in a coordinator fixture: an implementer or reviewer
// commits on its issue branch, a reviewer prints a verdict, a merger merges into the checkout.

/** Add one content commit to `branch` (created from the checked-out branch when missing) and return its SHA. */
export function commitOn(repo: RepoFixture, branch: string, label = "work"): string {
  const from = repo.git(["symbolic-ref", "--short", "HEAD"]);
  const exists = repo.git(["branch", "--list", branch]) !== "";
  repo.git(exists ? ["switch", "--quiet", branch] : ["switch", "--quiet", "-c", branch, from]);
  repo.write(`${branch.replaceAll("/", "-")}-${label}.md`, `${label}\n`);
  const sha = repo.commit(`feat: ${label} on ${branch}`);
  repo.git(["switch", "--quiet", from]);
  return sha;
}

export const tip = (repo: RepoFixture, branch: string): string => repo.git(["rev-parse", `refs/heads/${branch}`]);

/** A reviewer's output carrying a verdict for `sha`. */
export const verdict = (sha: string, outcome: "pass" | "fail" = "pass", reason = "checked"): string =>
  `Reviewed.\n<review>${JSON.stringify({ verdict: outcome, sha, reason })}</review>\n<promise>COMPLETE</promise>`;

/** Merge every branch the merger was handed (`- <branch>` lines) into the checked-out branch. */
export function mergeListed(repo: RepoFixture, branches: string | undefined): void {
  for (const line of (branches ?? "").split("\n")) {
    const branch = line.replace(/^- /, "").trim();
    if (branch !== "") repo.git(["merge", "--quiet", "--no-ff", "-m", `Merge ${branch}`, branch]);
  }
}
