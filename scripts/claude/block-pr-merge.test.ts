import assert from "node:assert/strict";
import { test } from "node:test";
import { EXIT_OK, type Output } from "../lib/cli.ts";
import { HOOK_BLOCK, isPrMerge, isPushingToMain, main } from "./block-pr-merge.ts";

const run = (input: string): { code: number; err: string } => {
  const err: string[] = [];
  const output: Output = { write: () => undefined, warn: (line) => err.push(line) };
  return { code: main([], { stdin: input, output }), err: err.join("\n") };
};
const runBash = (command: string): { code: number; err: string } => run(JSON.stringify({ tool_name: "Bash", tool_input: { command } }));

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
    "git commit -m 'never run $(gh pr merge 5)'", "git commit -m \"never run \\$(gh pr merge 5)\"",
    "git commit -F - <<'EOT'\nfix: block $(gh pr merge 5)\nEOT",
    "cat <<EOF > notes.md\ngh pr merge is the owner's act\nEOF", "npm test \\\n  -- --grep merge", "echo 'gh pr merge 5' | grep merge",
    "git commit -m 'C:\\\\gh\\\\merge'",
  ]) assert.equal(isPrMerge(command), false, command);
});

await test("line continuations, backslash escapes and shell input fed by a heredoc or pipe are read as commands", () => {
  for (const command of [
    "gh pr merge\\\n 5", "gh \\\n  pr merge 5", "gh pr me\\rge 5", "\\g\\h pr merge 5",
    "bash <<EOF\ngh pr merge 5\nEOF", "sh <<'EOF'\ngh pr merge 5\nEOF", "bash -s <<-EOF\n\tgh pr merge 5\n\tEOF",
    "cat <<EOF | bash\ngh pr merge 5\nEOF", "echo 'gh pr merge 5' | bash", "printf '%s\\n' \"gh pr merge 5\" | /bin/sh",
  ]) assert.equal(isPrMerge(command), true, command);
  for (const command of [
    "git push \\\n  origin main", "git push origin \\\n  HEAD:main", "git push origin HEAD:ma\\in", "bash <<EOF\ngit push origin main\nEOF",
  ]) assert.equal(isPushingToMain(command), true, command);
  for (const command of ["git push \\\n  origin feat/x", "cat <<EOF | bash\ngit push origin feat/x\nEOF"]) {
    assert.equal(isPushingToMain(command), false, command);
  }
});

// bash 5.3 (2026-10-11) joins a continuation with nothing (ec\<newline>ho runs echo) and keeps a
// quoted-delimiter heredoc body as written. It does not join a backslash before CRLF; the hook
// does, which refuses more than bash would run.
await test("the shell's own joining and heredoc rules decide what runs", () => {
  for (const command of [
    "gh pr me\\\nrge 5", "gh pr me\\\r\nrge 5", "gh\\\r\n pr merge 5",
    "echo 'gh pr merge 5' | env FOO=1 bash", "echo 'gh pr merge 5' | sudo -u root bash", "cat <<EOF | env X=1 bash\ngh pr merge 5\nEOF",
    "env FOO=1 bash <<EOF\ngh pr merge 5\nEOF", "FOO=1 bash <<EOF\ngh pr merge 5\nEOF", "cat <<EOF | sudo -u root sh\ngh pr merge 5\nEOF",
    "echo 'gh pr merge 5' | sudo -u root -E bash", "echo 'gh pr merge 5' | env -u X A=1 bash", "echo 'gh pr merge 5' | nice -n 5 bash",
    "echo 'gh pr merge 5' | timeout 5 bash", "echo 'gh pr merge 5' |\n bash", "cat f | echo 'gh pr merge 5' | bash",
    "cat <<'EOF' > f\nfoo \\\nEOF\ngh pr merge 5\nEOF",
    "cat <<A <<B | bash\nx\nA\ngh pr merge 5\nB", "cat <<A | bash <<B\nx\nA\ngh pr merge 5\nB",
    "cat <<EOF | sudo bash\ngh pr merge 5\nEOF", "sudo bash <<EOF\ngh pr merge 5\nEOF", "bash --norc <<EOF\ngh pr merge 5\nEOF",
    "bash 0<<EOF\ngh pr merge 5\nEOF", "echo 'gh pr merge 5' | env bash", "echo 'gh pr merge 5' | dash",
    "echo gh pr merge 5 | bash", "echo 'x; gh pr merge 5' | bash", "bash <<< 'gh pr merge 5'", "bash <<<\"gh pr merge 5\"",
  ]) assert.equal(isPrMerge(command), true, command);
  for (const command of [
    "cat <<EOF > f\nfoo \\\nEOF\ngh pr merge 5\nEOF",
    "git commit -m 'bash | sh' -m 'gh pr merge 5'", "grep -rn \"gh pr merge 5\" docs | sh", "git log --grep='gh pr merge' | sh",
    "echo 'gh pr merge 5' | sh -n", "cat <<'EOF' | grep merge\ngh pr merge 5\nEOF", "git log --format=%s | shasum",
    "echo 'gh pr merge 5' | env grep sh", "echo 'gh pr merge 5' | sudo tee bash/notes", "sudo tee bash <<EOF\ngh pr merge 5 docs\nEOF",
    "exec cat sh <<EOF\ngh pr merge 5 docs\nEOF",
  ]) assert.equal(isPrMerge(command), false, command);
});

