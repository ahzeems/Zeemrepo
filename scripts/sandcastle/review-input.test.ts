import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createSandbox, type AgentProvider } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { cleanGitEnv, createRepo, type RepoFixture } from "../test-support/repo-fixture.ts";
import { runSandcastle } from "./coordinator.ts";
import type { Plan } from "./plan-schema.ts";
import { reviewInputs } from "./review-input.ts";

// The review prompt's !`...` blocks are run by the SDK with `sh -c` after {{KEY}} substitution, so
// any value substituted into a block is shell code. These tests drive the real SDK (createSandbox
// with the noSandbox provider) through the coordinator, with a fake agent that records the prompt
// it is handed: no model, container or network. The host branch is where the sentinel goes,
// because it is the one branch name the plan schema does not constrain.

const ROOT = new URL("../..", import.meta.url).pathname;
const SENTINEL = "s11-sentinel";
const ISSUE = { id: "1", title: "Fixture issue", branch: "sandcastle/issue-1" };
const CHANGE = "s11 reviewed line";
const IMPLEMENT = [
  `printf '${CHANGE}\\n' > change.txt`,
  "git add change.txt",
  "git -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit -q -m 'feat: s11 fixture change'",
  "echo '<promise>COMPLETE</promise>'",
].join(" && ");

const sentinels = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((path) => path.split("/").some((part) => part.startsWith(SENTINEL)));

function fakeAgent(prompts: string[]): AgentProvider {
  return {
    name: "s11-fake",
    env: {},
    captureSessions: false,
    buildPrintCommand: ({ prompt }) => {
      prompts.push(prompt);
      return { command: prompts.length === 1 ? IMPLEMENT : "echo '<promise>COMPLETE</promise>'" };
    },
    parseStreamLine: (line) => [{ type: "text", text: line }],
  };
}

function planner(): { (options: { output: unknown }): Promise<{ output: Plan }>; (options: object): Promise<unknown> } {
  const plans: Plan[] = [{ issues: [ISSUE], blocked: [] }, { issues: [], blocked: [] }];
  function run(options: { output: unknown }): Promise<{ output: Plan }>;
  function run(options: object): Promise<unknown>;
  async function run(options: object): Promise<unknown> {
    await Promise.resolve();
    return "output" in options ? { output: plans.shift() ?? { issues: [], blocked: [] } } : {};
  }
  return run;
}

// The SDK's sandbox setup runs `git config --global` on the host when there is no container, so
// the process gets a throwaway global config, and no GIT_ variable from a calling hook.
function isolateGit(t: TestContext): void {
  const home = mkdtempSync(join(tmpdir(), "s11-git-home-"));
  const saved = process.env;
  process.env = { ...cleanGitEnv, GIT_CONFIG_GLOBAL: join(home, "gitconfig") };
  const before = process.cwd();
  process.chdir(ROOT);
  t.after(() => {
    process.env = saved;
    process.chdir(before);
    rmSync(home, { recursive: true, force: true });
  });
}

type Prepared = { prompts: string[]; repo: RepoFixture; outcome: unknown };

async function prepare(t: TestContext, hostBranch: string): Promise<Prepared> {
  isolateGit(t);
  const repo = createRepo("s11-review-");
  t.after(() => repo.cleanup());
  repo.commit("base");
  repo.git(["switch", "--quiet", "-c", hostBranch]);
  const prompts: string[] = [];
  const sink: string[] = [];
  t.mock.method(console, "log", (line: string) => sink.push(line));
  const result = await runSandcastle({
    cwd: repo.dir,
    sandcastle: {
      claudeCode: () => fakeAgent(prompts),
      docker: () => noSandbox(),
      Output: { object: (definition) => definition },
      run: planner(),
      createSandbox: (options) => createSandbox({ branch: options.branch, sandbox: options.sandbox, cwd: repo.dir }),
    },
    log: (line) => sink.push(line),
    error: (line) => sink.push(line),
  });
  return { prompts, repo, outcome: result.issues[0]?.outcome };
}

