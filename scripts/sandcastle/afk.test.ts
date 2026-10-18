import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PROMPT_REPO } from "./afk.ts";
import { test } from "node:test";
import type { Run } from "../git/pr-ready.ts";
import { EXIT_ERROR, EXIT_OK, EXIT_REFUSED } from "../lib/cli.ts";
import { AFK_ORIGIN, GH_REPO, PR_URL, comments, exactPr, fixture, go, issueBranch, mergeInto, publish, prList, runner, sawAnything, type AfkFixture } from "../test-support/afk-harness.ts";

await test("the issues this run merged are announced on a pull request and commented on, and nothing merges", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-12");
  issueBranch(repo, "sandcastle/issue-4");
  issueBranch(repo, "sandcastle/issue-7");
  issueBranch(repo, "sandcastle/issue-9");
  issueBranch(repo, "sandcastle/other");
  issueBranch(repo, "feature/issue-3");
  // issue 9 already reached main, so it is not this run's to announce
  mergeInto(repo, "main", "sandcastle/issue-9");
  publish(repo, "main");
  repo.git(["switch", "--quiet", "feat/afk-work"]);
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-12");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-9");
      mergeInto(repo, "feat/afk-work", "sandcastle/other");
      mergeInto(repo, "feat/afk-work", "feature/issue-3");
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, new RegExp(PR_URL));
  const nonGit = calls.filter((call) => !call.startsWith("git "));
  assert.deepEqual(nonGit.slice(0, 3), [GH_REPO, "node .sandcastle/main.ts", "node scripts/git/pr-ready.ts"],
    "repository and login first, then the loop, then the landing tool");
  assert.ok(nonGit[3]?.startsWith("gh pr list --repo github.com/Zimfra/software_testing --head feat/afk-work --state open --json "),
    "then the pull request it opened, looked up in the named repository and host");
  assert.equal(comments(calls).length, 2, "one comment per merged issue branch, and no other");
  assert.equal(nonGit.length, 6);
  const [first, second] = comments(calls);
  assert.match(first ?? "", /^gh issue comment 4 -R github\.com\/Zimfra\/software_testing --body /);
  assert.match(second ?? "", /^gh issue comment 12 -R github\.com\/Zimfra\/software_testing --body /);
  assert.ok(first?.includes(PR_URL) && first.includes("waiting for the owner's review"));
  assert.ok(first?.includes("may be incomplete") === true && !/\bopened\b/.test(first ?? ""), "does not claim to have opened the pull request or that the work is finished");
  // Reading origin's push URL is the only call allowed to name push.
  assert.ok(!calls.filter((call) => call !== "git remote get-url --all --push origin").some((call) => /push|--no-verify|\.env|issue close|pr merge|pr review|--admin/.test(call.replace(PR_URL, ""))), "no push, no bypass, no .env, no close or merge");
});

await test("nothing merged by this run opens nothing and exits 0", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-5");
  const { run, calls } = runner(repo);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /no Sandcastle issue branch was merged/i);
  assert.deepEqual(calls.filter((call) => !call.startsWith("git ")), [GH_REPO, "node .sandcastle/main.ts"]);
});

await test("a failing Sandcastle loop stops the run with exit 2", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { loop: () => 3 });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /Sandcastle loop failed/);
  assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue") || call.startsWith("gh pr")));
});

await test("a refusal from the landing tool is propagated and names the step, and nothing is commented", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
    pr: { status: 1, stdout: "" },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /landing step/);
  assert.match(result.err, /nothing was pushed or commented/);
  assert.equal(comments(calls).length, 0);
});

await test("a landing tool that broke exits 2 and nothing is commented", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
    pr: { status: 2, stdout: "" },
  });
  assert.equal(go(repo, run).code, EXIT_ERROR);
  assert.equal(comments(calls).length, 0);
});

await test("the pull request URL comes from gh, not from a URL in the landing tool's text", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls, inherited } = runner(repo, {
    loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
    pr: { status: 0, stdout: "pr-ready: see https://github.com/other/repo/pull/99 first\npr-ready: pull request https://github.com/other/repo/pull/98 is open.\n" },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.ok(comments(calls)[0]?.includes(PR_URL), "comment carries the URL gh reports for the branch");
  assert.ok(!comments(calls).some((call) => call.includes("/pull/99") || call.includes("/pull/98")));
  assert.ok(inherited.includes("node scripts/git/pr-ready.ts"), "the landing tool streams its check output to the terminal");
});