// A wall-clock bound flakes on a loaded machine, so this compares growth instead: four times the
// input takes about four times as long when judging is linear and sixteen times when it is
// quadratic, so the threshold sits between them, with room for load. The two sizes run in turn, so a
// change in load hits both, and each keeps its fastest of five runs. A pair too fast to measure
// passes, and a pair over the threshold is measured again: a quadratic exceeds it every time, a
// burst of load rarely three times running.
const judge = (command: string): number => {
  const started = performance.now();
  isPrMerge(command);
  isPushingToMain(command);
  return performance.now() - started;
};
const RUNS = 5;
const ATTEMPTS = 3;
const SIZE_FACTOR = 4;
const MAX_GROWTH = 8;
const MEASURABLE_MS = 50;

function growth(small: string, large: string): { smallMs: number; largeMs: number; grows: boolean } {
  let smallMs = Infinity;
  let largeMs = Infinity;
  for (let run = 0; run < RUNS; run++) {
    smallMs = Math.min(smallMs, judge(small));
    largeMs = Math.min(largeMs, judge(large));
  }
  return { smallMs, largeMs, grows: largeMs >= MEASURABLE_MS && largeMs / smallMs >= MAX_GROWTH };
}

await test("a long command is judged in linear time, not quadratically", () => {
  const inputs: Array<[(size: number) => string, number]> = [
    [(size) => "\n".repeat(size), 12_500], [(size) => " \n".repeat(size), 6_250], [(size) => "echo a | bash\n".repeat(size), 1_000],
    [(size) => "a=b|".repeat(size), 3_000], [(size) => "a=b;".repeat(size), 3_000], [(size) => "a|".repeat(size), 6_250],
    [(size) => "if ".repeat(size), 6_250], [(size) => `cat <<EOF\n${"$(x) ".repeat(size)}\nEOF`, 2_500],
    [(size) => `cat <<EOF\n${"`".repeat(size)}\nEOF`, 6_250], [(size) => `cat <<EOF\n${"$(".repeat(size)}\nEOF`, 6_250],
    [(size) => "cat <<A\nA\n".repeat(size), 2_000], [(size) => `git push --repo=origin ${"x ".repeat(size)}`, 6_250],
    [(size) => "cat <<EOF\n".repeat(size), 500], [(size) => "bash <<EOF\n".repeat(size), 500],
  ];
  for (const [make, size] of inputs) {
    const [small, large] = [make(size), make(SIZE_FACTOR * size)];
    let result = growth(small, large);
    for (let attempt = 1; attempt < ATTEMPTS && result.grows; attempt++) result = growth(small, large);
    const label = `${JSON.stringify(make(1))}: ${Math.round(result.smallMs)} ms at ${size}, ${Math.round(result.largeMs)} ms at ${SIZE_FACTOR * size}`;
    assert.ok(!result.grows, label);
  }
});

await test("the heredoc scanner closes, skips and keeps lines as bash does", () => {
  for (const command of [
    "cat <<EOF\nEOF\ngh pr merge 5\nEOF", "gh pr merge 5\ncat <<EOF\nx\nEOF", "cat <<<EOF\ngh pr merge 5\nEOF",
    "cat <<EOF\ncat <<X\nEOF\ngh pr merge 5\nX", "cat <<EOF\nx\ngh pr merge 5",
  ]) assert.equal(runBash(command).code, HOOK_BLOCK, command);
  for (const command of ["cat <<-EOF\n\tgh pr merge is the owner's act\n\tEOF", "cat <<EOF\nx\nEOF\ncat <<EOF\ngh pr merge notes\nEOF"]) {
    assert.equal(runBash(command).code, EXIT_OK, command);
  }
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
    "curl -T f https://api.github.com/repos/o/r/pulls/7/reviews", "curl -Tf https://api.github.com/repos/o/r/pulls/7/reviews",
    "curl --upload-file f https://api.github.com/repos/o/r/pulls/7/reviews", "curl --data-urlencode body@f https://api.github.com/repos/o/r/pulls/7/reviews",
    "gh api -X POST repos/o/r/pulls/7/reviews -f event=APPROVE",
    "gh api graphql -f query='mutation { addPullRequestReview(input:{event: APPROVE}) { clientMutationId } }'",
    "gh api graphql -f query='mutation { submitPullRequestReview(input:{event: APPROVE}) { clientMutationId } }'",
    "true & gh pr merge 5", "x=`gh pr merge 5`", "env -i gh pr merge 5", "timeout 5 gh pr merge 5", "nice gh pr merge 5",
    "nice -n 5 gh pr merge 5", "echo 5 | xargs gh pr merge", "setsid gh pr merge 5", "stdbuf -oL gh pr merge 5",
    "sudo -u owner gh pr merge 5", "\"gh\" pr merge 5", "'gh' pr merge 5",
    "\\gh pr merge 5", "/usr/bin/env gh pr merge 5", "/usr/bin/sudo gh pr merge 5", "gh api repos/o/r/pulls/1/merge -X 'PUT'",
    "gh api repos/o/r/pulls/1/merge -X \"PUT\"", "bash -lc 'gh pr merge 5'", "bash -ec \"gh pr merge 5\"",
    "env -S 'gh pr merge 5'", "/usr/bin/env -S \"gh pr merge 5\"", "bash -l -c 'gh pr merge 5'", "bash -c -- 'gh pr merge 5'", "/usr/bin/env -S gh pr merge 5", "doas gh pr merge 5",
    "echo \"$(gh pr merge 5)\"", "x=$(gh pr merge 5)",
  ]) assert.equal(isPrMerge(command), true, command);
});

