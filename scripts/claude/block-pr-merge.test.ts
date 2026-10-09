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
    "git commit -m \"x\n\ngh pr merge was blocked\"", "git commit -F - <<'EOT'\nfix\n\ngh pr merge is blocked\nEOT",
    "gh pr create --body \"do not gh pr merge; owner only\"", "gh pr create --body 'see foo | gh pr merge'",
    "gh pr edit 7 --body \"run: gh pr merge\"", "git log --grep=\"gh pr merge\"", "echo gh pr merge 5",
    "gh pr review 7 --comment --body 'findings'", "gh pr review 7 --request-changes -b 'fix x'", "gh api repos/o/r/pulls/7/reviews",
    "gh api -X POST repos/o/r/pulls/7/reviews -f body='we do not approve of this' -f event=COMMENT", "gh pr review 7 -b approve",
    "gh pr review 7 -bapprove", "gh pr review 7 -Fa.txt", "gh api graphql -f query='{ viewer { login } }'",
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
    "gh --repo o/r pr merge 7", "sudo gh pr merge 7", "env GH_TOKEN=x gh pr merge 7", "command gh pr merge 7",
    "nohup gh pr merge 7", "(gh pr merge 7)", "{ gh pr merge 7; }", "if true; then gh pr merge 7; fi",
    "sh -c \"gh pr merge 7\"", "eval 'gh pr merge 7'",
    "gh pr review 7 --approve", "gh pr review 7 -a", "gh -R o/r pr review --approve 7",
    "/usr/bin/gh pr merge 7", "/home/linuxbrew/.linuxbrew/bin/gh pr review 7 --approve",
    "gh api -X POST repos/o/r/pulls/7/reviews -f event=approve",
    "gh pr review 7 --approve=true", "gh pr review 7 -ab ok", "gh api -X POST repos/o/r/pulls/7/reviews --input body.json",
    "gh api graphql -F query=@review.graphql -f id=x addPullRequestReview", "curl -X POST -d @body.json https://api.github.com/repos/o/r/pulls/7/reviews",
    "gh api graphql -F query=@approve.graphql -f pullRequestId=PR_x", "curl https://api.github.com/graphql -d @approve.json",
    "curl --json @f https://api.github.com/repos/o/r/pulls/7/reviews", "curl --data-urlencode @f https://api.github.com/repos/o/r/pulls/7/reviews",
    "curl -T f https://api.github.com/repos/o/r/pulls/7/reviews",
    "gh api -X POST repos/o/r/pulls/7/reviews -f event=APPROVE",
    "gh api graphql -f query='mutation { addPullRequestReview(input:{event: APPROVE}) { clientMutationId } }'",
    "gh api graphql -f query='mutation { submitPullRequestReview(input:{event: APPROVE}) { clientMutationId } }'",
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