await test("a pull request gh cannot find after landing is an error and nothing is commented", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
    prs: () => ({ status: 1, stdout: "" }),
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /pull request URL/);
  assert.equal(comments(calls).length, 0);
});

await test("after landing, a pull request that is not exactly the landed commit into main is never commented", async (t) => {
  const cases: [string, (head: string) => Record<string, unknown>][] = [
    ["a stale head", () => ({ headRefOid: "0".repeat(40) })],
    ["another repository's URL", () => ({ url: "https://github.com/decoy/elsewhere/pull/5" })],
    ["another base", () => ({ baseRefName: "release" })],
    ["another source repository", () => ({ headRepositoryOwner: { login: "decoy" } })],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, (t) => {
      const repo = fixture(t);
      issueBranch(repo, "sandcastle/issue-4");
      const { run, calls } = runner(repo, {
        loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
        prs: (head) => prList(exactPr(head, overrides(head))),
      });
      const result = go(repo, run);
      assert.equal(result.code, EXIT_ERROR);
      assert.equal(comments(calls).length, 0, "no issue is told about a pull request that does not hold this work");
      assert.ok(!result.out.includes("decoy"));
    });
  }
});

await test("every gh call afk makes names the repository with its host, so GH_REPO and GH_HOST cannot redirect it", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, { loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; } });
  assert.equal(go(repo, run).code, EXIT_OK);
  const gh = calls.filter((call) => call.startsWith("gh "));
  assert.ok(gh.length >= 3);
  for (const call of gh) assert.match(call, /^gh (repo view github\.com\/Zimfra\/software_testing |pr list --repo github\.com\/Zimfra\/software_testing |issue comment \d+ -R github\.com\/Zimfra\/software_testing )/, call);
});

await test("only issue branches with commits of their own, merged by this run, are announced", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  issueBranch(repo, "sandcastle/issue-4");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8"); // merged by an earlier run, still not on main
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      repo.git(["branch", "sandcastle/issue-6"]); // created at HEAD, the agent committed nothing
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.deepEqual(comments(calls).map((call) => call.split(" ")[3]), ["4"]);
  assert.match(result.err, /issue 8/, "an issue merged by an earlier run is named as not announced");
});

await test("a repository gh cannot resolve is refused before the loop runs", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, { ghRepo: { status: 1, stdout: "" } });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /gh/);
  assert.ok(!calls.includes("node .sandcastle/main.ts"));
});

await test("an origin that publishes anywhere but the repository the Sandcastle prompts read is refused before the loop", async (t) => {
  const cases: [string, string, (repo: AfkFixture) => void, RegExp][] = [
    ["origin names another repository", "https://github.com/some-org/other-repo.git", () => undefined, /origin publishes to github\.com\/some-org\/other-repo/],
    ["origin names the repository on another host", "https://ghe.example.invalid/Zimfra/software_testing.git", () => undefined, /origin publishes to ghe\.example\.invalid\/Zimfra\/software_testing/],
    ["a push URL for another repository", AFK_ORIGIN, (repo) => repo.git(["config", "remote.origin.pushurl", "https://github.com/some-org/other-repo.git"]),
      /fetches from github\.com\/Zimfra\/software_testing but pushes to github\.com\/some-org\/other-repo/],
    ["origin is not a GitHub URL", AFK_ORIGIN, (repo) => repo.git(["remote", "set-url", "origin", repo.remote]), /origin is not a GitHub repository URL/],
    ["there is no origin to read", AFK_ORIGIN, (repo) => repo.git(["remote", "remove", "origin"]), /origin's URLs cannot be read/],
  ];
  for (const [name, origin, configure, named] of cases) {
    await t.test(name, (t) => {
      const repo = fixture(t, origin);
      configure(repo);
      const { run, calls } = runner(repo);
      const result = go(repo, run);
      assert.equal(result.code, EXIT_REFUSED, result.err);
      assert.match(result.err, named);
      assert.ok(!calls.includes("node .sandcastle/main.ts"), "the paid loop does not run");
      assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("git push") || call.startsWith("gh issue")), "nothing is landed, pushed or commented");
    });
  }
});

