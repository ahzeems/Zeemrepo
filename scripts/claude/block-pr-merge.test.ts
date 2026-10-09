import assert from "node:assert/strict";
import { test } from "node:test";
import { EXIT_OK, type Output } from "../lib/cli.ts";
import { HOOK_BLOCK, isPrMerge, main } from "./block-pr-merge.ts";

await test("ordinary work stays allowed", () => {
  for (const command of [
    "git status", "git push --set-upstream origin feat/x", "git merge origin/main", "npm run pr", "npm run check",
    "gh pr create --base main --fill", "gh pr view 7 --json state,mergedBy,mergeCommit", "gh pr checks 7",
    "gh pr comment 7 --body 'findings'", "gh api repos/o/r/pulls/7", "gh api repos/o/r/pulls/7/merge",
    "git commit -m 'docs: agents never run gh pr merge'", "grep -rn 'pulls/7/merge' docs",
  ]) assert.equal(isPrMerge(command), false, command);
});

await test("common ways to merge a pull request are blocked", () => {
  for (const command of [
    "gh pr merge 7", "gh pr merge 7 --squash --delete-branch", "gh -R o/r pr merge 7", "GH_TOKEN=x gh pr merge 7",
    "cd /repo && gh pr merge 7", "true; gh pr merge 7", "bash -c 'gh pr merge 7'",
    "gh api -X PUT repos/o/r/pulls/7/merge", "gh api --method PUT /repos/o/r/pulls/7/merge -f merge_method=squash",
    "gh api -XPUT repos/o/r/pulls/7/merge", "gh api graphql -f query='mutation { mergePullRequest(input:{}) { clientMutationId } }'",
    "gh api graphql -f query='mutation { enablePullRequestAutoMerge(input:{}) { clientMutationId } }'",
    "gh pr merge --auto 7",
    "curl -X PUT -H 'Authorization: token x' https://api.github.com/repos/o/r/pulls/7/merge",
  ]) assert.equal(isPrMerge(command), true, command);
});

await test("the hook blocks a merge with exit 2 and a reason, and passes everything else", () => {
  const run = (input: string): { code: number; err: string } => {
    const err: string[] = [];
    const output: Output = { write: () => undefined, warn: (line) => err.push(line) };
    return { code: main([], { stdin: input, output }), err: err.join("\n") };
  };
  const blocked = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr merge 7" } }));
  assert.equal(blocked.code, HOOK_BLOCK);
  assert.match(blocked.err, /only the owner merges/i);
  assert.equal(run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr view 7" } })).code, EXIT_OK);
  assert.equal(run(JSON.stringify({ tool_name: "Read", tool_input: { file_path: "x" } })).code, EXIT_OK);
  assert.equal(run("not json").code, HOOK_BLOCK, "unreadable input is refused, not waved through");
});