function assertIntendedReview(prepared: Prepared): void {
  const { prompts, repo, outcome } = prepared;
  assert.deepEqual(sentinels(repo.dir), [], "no substituted shell syntax ran");
  const candidate = repo.git(["rev-parse", `refs/heads/${ISSUE.branch}`]);
  assert.equal(prompts.length, 2, `outcome: ${JSON.stringify(outcome)}`);
  const review = prompts[1] ?? "";
  assert.match(review, new RegExp(`\\+${CHANGE}\\n`), "the prepared diff carries the candidate's change");
  assert.match(review, new RegExp(`${candidate.slice(0, 7)}[0-9a-f]* feat: s11 fixture change`), "the prepared log carries the candidate commit");
  assert.ok(review.includes(candidate), "the prompt names the candidate");
}

await test("an ordinary host branch prepares the candidate's diff and log", async (t) => {
  assertIntendedReview(await prepare(t, "feat/work"));
});

for (const hostBranch of [
  `feat/$(touch\${IFS}${SENTINEL}-dollar)`,
  `feat/\`touch\${IFS}${SENTINEL}-tick\``,
  `feat/x;touch\${IFS}${SENTINEL}-semi`,
  `feat/x|touch\${IFS}${SENTINEL}-pipe`,
  `feat/x&touch\${IFS}${SENTINEL}-amp`,
  `feat/it's"quoted"`,
]) {
  await test(`a Git-valid host branch ${hostBranch} stays data: nothing runs and the diff is unchanged`, async (t) => {
    assertIntendedReview(await prepare(t, hostBranch));
  });
}

const OBJECT_ID = /^[0-9a-f]{40}$/;

await test("reviewInputs names the checkout's HEAD commit as the base and keeps the branch as text", (t) => {
  const repo = createRepo("s11-inputs-");
  t.after(() => repo.cleanup());
  const base = repo.commit("base");
  repo.git(["switch", "--quiet", "-c", "feat/$(x)"]);
  const candidate = repo.commit("work");
  repo.git(["switch", "--quiet", "--detach", base]);
  assert.deepEqual(reviewInputs(repo.dir, ISSUE.branch, candidate), { promptArgs: { BRANCH: ISSUE.branch, BASE: base, CANDIDATE: candidate } });
  assert.match(base, OBJECT_ID);
});

await test("reviewInputs refuses a checkout with no commit and a candidate that is not an object id", (t) => {
  const repo = createRepo("s11-inputs-");
  t.after(() => repo.cleanup());
  const unborn = reviewInputs(repo.dir, ISSUE.branch, "a".repeat(40));
  assert.ok("refusal" in unborn);
  assert.match(unborn.refusal, /no commit/);
  const base = repo.commit("base");
  for (const candidate of ["HEAD", "$(touch x)", base.slice(0, 12), `${base}\n`, base.toUpperCase()]) {
    const refused = reviewInputs(repo.dir, ISSUE.branch, candidate);
    assert.ok("refusal" in refused, candidate);
    assert.match(refused.refusal, /full commit id/);
  }
});

// Every value the SDK substitutes into a !`...` block is executed; only object ids are allowed there.
await test("no Sandcastle prompt substitutes anything but a verified commit id into a shell block", () => {
  for (const name of readdirSync(join(ROOT, ".sandcastle")).filter((file) => file.endsWith(".md"))) {
    const text = readFileSync(join(ROOT, ".sandcastle", name), "utf8");
    for (const [, block] of text.matchAll(/!`([^`]+)`/g)) {
      const keys = [...(block ?? "").matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map(([, key]) => key);
      assert.deepEqual(keys.filter((key) => key !== "BASE" && key !== "CANDIDATE"), [], `${name}: ${block ?? ""}`);
    }
  }
});