await test("a comment that fails does not stop the others, and the run reports it", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  issueBranch(repo, "sandcastle/issue-12");
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-12");
      return 0;
    },
    failComments: ["4"],
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.equal(comments(calls).length, 2);
  assert.match(result.err, /issue 4/);
  assert.match(result.err, new RegExp(PR_URL));
});

await test("refusals come before anything runs, and are reported together", async (t) => {
  await t.test("on main", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "main"]);
    const { run, calls } = runner(repo);
    const result = go(repo, run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /feature branch/);
    assert.ok(!sawAnything(calls));
  });
  await t.test("detached HEAD", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "--detach", "HEAD"]);
    const { run, calls } = runner(repo);
    assert.equal(go(repo, run).code, EXIT_REFUSED);
    assert.ok(!sawAnything(calls));
  });
  await t.test("uncommitted changes", (t) => {
    const repo = fixture(t);
    repo.write("dirty.md", "x\n");
    const { run, calls } = runner(repo);
    const result = go(repo, run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /uncommitted/);
    assert.ok(!sawAnything(calls));
  });
  await t.test("gh that cannot resolve the repository is reported with the other refusals", (t) => {
    const repo = fixture(t);
    repo.write("dirty.md", "x\n");
    const { run, calls } = runner(repo, { ghRepo: { status: 1, stdout: "" } });
    const result = go(repo, run);
    assert.equal(result.code, EXIT_REFUSED);
    assert.match(result.err, /uncommitted/);
    assert.match(result.err, /gh cannot resolve/);
    assert.ok(!calls.includes("node .sandcastle/main.ts"));
  });
  await t.test("both at once", (t) => {
    const repo = fixture(t);
    repo.git(["switch", "--quiet", "main"]);
    repo.write("dirty.md", "x\n");
    const result = go(repo, runner(repo).run);
    assert.match(result.err, /feature branch/);
    assert.match(result.err, /uncommitted/);
  });
});

await test("a branch switch during the loop stops the run before landing or commenting", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      repo.git(["switch", "--quiet", "-c", "feat/elsewhere"]);
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /feat\/afk-work/);
  assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue") || call.startsWith("gh pr")));
});

await test("a HEAD that moved with no announceable branch is a warning exit, not a silent success", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, {
    loop: () => {
      repo.write("moved.md", "m\n");
      repo.commit("feat: moved");
      repo.git(["update-ref", "refs/heads/sandcastle/issue-5", "HEAD"]); // no commit entry in its reflog
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /HEAD moved/);
  assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
});

await test("a branch with a leading zero in its number is not an issue branch", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-07");
  const { run, calls } = runner(repo, { loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-07"); return 0; } });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR, "HEAD moved but nothing is announceable");
  assert.equal(comments(calls).length, 0);
});

await test("a failing git status or a failing fetch after the loop stops the run with an error", async (t) => {
  await t.test("git status fails", (t) => {
    const repo = fixture(t);
    const base = runner(repo);
    const run: Run = (command, args, options) =>
      command === "git" && args[0] === "status" ? { status: 128, stdout: "" } : base.run(command, args, options);
    assert.throws(() => go(repo, run), /git status/);
    assert.ok(!base.calls.includes("node .sandcastle/main.ts"));
  });
  await t.test("the fetch after the loop fails", (t) => {
    const repo = fixture(t);
    const base = runner(repo);
    let fetches = 0;
    const run: Run = (command, args, options) => {
      if (command === "git" && args[0] === "fetch" && ++fetches === 2) return { status: 128, stdout: "" };
      return base.run(command, args, options);
    };
    const result = go(repo, run);
    assert.equal(fetches, 2, "one fetch before the loop and one after, never two before");
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /loop ran/);
    assert.match(result.err, /Nothing was pushed or commented/);
    assert.ok(base.calls.includes("node .sandcastle/main.ts"), "the loop did run");
    assert.ok(!base.calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
  });
});

await test("an unreachable origin is reported with the other refusals before the loop, not as a bare crash", (t) => {
  const repo = fixture(t);
  repo.write("dirty.md", "x\n");
  const base = runner(repo);
  const run: Run = (command, args, options) =>
    command === "git" && args[0] === "fetch" ? { status: 128, stdout: "" } : base.run(command, args, options);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /fetch/);
  assert.match(result.err, /uncommitted/);
  assert.ok(!base.calls.includes("node .sandcastle/main.ts"));
});