await test("a push whose destination is main is blocked; other pushes are not", () => {
  for (const command of [
    "git push origin main", "git push -u origin main", "git push origin HEAD:main", "git push origin +HEAD:main",
    "git push origin HEAD:refs/heads/main", "git push --force-with-lease origin feat/x:main", "git -C /repo push origin main",
    "git push --force origin feat/x main", "git push --all origin", "git push --mirror origin", "cd x && git push origin main",
    "git push -o ci.skip origin main", "git push origin :main", "git push origin feat/x:refs/heads/main",
    "git --git-dir .git push origin main", "git --work-tree x push origin main", "git --namespace n push origin main",
    "git push origin \"main\"", "git push origin 'HEAD:main'", "\"git\" push origin main", "timeout 30 git push origin main", "\\git push origin main",
  ]) assert.equal(isPushingToMain(command), true, command);
  for (const command of [
    "git push", "git push origin", "git push -u origin feat/x", "git push origin feat/main-fix", "git push origin main:feat/x",
    "git push --set-upstream origin chore/phase-10", "git commit -m 'never git push origin main'", "git fetch origin main",
    "git push origin --delete feat/old", "git push -o main origin feat/x",
  ]) assert.equal(isPushingToMain(command), false, command);
});

await test("the hook blocks a merge with exit 2 and a reason, and passes everything else", () => {
  const blocked = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr merge 7" } }));
  assert.equal(blocked.code, HOOK_BLOCK);
  assert.match(blocked.err, /only the owner merges/i);
  assert.equal(run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr view 7" } })).code, EXIT_OK);
  assert.equal(run(JSON.stringify({ tool_name: "Read", tool_input: { file_path: "x" } })).code, EXIT_OK);
  assert.equal(run("not json").code, HOOK_BLOCK, "unreadable input is refused, not waved through");
  const push = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push origin HEAD:main" } }));
  assert.equal(push.code, HOOK_BLOCK);
  assert.match(push.err, /never pushed to main/i);
});

// Audit A22 (2026-10-16): forms the hook's own functions allowed before S25.
await test("a merge in a conditional's command position is refused at the hook boundary", () => {
  for (const command of [
    "if gh pr merge 5; then :; fi", "while gh pr merge 5; do :; done", "until gh pr merge 5; do :; done",
    "if true; then :; elif gh pr merge 5; then :; fi", "if ! gh pr merge 5; then :; fi", "if sudo gh pr merge 5; then :; fi",
    "if gh pr review 5 --approve; then :; fi", "if git push origin main; then :; fi",
  ]) {
    const result = runBash(command);
    assert.equal(result.code, HOOK_BLOCK, command);
    assert.match(result.err, /only the owner merges|never pushed to main/i, command);
  }
  for (const command of [
    "if git diff --quiet; then echo clean; fi", "while read -r line; do echo \"$line\"; done < notes.txt",
    "until gh pr checks 5; do sleep 10; done", "if gh pr view 5 --json state; then :; fi", "grep -n if docs/x.md",
    "git commit -m 'never write: if gh pr merge 5; then :; fi'", "echo while gh pr merge 5",
  ]) assert.equal(runBash(command).code, EXIT_OK, command);
});

await test("a command substitution in an unquoted heredoc is refused; quoted or escaped heredoc data passes", () => {
  for (const command of [
    "cat <<EOF\n$(gh pr merge 5)\nEOF", "cat <<EOF > f\nnote $(gh pr merge 5)\nEOF", "cat <<EOF\n`gh pr merge 5`\nEOF",
    "cat <<-EOF\n\tx $(gh pr merge 5)\n\tEOF", "cat <<EOF\n'$(gh pr merge 5)'\nEOF", "git commit -F - <<EOF\nfix $(gh pr merge 5)\nEOF",
    "cat <<EOF\n\"`gh pr review 5 --approve`\"\nEOF", "cat <<EOF\n$(git push origin main)\nEOF", "cat <<EOF\n$(sudo gh pr merge 5)\nEOF",
    "cat <<EOF\n\\\\$(gh pr merge 5)\nEOF", "cat <<EOF\n\\\\`gh pr merge 5`\nEOF", "cat <<EOF\n\\\\\\\\$(gh pr merge 5)\nEOF",
  ]) {
    const result = runBash(command);
    assert.equal(result.code, HOOK_BLOCK, command);
    assert.match(result.err, /only the owner merges|never pushed to main/i, command);
  }
  for (const command of [
    "cat <<'EOF'\n$(gh pr merge 5)\nEOF", "cat <<\"EOF\"\n`gh pr merge 5`\nEOF", "cat <<EOF\n\\$(gh pr merge 5)\nEOF",
    "cat <<EOF\n\\`gh pr merge 5\\`\nEOF", "cat <<EOF > notes.md\ngh pr merge is the owner's act\nEOF",
    "cat <<EOF\nbuilt $(date -u +%F) by $(git rev-parse --short HEAD)\nEOF", "git commit -F - <<'EOT'\nfix: block $(gh pr merge 5)\nEOT",
    "cat <<EOF\n$(git push origin feat/x)\nEOF", "cat <<EOF\n\\\\\\$(gh pr merge 5)\nEOF", "cat <<EOF\n\\\\\\`gh pr merge 5\\`\nEOF",
    "cat <<EOF > 'notes $(gh pr merge 5).md'\nbody\nEOF",
  ]) assert.equal(runBash(command).code, EXIT_OK, command);
});

// git 2.53 reads the first positional as the repository even when --repo is given (probed
// 2026-10-18 with a harmless branch name). The hook cannot tell which one the author meant, so with
// --repo every positional is judged as a possible destination; that refuses more than git pushes.
await test("a push with an explicit --repo option is judged on every destination it names", () => {
  for (const command of [
    "git push --repo=origin main", "git push --repo origin main", "git push --repo=origin HEAD:main", "git push --repo origin HEAD:main",
    "git push --repo=origin +HEAD:refs/heads/main", "git push --repo=origin origin main", "git push --repo origin origin HEAD:main",
    "git push origin main --repo=origin", "git push -u --repo=origin feat/x:main",
  ]) {
    const result = runBash(command);
    assert.equal(result.code, HOOK_BLOCK, command);
    assert.match(result.err, /never pushed to main/i, command);
  }
  for (const command of [
    "git push --repo=origin feat/x", "git push --repo origin feat/x", "git push --repo=origin main:feat/x", "git push --repo=main feat/x",
    "git push --repo main feat/x", "git push --repo=origin origin feat/x", "git push -o main --repo=origin feat/x",
    "git push main feat/x",
  ]) assert.equal(runBash(command).code, EXIT_OK, command);
});