await test("a merge-base that fails for a reason other than no common history is an error, not that refusal", (t) => {
  const repo = fixture(t);
  const base = runner(repo);
  const run: Run = (command, args, options) =>
    command === "git" && args[0] === "merge-base" ? { status: 128, stdout: "" } : base.run(command, args, options);
  assert.throws(() => go(repo, run), /merge-base/);
  assert.ok(!base.calls.includes("node .sandcastle/main.ts"));
});

await test("a landing step that failed says a push may already have happened", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run } = runner(repo, {
    loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
    pr: { status: 2, stdout: "" },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /push may already have happened/);
  assert.doesNotMatch(result.err, /nothing was pushed/i);
});

await test("a failing loop says issues may already be merged on the branch", (t) => {
  const repo = fixture(t);
  const result = go(repo, runner(repo, { loop: () => 3 }).run);
  assert.match(result.err, /may already have merged/);
});

await test("a branch with no remote yet is probed quietly, never with a merge-base against a ref that does not exist", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
  const { run, calls } = runner(repo);
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /not pushed/);
  assert.ok(calls.includes("git rev-parse --verify --quiet refs/remotes/origin/feat/afk-work^{commit}"), "asks for the remote ref quietly first");
  assert.ok(!calls.some((call) => call.startsWith("git merge-base --is-ancestor") && call.endsWith("refs/remotes/origin/feat/afk-work")), "no merge-base against a missing ref (it prints a fatal line)");
});

await test("work merged by an earlier run and not pushed is an error, and once pushed it is a note", async (t) => {
  await t.test("not pushed", (t) => {
    const repo = fixture(t);
    issueBranch(repo, "sandcastle/issue-8");
    mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
    const { run, calls } = runner(repo);
    const result = go(repo, run);
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /not pushed/);
    assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
  });
  await t.test("pushed", (t) => {
    const repo = fixture(t);
    issueBranch(repo, "sandcastle/issue-8");
    mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
    publish(repo, "feat/afk-work");
    const result = go(repo, runner(repo).run);
    assert.equal(result.code, EXIT_OK, result.err);
    assert.match(result.out, /already pushed/);
  });
});

await test("an issue branch the run merged without a commit entry is named and makes the run exit 2 after landing the rest", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      repo.write("b.md", "b\n");
      repo.commit("feat: b");
      repo.git(["update-ref", "refs/heads/sandcastle/issue-9", "HEAD"]); // merged, but no commit entry
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /issue 9/);
  assert.equal(comments(calls).length, 1, "issue 4 is still announced");
});

await test("a gh call that times out is reported as a failed comment and the others still go", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  issueBranch(repo, "sandcastle/issue-12");
  const base = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-12");
      return 0;
    },
  });
  const run: Run = (command, args, options) => {
    if (command === "gh" && args[0] === "issue" && args[2] === "4") throw new Error("spawnSync gh ETIMEDOUT");
    return base.run(command, args, options);
  };
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.deepEqual(comments(base.calls).map((call) => call.split(" ")[3]), ["12"], "the comment that timed out never reached gh, and issue 12 still went");
  assert.match(result.err, /issue 4/);
  assert.match(result.err, new RegExp(PR_URL));
});

await test("an empty branch left by an earlier run does not turn a quiet run into an error", (t) => {
  const repo = fixture(t);
  repo.write("feature.md", "feature work not on main yet\n");
  repo.commit("feat: feature work");
  repo.git(["branch", "sandcastle/issue-6"]); // created at HEAD by an earlier run, never committed to
  const result = go(repo, runner(repo).run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.doesNotMatch(result.err, /issue 6/);
});

await test("earlier work that origin already holds stays a note after one more local commit", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
  publish(repo, "feat/afk-work");
  repo.write("local.md", "a later local commit\n");
  repo.commit("docs: later");
  const result = go(repo, runner(repo).run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.match(result.out, /already pushed/);
});

await test("a tree left dirty or half-merged by the loop is an error, not a quiet success", async (t) => {
  await t.test("uncommitted changes", (t) => {
    const repo = fixture(t);
    const { run, calls } = runner(repo, { loop: () => { repo.write("stray.md", "x\n"); return 0; } });
    const result = go(repo, run);
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /uncommitted/);
    assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
  });
  await t.test("a merge left in progress", (t) => {
    const repo = fixture(t);
    issueBranch(repo, "sandcastle/issue-5");
    repo.write("conflict.md", "ours\n");
    repo.commit("docs: ours");
    repo.git(["switch", "--quiet", "sandcastle/issue-5"]);
    repo.write("conflict.md", "theirs\n");
    repo.commit("docs: theirs");
    repo.git(["switch", "--quiet", "feat/afk-work"]);
    const { run } = runner(repo, {
      loop: () => {
        try { repo.git(["merge", "--no-commit", "--no-ff", "sandcastle/issue-5"]); } catch { /* the conflict is the point */ }
        return 0;
      },
    });
    assert.equal(go(repo, run).code, EXIT_ERROR);
  });
});

await test("a gh that throws when resolving the repository is a refusal, not a crash", (t) => {
  const repo = fixture(t);
  const base = runner(repo);
  const run: Run = (command, args, options) => {
    if (command === "gh" && args[0] === "repo") throw new Error("spawnSync gh ETIMEDOUT");
    return base.run(command, args, options);
  };
  const result = go(repo, run);
  assert.equal(result.code, EXIT_REFUSED);
  assert.match(result.err, /gh cannot resolve/);
  assert.ok(!base.calls.includes("node .sandcastle/main.ts"));
});

await test("every repository named in the Sandcastle prompts is the one the wrapper requires", () => {
  const dir = new URL("../../.sandcastle/", import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  assert.ok(files.length >= 4, "the prompt files are found");
  const found: string[] = [];
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), "utf8");
    found.push(...[...text.matchAll(/(?:-R|--repo) ([\w.-]+\/[\w.-]+)/g)].map((match) => match[1] ?? ""));
  }
  assert.ok(found.length > 0, "the prompts name the repository");
  assert.deepEqual([...new Set(found)], [PROMPT_REPO]);
});

await test("an empty leftover branch that the loop then works and merges is announced and landed", (t) => {
  const repo = fixture(t);
  repo.write("feature.md", "feature work not on main yet\n");
  repo.commit("feat: feature work");
  repo.git(["branch", "sandcastle/issue-6"]); // empty leftover from an earlier run
  const { run, calls } = runner(repo, {
    loop: () => {
      repo.git(["switch", "--quiet", "sandcastle/issue-6"]);
      repo.write("six.md", "six\n");
      repo.commit("feat: six");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-6");
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.ok(calls.includes("node scripts/git/pr-ready.ts"), "the work is landed");
  assert.deepEqual(comments(calls).map((call) => call.split(" ")[3]), ["6"]);
  assert.doesNotMatch(result.err, /earlier run/);
});

await test("earlier work that is pushed but has no pull request is an error", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
  publish(repo, "feat/afk-work");
  const { run, calls } = runner(repo, { prs: () => ({ status: 1, stdout: "" }) });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /no (open )?pull request/);
  assert.ok(!calls.some((call) => call.startsWith("gh issue")));
});

await test("a merge left in progress on an otherwise clean tree is an error", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-5");
  const { run } = runner(repo, {
    loop: () => {
      repo.git(["merge", "--no-commit", "--no-ff", "-s", "ours", "sandcastle/issue-5"]);
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /merge/);
});

await test("a branch whose reflog entries expired does not make every later run exit 2", (t) => {
  const repo = fixture(t);
  repo.write("feature.md", "feature work not on main yet\n");
  repo.commit("feat: feature work");
  repo.git(["update-ref", "refs/heads/sandcastle/issue-9", "HEAD"]); // merged, no commit entry: unrecognised
  const result = go(repo, runner(repo).run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.doesNotMatch(result.err, /by this run/);
});

await test("a worked branch the loop left unmerged is an error, not a quiet success", (t) => {
  const repo = fixture(t);
  const { run, calls } = runner(repo, {
    loop: () => {
      repo.git(["switch", "--quiet", "-c", "sandcastle/issue-7", "feat/afk-work"]);
      repo.write("seven.md", "7\n");
      repo.commit("feat: seven");
      repo.git(["switch", "--quiet", "feat/afk-work"]);
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /issue 7/);
  assert.match(result.err, /did not merge/);
  assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
});

await test("a worked branch merged earlier that the loop extends and merges again is announced", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
  const { run, calls } = runner(repo, {
    loop: () => {
      repo.git(["switch", "--quiet", "sandcastle/issue-8"]);
      repo.write("eight-more.md", "more\n");
      repo.commit("feat: more of eight");
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_OK, result.err);
  assert.deepEqual(comments(calls).map((call) => call.split(" ")[3]), ["8"]);
});

await test("a closed or merged pull request for the branch is not an open one", async (t) => {
  await t.test("earlier work pushed, only a closed pull request", (t) => {
    const repo = fixture(t);
    issueBranch(repo, "sandcastle/issue-8");
    mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
    publish(repo, "feat/afk-work");
    const { run } = runner(repo, { prs: (head) => prList(exactPr(head, { state: "CLOSED" })) });
    const result = go(repo, run);
    assert.equal(result.code, EXIT_ERROR);
    assert.match(result.err, /no (open )?pull request/);
  });
  await t.test("after landing, a merged pull request URL is not commented", (t) => {
    const repo = fixture(t);
    issueBranch(repo, "sandcastle/issue-4");
    const { run, calls } = runner(repo, {
      loop: () => { mergeInto(repo, "feat/afk-work", "sandcastle/issue-4"); return 0; },
      prs: (head) => prList(exactPr(head, { state: "MERGED" })),
    });
    assert.equal(go(repo, run).code, EXIT_ERROR);
    assert.equal(comments(calls).length, 0);
  });
});

await test("an issue branch that the loop deleted is an error, not a silent success", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-8");
  mergeInto(repo, "feat/afk-work", "sandcastle/issue-8");
  const { run, calls } = runner(repo, { loop: () => { repo.git(["branch", "-D", "sandcastle/issue-8"]); return 0; } });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /issue 8/);
  assert.match(result.err, /deleted/);
  assert.ok(!calls.some((call) => call.includes("pr-ready") || call.startsWith("gh issue")));
});

await test("stranded work is reported and the rest still lands, with exit 2 at the end", (t) => {
  const repo = fixture(t);
  issueBranch(repo, "sandcastle/issue-4");
  const { run, calls } = runner(repo, {
    loop: () => {
      mergeInto(repo, "feat/afk-work", "sandcastle/issue-4");
      repo.git(["switch", "--quiet", "-c", "sandcastle/issue-7", "feat/afk-work"]);
      repo.write("seven.md", "7\n");
      repo.commit("feat: seven");
      repo.git(["switch", "--quiet", "feat/afk-work"]);
      return 0;
    },
  });
  const result = go(repo, run);
  assert.equal(result.code, EXIT_ERROR);
  assert.match(result.err, /issue 7/);
  assert.ok(calls.includes("node scripts/git/pr-ready.ts"), "issue 4 still lands");
  assert.deepEqual(comments(calls).map((call) => call.split(" ")[3]), ["4"]);
});

await test("a branch the loop only pointed at a commit origin/main already holds is not stranded", (t) => {
  const repo = fixture(t);
  repo.git(["switch", "--quiet", "main"]);
  repo.write("on-main.md", "main moved\n");
  repo.commit("feat: main moves");
  publish(repo, "main");
  repo.git(["switch", "--quiet", "feat/afk-work"]);
  repo.git(["merge", "--quiet", "--no-edit", "origin/main"]);
  const result = go(repo, runner(repo, {
    loop: () => {
      repo.git(["branch", "--force", "sandcastle/issue-3", "origin/main"]);
      return 0;
    },
  }).run);
  assert.equal(result.code, EXIT_OK, result.err);
});

await test("arguments", (t) => {
  const repo = fixture(t);
  assert.equal(go(repo, runner(repo).run, ["--bogus"]).code, EXIT_ERROR);
  assert.match(go(repo, runner(repo).run, ["--help"]).out, /Usage/);
});
